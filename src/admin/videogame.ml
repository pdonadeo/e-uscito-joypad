(* Risorsa "videogame". Al salvataggio, se rawg_json è vuoto, i dati vengono
   presi da RAWG (titolo, descrizioni, cover, json), come il pre_save Django.
   rawg_json è in sola lettura per il client. *)

open Resp
open Input

let list_columns = "v.id, v.titolo, v.rawg_slug, v.cover, v.ts"

let full_columns =
  "v.id, v.titolo, v.rawg_slug, v.cover, v.descrizione_raw, v.descrizione_html, v.rawg_json, v.ts_created, v.ts"

let get_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.string)
    (Printf.sprintf "SELECT to_jsonb(r)::text FROM (SELECT %s FROM backoffice_videogame v WHERE v.id = $1) r"
       full_columns)

let fetch_one req id =
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt get_req id) in
  match%lwt or_fail r with
  | Some j -> Lwt.return j
  | None -> not_found ()

type payload = {
  rawg_slug : string;
  titolo : string option;
  descrizione_html : string option;
  descrizione_raw : string option;
  cover : string option;
}

let parse_payload body =
  let o = fields body in
  let rawg_slug = string_req ~max:256 o "rawg_slug" in
  if not (Rawg.valid_slug rawg_slug) then invalid "rawg_slug" "solo lettere, cifre, «-» e «_»";
  {
    rawg_slug;
    titolo = string_opt ~max:256 o "titolo";
    descrizione_html = text_opt o "descrizione_html";
    descrizione_raw = text_opt o "descrizione_raw";
    cover = url_opt ~max:200 o "cover";
  }

let truncate_title = utf8_truncate 256
let truncate_cover = utf8_truncate 200

(* Applica i dati RAWG al payload; rawg_json resta NULL se non si è fatto fetch. *)
let to_db_json (p : payload) (rawg : Rawg.game option) =
  let p, rawg_json =
    match rawg with
    | None -> (p, `Null)
    | Some g ->
      ( {
          p with
          titolo = Some (truncate_title g.titolo);
          descrizione_html = g.descrizione_html;
          descrizione_raw = g.descrizione_raw;
          cover = Option.map truncate_cover g.cover;
        },
        `String g.json )
  in
  `Assoc
    [
      ("rawg_slug", j_str p.rawg_slug);
      ("titolo", j_str_opt p.titolo);
      ("descrizione_html", j_str_opt p.descrizione_html);
      ("descrizione_raw", j_str_opt p.descrizione_raw);
      ("cover", j_str_opt p.cover);
      ("rawg_json", rawg_json);
    ]
  |> Yojson.Safe.to_string

let unique_msg = "Esiste già un videogame con questo slug RAWG"

let insert_req =
  Caqti_request.Infix.(Caqti_type.string ->! Caqti_type.int64)
    {|INSERT INTO backoffice_videogame
        (ts_created, ts, titolo, descrizione_html, descrizione_raw, cover, rawg_slug, rawg_json)
      SELECT now(), now(), j->>'titolo', j->>'descrizione_html', j->>'descrizione_raw', j->>'cover',
             j->>'rawg_slug', (j->>'rawg_json')::jsonb
      FROM (SELECT $1::jsonb AS j) s
      RETURNING id|}

let has_rawg_json_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.bool)
    "SELECT rawg_json IS NOT NULL AND rawg_json <> 'null'::jsonb FROM backoffice_videogame WHERE id = $1"

(* rawg_json non viene mai sovrascritto dal client: se è già presente resta
   quello, altrimenti viene preso da RAWG. *)
let update_req =
  Caqti_request.Infix.(Caqti_type.(t2 int64 string) ->? Caqti_type.int64)
    {|UPDATE backoffice_videogame v SET
        ts = now(),
        titolo = j->>'titolo',
        descrizione_html = j->>'descrizione_html',
        descrizione_raw = j->>'descrizione_raw',
        cover = j->>'cover',
        rawg_slug = j->>'rawg_slug',
        rawg_json = coalesce((j->>'rawg_json')::jsonb, v.rawg_json)
      FROM (SELECT $2::jsonb AS j) s
      WHERE v.id = $1
      RETURNING v.id|}

let delete_assoc_req =
  Caqti_request.Infix.(Caqti_type.int64 ->. Caqti_type.unit)
    "DELETE FROM backoffice_associazioneepisodiovideogame WHERE videogame_id = $1"

let delete_req =
  Caqti_request.Infix.(Caqti_type.int64 ->. Caqti_type.unit) "DELETE FROM backoffice_videogame WHERE id = $1"
