(* Codec dei parametri di lista di ra-data-simple-rest:

     GET /api/bo/<res>?sort=["campo","ASC"]&range=[0,24]&filter={"q":"..."}

   La risposta è un array JSON con l'header [Content-Range: <res> a-b/totale]. *)

open Resp

type dir = Asc | Desc

type list_params = {
  sort : (string * dir) option;
  range : (int * int) option;
  filter : Input.obj;
}

let parse_json_param req name =
  match Dream.query req name with
  | None | Some "" -> None
  | Some s -> (
    try Some (Yojson.Safe.from_string s)
    with Yojson.Json_error _ -> bad_request (Printf.sprintf "Parametro «%s» non valido" name))

let max_page = 1000

let parse req =
  let sort =
    match parse_json_param req "sort" with
    | None -> None
    | Some (`List [`String f; `String d]) -> (
      match String.uppercase_ascii d with
      | "ASC" -> Some (f, Asc)
      | "DESC" -> Some (f, Desc)
      | _ -> bad_request "Parametro «sort» non valido")
    | Some _ -> bad_request "Parametro «sort» non valido"
  in
  let range =
    match parse_json_param req "range" with
    | None -> None
    | Some (`List [`Int a; `Int b]) when a >= 0 && b >= a ->
      if b - a >= max_page then bad_request (Printf.sprintf "Parametro «range»: al massimo %d righe" max_page);
      Some (a, b)
    | Some _ -> bad_request "Parametro «range» non valido"
  in
  let filter =
    match parse_json_param req "filter" with
    | None -> []
    | Some (`Assoc l) -> l
    | Some _ -> bad_request "Parametro «filter» non valido"
  in
  { sort; range; filter }

(* [filter.id] (getMany): lista di id interi, normalizzata in JSON. *)
let id_list_filter (filter : Input.obj) key =
  match List.assoc_opt key filter with
  | None | Some `Null -> None
  | Some (`List l) -> Some (`List (List.map (fun j -> `Intlit (Int64.to_string (Input.int64_of_json key j))) l))
  | Some j -> Some (`List [`Intlit (Int64.to_string (Input.int64_of_json key j))])

let q_filter (filter : Input.obj) =
  match List.assoc_opt "q" filter with
  | Some (`String s) when String.trim s <> "" -> Some (`String (Input.like_pattern (String.trim s)))
  | _ -> None

let bool_filter (filter : Input.obj) key =
  match List.assoc_opt key filter with
  | Some (`Bool b) -> Some (`Bool b)
  | None | Some `Null -> None
  | Some _ -> bad_request (Printf.sprintf "Filtro «%s» non valido" key)

(* Costruisce l'oggetto JSON dei filtri passato come $1 alla query. *)
let filter_json (l : (string * Yojson.Safe.t option) list) : string =
  `Assoc (List.filter_map (fun (k, v) -> Option.map (fun v -> (k, v)) v) l) |> Yojson.Safe.to_string

(* [order_by] trasforma il sort richiesto in SQL. [whitelist] associa il nome del
   campo esposto alle colonne della CTE; un campo fuori whitelist è un 400.
   [id] chiude sempre l'ordinamento per renderlo stabile. *)
let order_by ~whitelist ~default p =
  let field, dir = Option.value p.sort ~default in
  let cols =
    match List.assoc_opt field whitelist with
    | Some c -> c
    | None -> bad_request (Printf.sprintf "Ordinamento non consentito sul campo «%s»" field)
  in
  let d = match dir with Asc -> "ASC" | Desc -> "DESC" in
  String.concat ", " (List.map (fun c -> Printf.sprintf "%s %s NULLS LAST" c d) (cols @ ["id"]))

let list_req =
  let cache = Hashtbl.create 16 in
  fun sql ->
    match Hashtbl.find_opt cache sql with
    | Some r -> r
    | None ->
      let r = Caqti_request.Infix.(Caqti_type.(t3 string (option int) int) ->! Caqti_type.(t2 int64 string)) sql in
      Hashtbl.replace cache sql r;
      r

(* Esegue la lista. [select_sql] è una SELECT che usa $1::jsonb per i filtri ed
   espone almeno la colonna [id]; il risultato è (totale, array JSON).
   Le colonne [hidden] servono solo a ordinare e vengono tolte dal JSON.
   LIMIT e OFFSET sono parametri ($2, $3; LIMIT NULL = tutte le righe): il testo
   SQL dipende solo da risorsa, campo in whitelist e direzione, quindi la cache
   delle query preparate resta piccola. *)
let run_list ?(hidden = []) ~resource ~select_sql ~whitelist ~default ~filter req =
  let p = parse req in
  let order = order_by ~whitelist ~default p in
  let limit, offset =
    match p.range with
    | None -> (None, 0)
    | Some (a, b) -> (Some (b - a + 1), a)
  in
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
  let filter = filter_json (filter p.filter) in
  let%lwt result = Dream.sql req (fun (module DB : Caqti_lwt.CONNECTION) -> DB.find (list_req sql) (filter, limit, offset)) in
  let%lwt total, rows = or_fail result in
  let total = Int64.to_int total in
  let returned = match Yojson.Safe.from_string rows with `List l -> List.length l | _ -> 0 in
  let range =
    if returned = 0
    then Printf.sprintf "%s */%d" resource total
    else Printf.sprintf "%s %d-%d/%d" resource offset (offset + returned - 1) total
  in
  json ~headers:[("Content-Range", range)] rows
