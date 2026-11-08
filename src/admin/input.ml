(* Lettura e validazione dei campi dei payload JSON inviati dall'admin.
   Ogni errore solleva [Resp.Http_error] 400 con il nome del campo. *)

open Resp

type obj = (string * Yojson.Safe.t) list

let fields : Yojson.Safe.t -> obj = function
  | `Assoc l -> l
  | _ -> bad_request "Atteso un oggetto JSON"

let field (o : obj) name = List.assoc_opt name o

let invalid name what = bad_request (Printf.sprintf "Campo «%s»: %s" name what)

(* Lunghezza in caratteri (UTF-8), come la contano i varchar di PostgreSQL. *)
let utf8_length s =
  let n = ref 0 in
  String.iter (fun c -> if Char.code c land 0xC0 <> 0x80 then incr n) s;
  !n

(* Tronca a [max] caratteri senza spezzare una sequenza UTF-8. *)
let utf8_truncate max s =
  let n = ref 0 and cut = ref (String.length s) in
  (try
     String.iteri
       (fun i c ->
         if Char.code c land 0xC0 <> 0x80
         then begin
           if !n = max then (cut := i; raise Exit);
           incr n
         end)
       s
   with Exit -> ());
  String.sub s 0 !cut

let check_length name max s =
  if utf8_length s > max then invalid name (Printf.sprintf "massimo %d caratteri" max) else s

(* Stringa opzionale: assente, null o vuota (dopo trim) diventano None. *)
let string_opt ?(max = max_int) o name =
  match field o name with
  | None | Some `Null -> None
  | Some (`String s) ->
    let s = String.trim s in
    if s = "" then None else Some (check_length name max s)
  | Some (`Int i) -> Some (string_of_int i)
  | Some _ -> invalid name "deve essere una stringa"

let string_req ?max o name =
  match string_opt ?max o name with
  | Some s -> s
  | None -> invalid name "obbligatorio"

(* Testo libero: come [string_opt] ma senza trim del contenuto. *)
let text_opt o name =
  match field o name with
  | None | Some `Null -> None
  | Some (`String s) -> if String.trim s = "" then None else Some s
  | Some _ -> invalid name "deve essere una stringa"

let bool_def o name ~default =
  match field o name with
  | None | Some `Null -> default
  | Some (`Bool b) -> b
  | Some _ -> invalid name "deve essere true o false"

let int64_of_json name = function
  | `Int i when i > 0 -> Int64.of_int i
  | `Intlit s | `String s -> (
    match Int64.of_string_opt s with
    | Some i when i > 0L -> i
    | _ -> invalid name "deve essere un intero positivo")
  | _ -> invalid name "deve essere un intero positivo"

let all_digits s = s <> "" && String.for_all (function '0' .. '9' -> true | _ -> false) s

(* Durata "H:MM:SS" (o "MM:SS"), normalizzata in "H:MM:SS" per il cast a interval. *)
let duration name s =
  let parts = String.split_on_char ':' (String.trim s) in
  let h, m, sec =
    match parts with
    | [h; m; s] -> (h, m, s)
    | [m; s] -> ("0", m, s)
    | _ -> invalid name "formato atteso HH:MM:SS"
  in
  if not (List.for_all all_digits [h; m; sec])
     || String.length h > 4 || String.length m > 2 || String.length sec > 2
  then invalid name "formato atteso HH:MM:SS";
  let m = int_of_string m and sec = int_of_string sec in
  if m > 59 || sec > 59 then invalid name "minuti e secondi devono essere minori di 60";
  Printf.sprintf "%d:%02d:%02d" (int_of_string h) m sec

let duration_req o name = duration name (string_req o name)

let date_req o name =
  let s = string_req o name in
  match Timedesc.Date.of_iso8601 s with
  | Ok d -> Timedesc.Date.to_rfc3339 d
  | Error _ -> invalid name "data non valida (formato AAAA-MM-GG)"

let url_opt ?(max = 256) o name =
  match string_opt ~max o name with
  | None -> None
  | Some u ->
    let lower = String.lowercase_ascii u in
    let has_prefix p = String.length lower > String.length p && String.sub lower 0 (String.length p) = p in
    if (has_prefix "http://" || has_prefix "https://") && not (String.contains u ' ')
    then Some u
    else invalid name "URL non valido"

let choice o name ~choices ~default =
  match string_opt o name with
  | None -> default
  | Some v when List.mem v choices -> v
  | Some _ -> invalid name ("valori ammessi: " ^ String.concat ", " choices)

(* Helpers per costruire il JSON passato a PostgreSQL. *)
let j_str s : Yojson.Safe.t = `String s
let j_opt f : 'a option -> Yojson.Safe.t = function None -> `Null | Some x -> f x
let j_str_opt o = j_opt j_str o

(* Pattern ILIKE "contiene", con escape dei metacaratteri. *)
let like_pattern s =
  let b = Buffer.create (String.length s + 2) in
  Buffer.add_char b '%';
  String.iter
    (fun c ->
      (match c with '%' | '_' | '\\' -> Buffer.add_char b '\\' | _ -> ());
      Buffer.add_char b c)
    s;
  Buffer.add_char b '%';
  Buffer.contents b
