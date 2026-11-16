(* Schema di /api/graphql: la forma OCaml di docs/schema.graphql, che resta la
   fonte di verità (tests/api/graphql-schema.spec.js confronta le due forme;
   le descrizioni stanno nell'SDL, qui solo le etichette di Speaker e Tipologia).

   I record sono il JSON prodotto dalle SELECT di src/admin: ogni campo si legge
   da lì, così i valori sono gli stessi di /api/bo. *)

open Graphql_lwt

type ctx = Dream.request
type json = Yojson.Safe.t

(* --- Campi letti dal JSON ---------------------------------------------- *)

let member name : json -> json = function
  | `Assoc l -> Option.value (List.assoc_opt name l) ~default:`Null
  | _ -> `Null

let unexpected name = failwith ("GraphQL: valore inatteso nel campo " ^ name)
let get_int name : json -> int = function `Int i -> i | _ -> unexpected name
let get_bool name : json -> bool = function `Bool b -> b | _ -> unexpected name
let get_string name : json -> string = function `String s -> s | _ -> unexpected name
let get_string_opt name : json -> string option = function `String s -> Some s | `Null -> None | _ -> unexpected name
let get_list name : json -> json list = function `List l -> l | _ -> unexpected name

(* rawg_json: JSON serializzato *)
let get_json_opt _ : json -> string option = function `Null -> None | j -> Some (Yojson.Safe.to_string j)

let from_json name typ get : (ctx, json) Schema.field =
  Schema.field name ~typ ~args:Schema.Arg.[] ~resolve:(fun _ j -> get name (member name j))

let int name = from_json name Schema.(non_null int) get_int
let bool name = from_json name Schema.(non_null bool) get_bool
let str name = from_json name Schema.(non_null string) get_string
let str_opt name = from_json name Schema.string get_string_opt

(* --- Enum -------------------------------------------------------------- *)

let labelled (name, doc) = Schema.enum_value name ~doc ~value:name

(* La libreria riconosce il valore di un enum in uscita per identità fisica:
   la stringa letta dal JSON va sostituita con quella dell'elenco. *)
let get_enum labels name (j : json) =
  match List.find_opt (fun (v, _) -> `String v = j) labels with
  | Some (v, _) -> v
  | None -> unexpected name
let value (name, value) = Schema.enum_value name ~value

let speaker_labels =
  [
    ("TUTT", "Tutti");
    ("BORD", "Matteo Bordone (corri!)");
    ("FOSS", "Francesco Fossetti (salta!)");
    ("ZAMP", "Alessandro Zampini (spara!)");
  ]

let tipologia_labels =
  [
    ("FREE", "Chiacchiera libera");
    ("RECE", "Recensione");
    ("CONS", "Consiglio");
    ("STAR", "Osservatorio Start Citizen");
  ]

let speaker_values = List.map labelled speaker_labels
let tipologia_values = List.map labelled tipologia_labels

let speaker : (ctx, string option) Schema.typ = Schema.enum "Speaker" ~values:speaker_values
let speaker_in = Schema.Arg.enum "Speaker" ~values:speaker_values
let tipologia : (ctx, string option) Schema.typ = Schema.enum "Tipologia" ~values:tipologia_values
let tipologia_in = Schema.Arg.enum "Tipologia" ~values:tipologia_values

let direzione =
  Schema.Arg.enum "Direzione" ~values:(List.map value [("ASC", Admin.Ra_codec.Asc); ("DESC", Admin.Ra_codec.Desc)])

(* Il valore di un ordinamento è l'elenco delle colonne della SELECT. *)
let ordinamento name values = Schema.Arg.enum name ~values:(List.map value values)

let ordinamento_episodi =
  ordinamento "OrdinamentoEpisodi"
    [
      ("EPISODIO_NUMERO", ["episodio_numero"]);
      ("TITOLO", ["titolo"]);
      ("DATA_USCITA", ["data_uscita"]);
      ("DURATA", ["durata"]);
      ("PUBBLICATO", ["pubblicato"]);
    ]

let ordinamento_videogame =
  ordinamento "OrdinamentoVideogame" [("TITOLO", ["titolo"]); ("RAWG_SLUG", ["rawg_slug"])]

let ordinamento_associazioni =
  ordinamento "OrdinamentoAssociazioni"
    [
      ("DATA_USCITA", ["data_uscita"; "_istante"]);
      ("ISTANTE", ["_istante"]);
      ("SPEAKER", ["speaker"]);
      ("TIPOLOGIA", ["tipologia"]);
      ("VIDEOGAME_TITOLO", ["videogame_titolo"]);
      ("EPISODIO_TITOLO", ["episodio_titolo"]);
    ]

let ordinamento_utenti =
  ordinamento "OrdinamentoUtenti"
    (List.map
       (fun c -> (String.uppercase_ascii c, [c]))
       ["username"; "first_name"; "last_name"; "email"; "is_staff"; "is_active"; "is_superuser"; "last_login"])

(* Il default dell'elenco (colonne e direzione) vale solo se mancano entrambi.
   Con l'ordinamento indicato e la direzione assente la direzione è ASC. *)
let order ~default:(columns, dir) ordinamento direzione =
  match (ordinamento, direzione) with
  | None, None -> (columns, dir)
  | None, Some dir -> (columns, dir)
  | Some columns, dir -> (columns, Option.value dir ~default:Admin.Ra_codec.Asc)

(* --- Tipi -------------------------------------------------------------- *)

let utente_corrente =
  Schema.obj "UtenteCorrente" ~fields:[int "id"; str "username"; str "fullName"; bool "is_superuser"]

let associazione_episodio =
  Schema.obj "AssociazioneEpisodio"
    ~fields:
      [
        int "id";
        int "videogame_id";
        str_opt "videogame_titolo";
        str_opt "istante";
        from_json "speaker" (Schema.non_null speaker) (get_enum speaker_labels);
        from_json "tipologia" (Schema.non_null tipologia) (get_enum tipologia_labels);
      ]

let episodio_fields =
  [
    int "id";
    str "titolo";
    str_opt "episodio_numero";
    str "data_uscita";
    str "durata";
    str_opt "url";
    str_opt "url_post";
    str_opt "url_video";
    str_opt "descrizione_html";
    str_opt "descrizione_txt";
    str_opt "note";
    bool "pubblicato";
    str_opt "cover";
    str_opt "cover_url";
    str "ts_created";
    str "ts";
  ]

let episodio =
  Schema.obj "Episodio"
    ~fields:
      (episodio_fields
      @ [from_json "associazioni" Schema.(non_null (list (non_null associazione_episodio))) get_list])

let episodio_in_elenco = Schema.obj "EpisodioInElenco" ~fields:episodio_fields

let videogame =
  Schema.obj "Videogame"
    ~fields:
      [
        int "id";
        str_opt "titolo";
        str "rawg_slug";
        str_opt "cover";
        str_opt "descrizione_raw";
        str_opt "descrizione_html";
        from_json "rawg_json" Schema.string get_json_opt;
        str "ts_created";
        str "ts";
      ]

let videogame_in_elenco =
  Schema.obj "VideogameInElenco" ~fields:[int "id"; str_opt "titolo"; str "rawg_slug"; str_opt "cover"; str "ts"]

let associazione =
  Schema.obj "Associazione"
    ~fields:
      [
        int "id";
        int "episodio_id";
        int "videogame_id";
        str_opt "istante";
        from_json "speaker" (Schema.non_null speaker) (get_enum speaker_labels);
        from_json "tipologia" (Schema.non_null tipologia) (get_enum tipologia_labels);
        str_opt "videogame_titolo";
        str "episodio_titolo";
        str_opt "episodio_numero";
        str "data_uscita";
      ]

let utente =
  Schema.obj "Utente"
    ~fields:
      [
        int "id";
        str "username";
        str "first_name";
        str "last_name";
        str "email";
        bool "is_staff";
        bool "is_active";
        bool "is_superuser";
        str_opt "last_login";
        str "date_joined";
      ]

let pagina name elemento : (ctx, (int * json list) option) Schema.typ =
  Schema.(
    obj name
      ~fields:
        [
          field "totale" ~typ:(non_null int) ~args:Arg.[] ~resolve:(fun _ (totale, _) -> totale);
          field "elementi"
            ~typ:(non_null (list (non_null elemento)))
            ~args:Arg.[]
            ~resolve:(fun _ (_, elementi) -> elementi);
        ])

let pagina_episodi = pagina "PaginaEpisodi" episodio_in_elenco
let pagina_videogame = pagina "PaginaVideogame" videogame_in_elenco
let pagina_associazioni = pagina "PaginaAssociazioni" associazione
let pagina_utenti = pagina "PaginaUtenti" utente

(* --- Input ------------------------------------------------------------- *)

(* Ogni input diventa il body JSON che /api/bo riceverebbe, così lo valida lo
   stesso parse_payload. Un campo assente o null non entra nel body. *)

let opt name f = function None -> [] | Some x -> [(name, f x)]
let s x : json = `String x
let b x : json = `Bool x
let i x : json = `Int x

(* P-2: «istante» è sempre presente nel body (null se manca): per parse_payload
   un istante assente varrebbe 0:00:00. *)
let associazione_body id videogame_id istante speaker tipologia : json =
  `Assoc
    (List.concat
       [
         opt "id" i id;
         [("videogame_id", i videogame_id); ("istante", Option.fold ~none:`Null ~some:s istante)];
         opt "speaker" s speaker;
         opt "tipologia" s tipologia;
       ])

