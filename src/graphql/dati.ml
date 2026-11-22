(* Operazioni dei resolver. Validazione, richieste Caqti e messaggi vengono da
   src/admin; qui ci sono le SELECT degli elenchi e la sequenza dei passi delle
   scritture.
   Gli errori si sollevano con [Admin.Resp.Http_error], come in /api/bo. *)

open Admin
open Resp

module type DB = Caqti_lwt.CONNECTION

type json = Yojson.Safe.t

let parse = Yojson.Safe.from_string
let db ?unique_msg req f = Lwt.bind (Dream.sql req f) (or_fail ?unique_msg)

(* --- Autenticazione ---------------------------------------------------- *)

(* Esegue i middleware di /api/bo e ne riusa criterio e messaggi d'errore. *)
let authorize (middleware : Dream.middleware) req =
  let user = ref None in
  let%lwt resp =
    middleware
      (fun req ->
        user := Some (Auth.current_user req);
        Dream.empty `OK)
      req
  in
  match !user with
  | Some u -> Lwt.return u
  | None -> Errori.raise_response resp

let staff = authorize Auth.require_staff
let superuser = authorize (fun inner -> Auth.require_staff (Auth.require_superuser inner))

(* Adattatore su Auth.login, che legge le credenziali dal body: a questo punto
   Dream.graphql ha già letto il body con la query (spike, punti 3.3a.4 e 7). *)
let login_attempted : unit Dream.field = Dream.new_field ~name:"gql.login" ()

(* Un solo login per richiesta: con gli alias una sola POST potrebbe chiedere
   migliaia di calcoli di hash, in serie, e tenere occupato uno slot per ore. *)
let login req ~username ~password =
  if Dream.field req login_attempted <> None then bad_request "È ammesso un solo login per richiesta";
  Dream.set_field req login_attempted ();
  Dream.set_body req (Yojson.Safe.to_string (`Assoc [("username", `String username); ("password", `String password)]));
  let%lwt resp = handle Auth.login req in
  if Dream.status resp <> `OK
  then Errori.raise_response resp
  else
    match%lwt Auth.load_session_user req with
    | Some u -> Lwt.return (Auth.me_json u)
    | None -> fail `Internal_Server_Error "Sessione non impostata dopo il login"

(* Cambio della propria password (F-AU-06), per ogni utente staff. Stessi
   passi di aggiornaUtente sul proprio account: regola degli 8 caratteri e hash
   di F-UT-04, sessione corrente tenuta valida, le altre chiuse (F-AU-05).
   La password attuale sbagliata è BAD_USER_INPUT, non UNAUTHENTICATED: il
   client su UNAUTHENTICATED torna al login. Come per il login, un solo cambio
   per richiesta: con gli alias una POST chiederebbe molti calcoli di hash. *)
let cambio_attempted : unit Dream.field = Dream.new_field ~name:"gql.cambia_password" ()

let cambia_password req (me : Auth.user) ~attuale ~nuova =
  if Dream.field req cambio_attempted <> None then bad_request "È ammesso un solo cambio di password per richiesta";
  Dream.set_field req cambio_attempted ();
  if String.length nuova < Utenti.min_password_length
  then Input.invalid "password" (Printf.sprintf "almeno %d caratteri" Utenti.min_password_length);
  let%lwt iterations = Auth.iterations_for_new_hash req in
  let%lwt ok = Password.verify ~dummy_iterations:iterations ~password:attuale me.password in
  if not ok
  then begin
    log.warning (fun m -> m ~request:req "Cambio password rifiutato per «%s»: password attuale errata" me.username);
    bad_request "La password attuale non è corretta"
  end;
  let%lwt hash = Password.make ~password:nuova ~iterations in
  let%lwt () = db req (fun (module DB : DB) -> DB.exec Auth.set_password_req (me.id, hash)) in
  let%lwt () = Auth.set_session_password req hash in
  log.info (fun m -> m ~request:req "Password cambiata da «%s»" me.username);
  Lwt.return (Auth.me_json { me with password = hash })

let logout req =
  let%lwt () = Dream.invalidate_session req in
  Lwt.return true

(* --- Elenchi ----------------------------------------------------------- *)

(* Elenco paginato con offset e limit. [select_sql] usa $1::jsonb per i filtri
   ed espone almeno la colonna [id], che chiude l'ordinamento per renderlo
   stabile; le colonne [hidden] servono solo a ordinare e si tolgono dal JSON.
   Il risultato è (totale, righe). *)
