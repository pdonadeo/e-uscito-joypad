(* Risorsa "episodi": CRUD con le associazioni ai videogame annidate nel
   payload (array "associazioni"), come l'inline dell'admin Django. *)

open Resp
open Input

let speaker_choices = ["TUTT"; "BORD"; "FOSS"; "ZAMP"]
let tipologia_choices = ["FREE"; "RECE"; "CONS"; "STAR"]
let sql_literal s = "'" ^ String.concat "''" (String.split_on_char '\'' s) ^ "'"

(* URL pubblico della cover: MEDIA_URL ("bo/files/") + percorso salvato. *)
let cover_url_sql col =
  Printf.sprintf
    "CASE WHEN coalesce(%s, '') = '' THEN NULL ELSE %s || %s END"
    col
    (sql_literal ("/" ^ Settings.media_url))
    col

let columns =
  Printf.sprintf
    {|e.id, e.titolo, e.episodio_numero, e.data_uscita,
      to_char(e.durata, 'HH24:MI:SS') AS durata,
      e.cover, %s AS cover_url, e.url, e.url_video, e.url_post,
      e.note, e.descrizione_html, e.descrizione_txt, e.pubblicato, e.ts_created, e.ts|}
    (cover_url_sql "e.cover")

let associazioni_sql =
  {|coalesce((SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'videogame_id', a.videogame_id,
                'videogame_titolo', v.titolo,
                'istante', to_char(a.istante, 'HH24:MI:SS'),
                'speaker', a.speaker,
                'tipologia', a.tipologia) ORDER BY a.istante NULLS LAST, a.id)
              FROM backoffice_associazioneepisodiovideogame a
              JOIN backoffice_videogame v ON v.id = a.videogame_id
              WHERE a.episodio_id = e.id), '[]'::jsonb)|}

let get_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.string)
    (Printf.sprintf
       {|SELECT ((to_jsonb(r) - 'assoc') || jsonb_build_object('associazioni', r.assoc))::text
         FROM (SELECT %s, %s AS assoc FROM backoffice_episodio e WHERE e.id = $1) r|}
       columns
       associazioni_sql)

let fetch_one req id =
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt get_req id) in
  match%lwt or_fail r with
  | Some j -> Lwt.return j
  | None -> not_found ()

let list req =
  Ra_codec.run_list
    req
    ~resource:"episodi"
    ~select_sql:
      (Printf.sprintf
         {|SELECT %s FROM backoffice_episodio e
           WHERE ($1::jsonb->>'q' IS NULL
                  OR e.titolo ILIKE $1::jsonb->>'q' OR e.episodio_numero ILIKE $1::jsonb->>'q')
             AND ($1::jsonb->'id' IS NULL
                  OR e.id IN (SELECT jsonb_array_elements_text($1::jsonb->'id')::bigint))
             AND ($1::jsonb->'pubblicato' IS NULL OR e.pubblicato = ($1::jsonb->>'pubblicato')::boolean)|}
         columns)
    ~whitelist:
      [
        ("id", ["id"]);
        ("titolo", ["titolo"]);
        ("episodio_numero", ["episodio_numero"]);
        ("data_uscita", ["data_uscita"]);
        ("durata", ["durata"]);
        ("pubblicato", ["pubblicato"]);
        ("ts", ["ts"]);
      ]
    ~default:("data_uscita", Ra_codec.Desc)
    ~filter:(fun f ->
      [
        ("q", Ra_codec.q_filter f);
        ("id", Ra_codec.id_list_filter f "id");
        ("pubblicato", Ra_codec.bool_filter f "pubblicato");
      ])

let get req = Lwt.bind (fetch_one req (int64_param req "id")) json

(* --- Scrittura -------------------------------------------------------- *)

(* Valida il payload e restituisce (episodio, associazioni) come JSON pronti
   per PostgreSQL. [associazioni] è None se il campo è assente. *)