(* P-1: senza «associazioni» parse_payload non le tocca; [] le cancella tutte. *)
let episodio_body titolo episodio_numero data_uscita durata url url_post url_video descrizione_html descrizione_txt
    note pubblicato associazioni : json =
  `Assoc
    (List.concat
       [
         [("titolo", s titolo); ("data_uscita", s data_uscita); ("durata", s durata)];
         opt "episodio_numero" s episodio_numero;
         opt "url" s url;
         opt "url_post" s url_post;
         opt "url_video" s url_video;
         opt "descrizione_html" s descrizione_html;
         opt "descrizione_txt" s descrizione_txt;
         opt "note" s note;
         opt "pubblicato" b pubblicato;
         opt "associazioni" (fun l -> `List l) associazioni;
       ])

let videogame_body rawg_slug titolo descrizione_raw descrizione_html cover : json =
  `Assoc
    (List.concat
       [
         [("rawg_slug", s rawg_slug)];
         opt "titolo" s titolo;
         opt "descrizione_raw" s descrizione_raw;
         opt "descrizione_html" s descrizione_html;
         opt "cover" s cover;
       ])

let utente_body username password first_name last_name email is_staff is_active is_superuser : json =
  `Assoc
    (List.concat
       [
         [("username", s username)];
         opt "password" s password;
         opt "first_name" s first_name;
         opt "last_name" s last_name;
         opt "email" s email;
         [("is_staff", b is_staff); ("is_active", b is_active); ("is_superuser", b is_superuser)];
       ])