let run_list ?(hidden = []) ~select_sql ~order:(columns, dir) ~filter ~offset ~limit req =
  let offset = Option.value offset ~default:0 in
  if offset < 0 then bad_request "Parametro «offset»: deve essere ≥ 0";
  (match limit with
  | Some l when l < 1 || l > Ra_codec.max_page ->
    bad_request (Printf.sprintf "Parametro «limit»: deve essere tra 1 e %d" Ra_codec.max_page)
  | _ -> ());
  let d = match dir with Ra_codec.Asc -> "ASC" | Desc -> "DESC" in
  let order = String.concat ", " (List.map (fun c -> Printf.sprintf "%s %s NULLS LAST" c d) (columns @ ["id"])) in
  let sql =
    Printf.sprintf
      {|WITH f AS (%s)
        SELECT (SELECT count(*) FROM f),
               coalesce((SELECT jsonb_agg(to_jsonb(p) - ARRAY[%s] ORDER BY p._ord)
                         FROM (SELECT f.*, row_number() OVER (ORDER BY %s) AS _ord
                               FROM f ORDER BY _ord LIMIT $2 OFFSET $3) p),
                        '[]'::jsonb)::text|}
      select_sql
      (String.concat ", " (List.map (fun c -> "'" ^ c ^ "'") ("_ord" :: hidden)))
      order
  in
  let%lwt total, rows =
    db req (fun (module DB : DB) -> DB.find (Ra_codec.list_req sql) (Ra_codec.filter_json filter, limit, offset))
  in
  Lwt.return (Int64.to_int total, match parse rows with `List l -> l | _ -> [])

(* Ricerca "contiene": stesse regole del filtro q di /api/bo. *)
let q ricerca = Ra_codec.q_filter (match ricerca with Some s -> [("q", `String s)] | None -> [])

let episodi_sql =
  Printf.sprintf
    {|SELECT %s FROM backoffice_episodio e
      WHERE ($1::jsonb->>'q' IS NULL
             OR e.titolo ILIKE $1::jsonb->>'q' OR e.episodio_numero ILIKE $1::jsonb->>'q')
        AND ($1::jsonb->'pubblicato' IS NULL OR e.pubblicato = ($1::jsonb->>'pubblicato')::boolean)|}
    Episodi.columns