let parse_payload (body : Yojson.Safe.t) =
  let o = fields body in
  let episodio =
    `Assoc
      [
        ("titolo", j_str (string_req ~max:256 o "titolo"));
        ("episodio_numero", j_str_opt (string_opt ~max:32 o "episodio_numero"));
        ("data_uscita", j_str (date_req o "data_uscita"));
        ("durata", j_str (duration_req o "durata"));
        ("url", j_str_opt (url_opt o "url"));
        ("url_video", j_str_opt (url_opt o "url_video"));
        ("url_post", j_str_opt (url_opt o "url_post"));
        ("note", j_str_opt (text_opt o "note"));
        ("descrizione_html", j_str_opt (text_opt o "descrizione_html"));
        ("descrizione_txt", j_str_opt (text_opt o "descrizione_txt"));
        ("pubblicato", `Bool (bool_def o "pubblicato" ~default:false));
      ]
  in
  let associazioni =
    match field o "associazioni" with
    | None -> None
    | Some `Null -> Some []
    | Some (`List l) ->
      Some
        (List.mapi
           (fun i a ->
             let name f = Printf.sprintf "associazioni[%d].%s" i f in
             let a' = fields a in
             let id =
               match field a' "id" with
               | None | Some `Null -> `Null
               | Some j -> `Intlit (Int64.to_string (int64_of_json (name "id") j))
             in
             let videogame_id =
               match field a' "videogame_id" with
               | None | Some `Null -> invalid (name "videogame_id") "obbligatorio"
               | Some j -> int64_of_json (name "videogame_id") j
             in
             `Assoc
               [
                 ("id", id);
                 ("videogame_id", `Intlit (Int64.to_string videogame_id));
                 (* assente → 0:00:00 come il default Django; null o "" → NULL *)
                 ( "istante",
                   if field a' "istante" = None
                   then j_str "0:00:00"
                   else j_str_opt (Option.map (duration (name "istante")) (string_opt a' "istante")) );
                 ("speaker", j_str (choice a' "speaker" ~choices:speaker_choices ~default:"TUTT"));
                 ("tipologia", j_str (choice a' "tipologia" ~choices:tipologia_choices ~default:"FREE"));
               ])
           l)
    | Some _ -> invalid "associazioni" "deve essere un array"
  in
  (match associazioni with
  | None -> ()
  | Some l ->
    let ids =
      List.filter_map
        (function
          | `Assoc a -> (
            match List.assoc_opt "id" a with
            | Some (`Intlit i) -> Some i
            | _ -> None)
          | _ -> None)
        l
    in
    if List.length ids <> List.length (List.sort_uniq compare ids) then invalid "associazioni" "id duplicati");
  (Yojson.Safe.to_string episodio, Option.map (fun l -> Yojson.Safe.to_string (`List l)) associazioni)

let missing_videogames_req =
  Caqti_request.Infix.(Caqti_type.string ->! Caqti_type.string)
    {|SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb)::text FROM (
        SELECT DISTINCT (a->>'videogame_id')::bigint AS x FROM jsonb_array_elements($1::jsonb) a
        EXCEPT SELECT id FROM backoffice_videogame) s|}

let check_videogames req assoc =
  match assoc with
  | None -> Lwt.return_unit
  | Some assoc ->
    let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find missing_videogames_req assoc) in
    let%lwt missing = or_fail r in
    if missing = "[]" then Lwt.return_unit else bad_request ("Videogame inesistenti: " ^ missing)

let insert_req =
  Caqti_request.Infix.(Caqti_type.string ->! Caqti_type.int64)
    {|INSERT INTO backoffice_episodio
        (ts_created, ts, titolo, episodio_numero, data_uscita, durata, cover, url, url_video, url_post,
         note, descrizione_html, descrizione_txt, pubblicato)
      SELECT now(), now(), j->>'titolo', j->>'episodio_numero', (j->>'data_uscita')::date,
             (j->>'durata')::interval, NULL, j->>'url', j->>'url_video', j->>'url_post',
             j->>'note', j->>'descrizione_html', j->>'descrizione_txt', (j->>'pubblicato')::boolean
      FROM (SELECT $1::jsonb AS j) s
      RETURNING id|}

let update_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 string) ->? Caqti_type.int64)
    {|UPDATE backoffice_episodio e SET
        ts = now(),
        titolo = j->>'titolo',
        episodio_numero = j->>'episodio_numero',
        data_uscita = (j->>'data_uscita')::date,
        durata = (j->>'durata')::interval,
        url = j->>'url',
        url_video = j->>'url_video',
        url_post = j->>'url_post',
        note = j->>'note',
        descrizione_html = j->>'descrizione_html',
        descrizione_txt = j->>'descrizione_txt',
        pubblicato = (j->>'pubblicato')::boolean
      FROM (SELECT $2::jsonb AS j) s
      WHERE e.id = $1
      RETURNING e.id|}

(* Sostituzione delle associazioni, in tre passi dentro la transazione:
   1. cancella quelle dell'episodio non più presenti nel payload;
   2. aggiorna quelle con un id che appartiene all'episodio;
   3. inserisce le altre (senza id, o con un id estraneo all'episodio). *)
let assoc_delete_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 string) ->. Caqti_type.unit)
    {|DELETE FROM backoffice_associazioneepisodiovideogame
      WHERE episodio_id = $1
        AND id NOT IN (SELECT (a->>'id')::bigint FROM jsonb_array_elements($2::jsonb) a
                       WHERE a->>'id' IS NOT NULL)|}

let assoc_update_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 string) ->. Caqti_type.unit)
    {|UPDATE backoffice_associazioneepisodiovideogame x SET
        ts = now(),
        videogame_id = (a->>'videogame_id')::bigint,
        istante = (a->>'istante')::interval,
        speaker = a->>'speaker',
        tipologia = a->>'tipologia'
      FROM jsonb_array_elements($2::jsonb) a
      WHERE x.episodio_id = $1 AND x.id = (a->>'id')::bigint|}

let assoc_insert_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 string) ->. Caqti_type.unit)
    {|INSERT INTO backoffice_associazioneepisodiovideogame
        (ts_created, ts, istante, speaker, tipologia, episodio_id, videogame_id)
      SELECT now(), now(), (a->>'istante')::interval, a->>'speaker', a->>'tipologia', $1,
             (a->>'videogame_id')::bigint
      FROM jsonb_array_elements($2::jsonb) a
      WHERE a->>'id' IS NULL
         OR NOT EXISTS (SELECT 1 FROM backoffice_associazioneepisodiovideogame y
                        WHERE y.id = (a->>'id')::bigint AND y.episodio_id = $1)|}

let replace_associazioni (module DB : Caqti_lwt.CONNECTION) id = function
  | None -> Lwt.return_ok ()
  | Some assoc ->
    let open Lwt_result.Syntax in
    let* () = DB.exec assoc_delete_req (id, assoc) in
    let* () = DB.exec assoc_update_req (id, assoc) in
    DB.exec assoc_insert_req (id, assoc)

let create req =
  let%lwt body = json_body req in
  let episodio, assoc = parse_payload body in
  let assoc = Some (Option.value assoc ~default:"[]") in
  let%lwt () = check_videogames req assoc in
  let%lwt r =
    Dream.sql req (fun ((module DB : Caqti_lwt.CONNECTION) as db) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* id = DB.find insert_req episodio in
            let* () = replace_associazioni db id assoc in
            Lwt.return_ok id))
  in
  let%lwt id = or_fail r in
  let%lwt j = fetch_one req id in
  json ~status:`Created j

let update req =
  let id = int64_param req "id" in
  let%lwt body = json_body req in
  let episodio, assoc = parse_payload body in
  let%lwt () = check_videogames req assoc in
  let%lwt r =
    Dream.sql req (fun ((module DB : Caqti_lwt.CONNECTION) as db) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* found = DB.find_opt update_req (id, episodio) in
            match found with
            | None -> Lwt.return_ok false
            | Some _ ->
              let* () = replace_associazioni db id assoc in
              Lwt.return_ok true))
  in
  match%lwt or_fail r with
  | false -> not_found ()
  | true -> Lwt.bind (fetch_one req id) json

let delete_assoc_req =
  Caqti_request.Infix.(Caqti_type.int64 ->. Caqti_type.unit)
    "DELETE FROM backoffice_associazioneepisodiovideogame WHERE episodio_id = $1"

let delete_req =
  Caqti_request.Infix.(Caqti_type.int64 ->. Caqti_type.unit) "DELETE FROM backoffice_episodio WHERE id = $1"

let delete req =
  let id = int64_param req "id" in
  let%lwt j = fetch_one req id in
  let%lwt r =
    Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) ->
        DB.with_transaction (fun () ->
            let open Lwt_result.Syntax in
            let* () = DB.exec delete_assoc_req id in
            DB.exec delete_req id))
  in
  let%lwt () = or_fail r in
  json j

(* --- Cover ------------------------------------------------------------ *)

let numero_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.(option string))
    "SELECT episodio_numero FROM backoffice_episodio WHERE id = $1"

let set_cover_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 (option string)) ->. Caqti_type.unit)
    "UPDATE backoffice_episodio SET cover = $2, ts = now() WHERE id = $1"

let upload_cover req =
  let id = int64_param req "id" in
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt numero_req id) in
  let%lwt numero =
    match%lwt or_fail r with
    | None -> not_found ()
    | Some n -> Lwt.return n
  in
  let%lwt filename, data = Media.read_upload req in
  let%lwt path = Media.save_cover ~episodio_numero:numero ~filename data in
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.exec set_cover_req (id, Some path)) in
  let%lwt () =
    match r with
    | Ok () -> Lwt.return_unit
    | Error e ->
      let%lwt () = Media.remove path in
      caqti_fail e
  in
  Lwt.bind (fetch_one req id) json

(* Come il "Cancella" di Django: azzera il campo, il file resta su disco. *)
let delete_cover req =
  let id = int64_param req "id" in
  let%lwt _ = fetch_one req id in
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.exec set_cover_req (id, None)) in
  let%lwt () = or_fail r in
  Lwt.bind (fetch_one req id) json