let credenziali_input =
  Schema.Arg.(
    obj "CredenzialiInput"
      ~fields:[arg "username" ~typ:(non_null string); arg "password" ~typ:(non_null string)]
      ~coerce:(fun username password -> (username, password)))

let associazione_input =
  Schema.Arg.(
    obj "AssociazioneInput"
      ~fields:
        [
          arg "id" ~typ:int;
          arg "videogame_id" ~typ:(non_null int);
          arg "istante" ~typ:string;
          arg "speaker" ~typ:speaker_in;
          arg "tipologia" ~typ:tipologia_in;
        ]
      ~coerce:associazione_body)

let episodio_input =
  Schema.Arg.(
    obj "EpisodioInput"
      ~fields:
        [
          arg "titolo" ~typ:(non_null string);
          arg "episodio_numero" ~typ:string;
          arg "data_uscita" ~typ:(non_null string);
          arg "durata" ~typ:(non_null string);
          arg "url" ~typ:string;
          arg "url_post" ~typ:string;
          arg "url_video" ~typ:string;
          arg "descrizione_html" ~typ:string;
          arg "descrizione_txt" ~typ:string;
          arg "note" ~typ:string;
          arg "pubblicato" ~typ:bool;
          arg "associazioni" ~typ:(list (non_null associazione_input));
        ]
      ~coerce:episodio_body)

let videogame_input =
  Schema.Arg.(
    obj "VideogameInput"
      ~fields:
        [
          arg "rawg_slug" ~typ:(non_null string);
          arg "titolo" ~typ:string;
          arg "descrizione_raw" ~typ:string;
          arg "descrizione_html" ~typ:string;
          arg "cover" ~typ:string;
        ]
      ~coerce:videogame_body)

let utente_input =
  Schema.Arg.(
    obj "UtenteInput"
      ~fields:
        [
          arg "username" ~typ:(non_null string);
          arg "password" ~typ:string;
          arg "first_name" ~typ:string;
          arg "last_name" ~typ:string;
          arg "email" ~typ:string;
          arg "is_staff" ~typ:(non_null bool);
          arg "is_active" ~typ:(non_null bool);
          arg "is_superuser" ~typ:(non_null bool);
        ]
      ~coerce:utente_body)