let elenco_episodi req ~offset ~limit ~ricerca ~pubblicato ~order =
  run_list req ~select_sql:episodi_sql ~order ~offset ~limit
    ~filter:[("q", q ricerca); ("pubblicato", Option.map (fun b -> `Bool b) pubblicato)]

let videogame_sql =
  Printf.sprintf
    {|SELECT %s FROM backoffice_videogame v
      WHERE ($1::jsonb->>'q' IS NULL
             OR v.titolo ILIKE $1::jsonb->>'q'
             OR v.descrizione_raw ILIKE $1::jsonb->>'q'
             OR v.rawg_slug ILIKE $1::jsonb->>'q')|}
    Videogame.list_columns

let elenco_videogame req ~offset ~limit ~ricerca ~order =
  run_list req ~select_sql:videogame_sql ~order ~offset ~limit ~filter:[("q", q ricerca)]

(* Scelta del videogame di un'associazione (F-EP-09, 3.6c.4b): le regole di
   Django__episodio.search_episodes_by_game_title (sito pubblico), applicate
   ai videogame e solo al titolo. La SELECT interna ordina e taglia, quella
   esterna rimette l'ordine sulle righe restituite. *)
let cerca_videogame_max = 50

let cerca_sql ~where ~order =
  Printf.sprintf
    {|SELECT (to_jsonb(r) - '_sim')::text
      FROM (SELECT %s, word_similarity(unaccent($1), unaccent(v.titolo)) AS _sim
            FROM backoffice_videogame v
            %s
            ORDER BY %s LIMIT $2) r
      ORDER BY %s|}
    Videogame.list_columns where order order

let cerca_req sql = Caqti_request.Infix.(Caqti_type.(t2 string int) ->* Caqti_type.string) sql

(* [order] usa i nomi delle colonne della SELECT interna: vale dentro e fuori. *)
let per_titolo = "titolo ASC NULLS LAST, id ASC"

(* Testo vuoto: i primi per titolo; $1 vale sempre '' (serve un tipo al parametro). *)
let cerca_tutti_req = cerca_req (cerca_sql ~where:"WHERE $1::text = ''" ~order:per_titolo)

let cerca_corto_req = cerca_req (cerca_sql ~where:"WHERE unaccent(v.titolo) ILIKE unaccent($1)" ~order:per_titolo)

let cerca_simile_req =
  cerca_req
    (cerca_sql ~where:"WHERE word_similarity(unaccent($1), unaccent(v.titolo)) > 0.25"
       ~order:"_sim DESC, titolo ASC, id ASC")

(* Lunghezza in caratteri (punti di codice UTF-8), non in byte. *)
let caratteri s =
  let n = ref 0 in
  String.iter (fun c -> if Char.code c land 0xC0 <> 0x80 then incr n) s;
  !n

let cerca_videogame req ~testo ~limite =
  if limite < 1 || limite > cerca_videogame_max
  then bad_request (Printf.sprintf "Parametro «limite»: deve essere tra 1 e %d" cerca_videogame_max);
  let testo = String.trim testo in
  let richiesta, parametro =
    if testo = ""
    then (cerca_tutti_req, "")
    else if caratteri testo < 6
    then
      ( cerca_corto_req,
        testo |> String.split_on_char ' ' |> List.map String.trim |> String.concat "%" |> Printf.sprintf "%%%s%%" )
    else (cerca_simile_req, testo)
  in
  let%lwt righe = db req (fun (module DB : DB) -> DB.collect_list richiesta (parametro, limite)) in
  Lwt.return (List.map parse righe)

let associazioni_sql =
  Printf.sprintf
    {|SELECT %s %s
      WHERE ($1::jsonb->'episodio_id' IS NULL OR a.episodio_id = ($1::jsonb->>'episodio_id')::bigint)
        AND ($1::jsonb->'videogame_id' IS NULL OR a.videogame_id = ($1::jsonb->>'videogame_id')::bigint)|}
    Associazioni.columns Associazioni.from

let elenco_associazioni req ~offset ~limit ~episodio_id ~videogame_id ~order =
  let id key v = Associazioni.id_filter (match v with Some i -> [(key, `Int i)] | None -> []) key in
  run_list req ~hidden:["_istante"] ~select_sql:associazioni_sql ~order ~offset ~limit
    ~filter:[("episodio_id", id "episodio_id" episodio_id); ("videogame_id", id "videogame_id" videogame_id)]

let utenti_sql =
  Printf.sprintf
    {|SELECT %s FROM auth_user u
      WHERE ($1::jsonb->>'q' IS NULL
             OR u.username ILIKE $1::jsonb->>'q' OR u.email ILIKE $1::jsonb->>'q'
             OR u.first_name ILIKE $1::jsonb->>'q' OR u.last_name ILIKE $1::jsonb->>'q')|}
    Utenti.columns

let elenco_utenti req ~offset ~limit ~ricerca ~order =
  run_list req ~select_sql:utenti_sql ~order ~offset ~limit ~filter:[("q", q ricerca)]

(* --- Episodi ----------------------------------------------------------- *)

let episodio req id = Lwt.map parse (Episodi.fetch_one req (Int64.of_int id))

let crea_episodio req body =
  let episodio, assoc = Episodi.parse_payload body in
  let assoc = Some (Option.value assoc ~default:"[]") in
  let%lwt () = Episodi.check_videogames req assoc in
  let%lwt id =
    db req (fun ((module DB : DB) as conn) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* id = DB.find Episodi.insert_req episodio in
            let* () = Episodi.replace_associazioni conn id assoc in
            Lwt.return_ok id))
  in
  Lwt.map parse (Episodi.fetch_one req id)

(* Come int64_param in /api/bo: un id non positivo è un 404 prima di validare il body. *)
let positive_id id = if id <= 0 then not_found () else Int64.of_int id

let aggiorna_episodio req id body =
  let id = positive_id id in
  let episodio, assoc = Episodi.parse_payload body in
  let%lwt () = Episodi.check_videogames req assoc in
  let%lwt found =
    db req (fun ((module DB : DB) as conn) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* found = DB.find_opt Episodi.update_req (id, episodio) in
            match found with
            | None -> Lwt.return_ok false
            | Some _ ->
              let* () = Episodi.replace_associazioni conn id assoc in
              Lwt.return_ok true))
  in
  if found then Lwt.map parse (Episodi.fetch_one req id) else not_found ()

