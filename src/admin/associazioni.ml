(* Risorsa "associazioni" in sola lettura: serve a getManyReference di
   react-admin (es. gli episodi in cui è citato un videogame). Le scritture
   passano dall'episodio, che le possiede (inline Django). *)

open Resp

let columns =
  {|a.id, a.episodio_id, a.videogame_id,
    to_char(a.istante, 'HH24:MI:SS') AS istante, a.speaker, a.tipologia,
    v.titolo AS videogame_titolo, e.titolo AS episodio_titolo,
    e.episodio_numero, e.data_uscita, a.istante AS _istante|}

let from =
  {|FROM backoffice_associazioneepisodiovideogame a
    JOIN backoffice_episodio e ON e.id = a.episodio_id
    JOIN backoffice_videogame v ON v.id = a.videogame_id|}

let get_req =
  Caqti_request.Infix.(Caqti_type.int64 ->? Caqti_type.string)
    (Printf.sprintf "SELECT (to_jsonb(r) - '_istante')::text FROM (SELECT %s %s WHERE a.id = $1) r" columns from)

let get req =
  let id = int64_param req "id" in
  let%lwt r = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find_opt get_req id) in
  match%lwt or_fail r with
  | Some j -> json j
  | None -> not_found ()

let id_filter f key =
  match List.assoc_opt key f with
  | None | Some `Null -> None
  | Some j -> Some (`Intlit (Int64.to_string (Input.int64_of_json key j)))

(* L'ordinamento di default è quello dell'inline Django: data episodio, istante.
   "_istante" (interval) serve solo a ordinare e viene tolto dal JSON. *)
let list req =
  Ra_codec.run_list req ~hidden:["_istante"] ~resource:"associazioni"
    ~select_sql:
      (Printf.sprintf
         {|SELECT %s %s
           WHERE ($1::jsonb->'episodio_id' IS NULL OR a.episodio_id = ($1::jsonb->>'episodio_id')::bigint)
             AND ($1::jsonb->'videogame_id' IS NULL OR a.videogame_id = ($1::jsonb->>'videogame_id')::bigint)
             AND ($1::jsonb->'id' IS NULL
                  OR a.id IN (SELECT jsonb_array_elements_text($1::jsonb->'id')::bigint))|}
         columns from)
    ~whitelist:
      [
        ("id", ["id"]);
        ("data_uscita", ["data_uscita"; "_istante"]);
        ("istante", ["_istante"]);
        ("speaker", ["speaker"]);
        ("tipologia", ["tipologia"]);
        ("videogame_titolo", ["videogame_titolo"]);
        ("episodio_titolo", ["episodio_titolo"]);
      ]
    ~default:("data_uscita", Ra_codec.Asc)
    ~filter:(fun f ->
      [
        ("episodio_id", id_filter f "episodio_id");
        ("videogame_id", id_filter f "videogame_id");
        ("id", Ra_codec.id_list_filter f "id");
      ])