(* La libreria ignora i campi che un input object non prevede. Con la
   sostituzione completa un nome sbagliato azzererebbe un dato in silenzio:
   l'argomento «dati» si ricontrolla qui sull'AST (e sulle variabili), e
   l'errore, senza codice, esce come GRAPHQL_VALIDATION. *)
type shape = Leaf | Obj of string * (string * shape) list

let leaves names = List.map (fun n -> (n, Leaf)) names

let associazione_shape = Obj ("AssociazioneInput", leaves ["id"; "videogame_id"; "istante"; "speaker"; "tipologia"])

let episodio_shape =
  Obj
    ( "EpisodioInput",
      ("associazioni", associazione_shape)
      :: leaves
           [
             "titolo";
             "episodio_numero";
             "data_uscita";
             "durata";
             "url";
             "url_post";
             "url_video";
             "descrizione_html";
             "descrizione_txt";
             "note";
             "pubblicato";
           ] )

let videogame_shape =
  Obj ("VideogameInput", leaves ["rawg_slug"; "titolo"; "descrizione_raw"; "descrizione_html"; "cover"])

let utente_shape =
  Obj
    ( "UtenteInput",
      leaves
        ["username"; "password"; "first_name"; "last_name"; "email"; "is_staff"; "is_active"; "is_superuser"] )

let rec unknown_field (variables : Schema.variable_map) shape (v : Graphql_parser.value) =
  match (shape, v) with
  | _, `Variable name -> (
    match Schema.StringMap.find name variables with
    | Some c -> unknown_field variables shape (c : Graphql_parser.const_value :> Graphql_parser.value)
    | None -> None)
  | _, `List l -> List.find_map (unknown_field variables shape) l
  | Obj (typ, fields), `Assoc l ->
    List.find_map
      (fun (k, v) ->
        match List.assoc_opt k fields with
        | None -> Some (Printf.sprintf "Il campo «%s» non è previsto da %s" k typ)
        | Some shape -> unknown_field variables shape v)
      l
  | _ -> None

(* --- Query e mutation -------------------------------------------------- *)

(* Prima il permesso, poi il controllo di «dati» (se c'è [input]), poi
   l'operazione: [f] riceve la richiesta e l'utente. *)
let run ?input auth (info : ctx Schema.resolve_info) f =
  match%lwt Errori.guard (fun () -> auth info.ctx) with
  | Error _ as e -> Lwt.return e
  | Ok user -> (
    let unknown =
      Option.bind input (fun shape ->
          Option.bind (List.assoc_opt "dati" info.field.arguments) (unknown_field info.variables shape))
    in
    match unknown with
    | Some msg -> Lwt.return_error msg
    | None -> Errori.guard (fun () -> f info.ctx user))

let staff = Dati.staff
let superuser = Dati.superuser
let id_arg = Schema.Arg.(arg "id" ~typ:(non_null int))

let queries =
  Schema.
    [
      io_field "me" ~typ:(non_null utente_corrente) ~args:Arg.[] ~resolve:(fun info () ->
          run staff info (fun _ user -> Lwt.return (Admin.Auth.me_json user)));
      io_field "elencoEpisodi" ~typ:(non_null pagina_episodi)
        ~args:
          Arg.
            [
              arg "offset" ~typ:int;
              arg "limit" ~typ:int;
              arg "ricerca" ~typ:string;
              arg "pubblicato" ~typ:bool;
              arg "ordinamento" ~typ:ordinamento_episodi;
              arg "direzione" ~typ:direzione;
            ]
        ~resolve:(fun info () offset limit ricerca pubblicato ordinamento direzione ->
          run staff info (fun req _ ->
              Dati.elenco_episodi req ~offset ~limit ~ricerca ~pubblicato
                ~order:(order ~default:(["data_uscita"], Admin.Ra_codec.Desc) ordinamento direzione)));
      io_field "episodio" ~typ:(non_null episodio) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run staff info (fun req _ -> Dati.episodio req id));
      io_field "elencoVideogame" ~typ:(non_null pagina_videogame)
        ~args:
          Arg.
            [
              arg "offset" ~typ:int;
              arg "limit" ~typ:int;
              arg "ricerca" ~typ:string;
              arg "ordinamento" ~typ:ordinamento_videogame;
              arg "direzione" ~typ:direzione;
            ]
        ~resolve:(fun info () offset limit ricerca ordinamento direzione ->
          run staff info (fun req _ ->
              Dati.elenco_videogame req ~offset ~limit ~ricerca
                ~order:(order ~default:(["titolo"], Admin.Ra_codec.Asc) ordinamento direzione)));
      io_field "videogame" ~typ:(non_null videogame) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run staff info (fun req _ -> Dati.videogame req id));
      io_field "elencoAssociazioni" ~typ:(non_null pagina_associazioni)
        ~args:
          Arg.
            [
              arg "episodio_id" ~typ:int;
              arg "videogame_id" ~typ:int;
              arg "offset" ~typ:int;
              arg "limit" ~typ:int;
              arg "ordinamento" ~typ:ordinamento_associazioni;
              arg "direzione" ~typ:direzione;
            ]
        ~resolve:(fun info () episodio_id videogame_id offset limit ordinamento direzione ->
          run staff info (fun req _ ->
              Dati.elenco_associazioni req ~offset ~limit ~episodio_id ~videogame_id
                ~order:(order ~default:(["data_uscita"; "_istante"], Admin.Ra_codec.Asc) ordinamento direzione)));
      io_field "associazione" ~typ:(non_null associazione) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run staff info (fun req _ -> Dati.associazione req id));
      io_field "elencoUtenti" ~typ:(non_null pagina_utenti)
        ~args:
          Arg.
            [
              arg "offset" ~typ:int;
              arg "limit" ~typ:int;
              arg "ricerca" ~typ:string;
              arg "ordinamento" ~typ:ordinamento_utenti;
              arg "direzione" ~typ:direzione;
            ]
        ~resolve:(fun info () offset limit ricerca ordinamento direzione ->
          run superuser info (fun req _ ->
              Dati.elenco_utenti req ~offset ~limit ~ricerca
                ~order:(order ~default:(["username"], Admin.Ra_codec.Asc) ordinamento direzione)));
      io_field "utente" ~typ:(non_null utente) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run superuser info (fun req _ -> Dati.utente req id));
    ]

let mutations =
  Schema.
    [
      (* login e logout non chiedono una sessione, come in /api/bo *)
      io_field "login" ~typ:(non_null utente_corrente)
        ~args:Arg.[arg "credenziali" ~typ:(non_null credenziali_input)]
        ~resolve:(fun info () (username, password) ->
          Errori.guard (fun () -> Dati.login info.ctx ~username ~password));
      io_field "logout" ~typ:(non_null bool) ~args:Arg.[] ~resolve:(fun info () ->
          Errori.guard (fun () -> Dati.logout info.ctx));
      io_field "creaEpisodio" ~typ:(non_null episodio)
        ~args:Arg.[arg "dati" ~typ:(non_null episodio_input)]
        ~resolve:(fun info () dati -> run ~input:episodio_shape staff info (fun req _ -> Dati.crea_episodio req dati));
      io_field "aggiornaEpisodio" ~typ:(non_null episodio)
        ~args:Arg.[id_arg; arg "dati" ~typ:(non_null episodio_input)]
        ~resolve:(fun info () id dati ->
          run ~input:episodio_shape staff info (fun req _ -> Dati.aggiorna_episodio req id dati));
      io_field "eliminaEpisodio" ~typ:(non_null episodio) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run staff info (fun req _ -> Dati.elimina_episodio req id));
      io_field "creaVideogame" ~typ:(non_null videogame)
        ~args:Arg.[arg "dati" ~typ:(non_null videogame_input)]
        ~resolve:(fun info () dati -> run ~input:videogame_shape staff info (fun req _ -> Dati.crea_videogame req dati));
      io_field "aggiornaVideogame" ~typ:(non_null videogame)
        ~args:Arg.[id_arg; arg "dati" ~typ:(non_null videogame_input)]
        ~resolve:(fun info () id dati ->
          run ~input:videogame_shape staff info (fun req _ -> Dati.aggiorna_videogame req id dati));
      io_field "eliminaVideogame" ~typ:(non_null videogame) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run staff info (fun req _ -> Dati.elimina_videogame req id));
      io_field "creaUtente" ~typ:(non_null utente)
        ~args:Arg.[arg "dati" ~typ:(non_null utente_input)]
        ~resolve:(fun info () dati -> run ~input:utente_shape superuser info (fun req _ -> Dati.crea_utente req dati));
      io_field "aggiornaUtente" ~typ:(non_null utente)
        ~args:Arg.[id_arg; arg "dati" ~typ:(non_null utente_input)]
        ~resolve:(fun info () id dati ->
          run ~input:utente_shape superuser info (fun req me -> Dati.aggiorna_utente req me id dati));
      io_field "eliminaUtente" ~typ:(non_null utente) ~args:Arg.[id_arg] ~resolve:(fun info () id ->
          run superuser info (fun req me -> Dati.elimina_utente req me id));
    ]

(* I nomi dei tipi radice vanno indicati: il default della libreria è in
   minuscolo (spike, punto 3.3a.1). *)
let schema : ctx Schema.schema = Schema.schema ~query_name:"Query" ~mutation_name:"Mutation" queries ~mutations