let elimina_episodio req id =
  let id = Int64.of_int id in
  let%lwt j = Episodi.fetch_one req id in
  let%lwt () =
    db req (fun (module DB : DB) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* () = DB.exec Episodi.delete_assoc_req id in
            DB.exec Episodi.delete_req id))
  in
  Lwt.return (parse j)

(* --- Videogame e associazioni ------------------------------------------- *)

let videogame req id = Lwt.map parse (Videogame.fetch_one req (Int64.of_int id))

let crea_videogame req body =
  let p = Videogame.parse_payload body in
  let%lwt game = Rawg.fetch p.rawg_slug in
  let%lwt id =
    db ~unique_msg:Videogame.unique_msg req (fun (module DB : DB) ->
        DB.find Videogame.insert_req (Videogame.to_db_json p (Some game)))
  in
  Lwt.map parse (Videogame.fetch_one req id)

let aggiorna_videogame req id body =
  let id = positive_id id in
  let p = Videogame.parse_payload body in
  let%lwt game =
    match%lwt db req (fun (module DB : DB) -> DB.find_opt Videogame.has_rawg_json_req id) with
    | None -> not_found ()
    | Some true -> Lwt.return_none
    | Some false -> Lwt.map Option.some (Rawg.fetch p.rawg_slug)
  in
  match%lwt
    db ~unique_msg:Videogame.unique_msg req (fun (module DB : DB) ->
        DB.find_opt Videogame.update_req (id, Videogame.to_db_json p game))
  with
  | None -> not_found ()
  | Some _ -> Lwt.map parse (Videogame.fetch_one req id)

let elimina_videogame req id =
  let id = Int64.of_int id in
  let%lwt j = Videogame.fetch_one req id in
  let%lwt () =
    db req (fun (module DB : DB) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* () = DB.exec Videogame.delete_assoc_req id in
            DB.exec Videogame.delete_req id))
  in
  Lwt.return (parse j)

let associazione req id =
  match%lwt db req (fun (module DB : DB) -> DB.find_opt Associazioni.get_req (Int64.of_int id)) with
  | Some j -> Lwt.return (parse j)
  | None -> not_found ()

(* --- Utenti ------------------------------------------------------------ *)

(* auth_user.id è integer: fuori intervallo non può esistere (Utenti.int_param). *)
let utente_id id = if id <= 0 || id > Int32.to_int Int32.max_int then not_found () else id
let utente req id = Lwt.map parse (Utenti.fetch_one req (utente_id id))

let crea_utente req body =
  let ((_, _, _, _, _, password) as p) = Utenti.parse_payload ~require_password:true body in
  let%lwt hash = Utenti.hash_password req password in
  let%lwt id =
    db ~unique_msg:Utenti.unique_msg req (fun (module DB : DB) -> DB.find Utenti.insert_req (Utenti.to_db_json p hash))
  in
  Lwt.map parse (Utenti.fetch_one req id)

let aggiorna_utente req (me : Auth.user) id body =
  let id = utente_id id in
  let ((_, _, _, _, (is_staff, is_active, is_superuser), password) as p) =
    Utenti.parse_payload ~require_password:false body
  in
  if id = me.id && not (is_staff && is_active && is_superuser)
  then bad_request "Non puoi togliere a te stesso i privilegi di staff, attivo o superuser";
  let%lwt hash = Utenti.hash_password req password in
  match%lwt
    db ~unique_msg:Utenti.unique_msg req (fun (module DB : DB) ->
        DB.find_opt Utenti.update_req (id, Utenti.to_db_json p hash))
  with
  | None -> not_found ()
  | Some _ ->
    let%lwt () =
      match hash with
      | Some h when id = me.id -> Auth.set_session_password req h
      | _ -> Lwt.return_unit
    in
    Lwt.map parse (Utenti.fetch_one req id)

let elimina_utente req (me : Auth.user) id =
  let id = utente_id id in
  if id = me.id then bad_request "Non puoi cancellare te stesso";
  let%lwt j = Utenti.fetch_one req id in
  let%lwt () =
    db req (fun (module DB : DB) ->
        DB.with_transaction (fun () -> DB.exec Utenti.delete_req id))
  in
  Lwt.return (parse j)
