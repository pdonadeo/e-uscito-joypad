(* Errori di /api/graphql (docs/schema.graphql; spike GraphQL del 2026-11-15, commit 5ea0a28).

   Graphql_lwt non ha extensions nei suoi errori di campo. I resolver sollevano
   [Admin.Resp.Http_error] come gli handler di /api/bo; [guard] lo trasforma nel
   messaggio "CODICE: testo" e [wrap], attorno a Dream.graphql, sposta il codice
   in errors[].extensions.code. *)

open Admin.Resp

let code_of_status : Dream.status -> string = function
  | `Unauthorized -> "UNAUTHENTICATED"
  | `Forbidden -> "FORBIDDEN"
  | `Bad_Request | `Conflict -> "BAD_USER_INPUT"
  | `Not_Found -> "NOT_FOUND"
  | `Too_Many_Requests -> "RATE_LIMITED"
  | `Bad_Gateway | `Gateway_Timeout -> "UPSTREAM_ERROR"
  | _ -> "INTERNAL"

let codes =
  ["UNAUTHENTICATED"; "FORBIDDEN"; "BAD_USER_INPUT"; "NOT_FOUND"; "RATE_LIMITED"; "UPSTREAM_ERROR"; "INTERNAL"]

let guard f =
  try%lwt Lwt.map Result.ok (f ()) with
  | Http_error (status, msg) -> Lwt.return_error (code_of_status status ^ ": " ^ msg)
  | exn ->
    log.error (fun m -> m "GraphQL: eccezione non gestita: %s" (Printexc.to_string exn));
    Lwt.return_error "INTERNAL: Errore interno"

(* Una risposta d'errore di un handler di src/admin ({"message": ...}) torna a
   essere un [Http_error]: serve agli adattatori che riusano quegli handler. *)
let raise_response resp =
  let%lwt body = Dream.body resp in
  let msg =
    match Yojson.Safe.from_string body with
    | `Assoc l -> ( match List.assoc_opt "message" l with Some (`String m) -> m | _ -> body)
    | _ -> body
    | exception Yojson.Json_error _ -> body
  in
  fail (Dream.status resp) msg

(* Un messaggio senza codice viene dalla libreria (sintassi, validazione). *)
let split_code msg =
  let with_code c =
    let prefix = c ^ ": " in
    if String.starts_with ~prefix msg
    then Some (c, String.sub msg (String.length prefix) (String.length msg - String.length prefix))
    else None
  in
  Option.value (List.find_map with_code codes) ~default:("GRAPHQL_VALIDATION", msg)

let rewrite_error : Yojson.Basic.t -> Yojson.Basic.t = function
  | `Assoc fields ->
    let msg = match List.assoc_opt "message" fields with Some (`String m) -> m | _ -> "" in
    let code, msg = split_code msg in
    let rest = List.filter (fun (k, _) -> k <> "message" && k <> "extensions") fields in
    `Assoc ((("message", `String msg) :: rest) @ [("extensions", `Assoc [("code", `String code)])])
  | j -> j

let error_response ?status code msg =
  let error : Yojson.Basic.t = `Assoc [("message", `String msg); ("extensions", `Assoc [("code", `String code)])] in
  Dream.json ?status (Yojson.Basic.to_string (`Assoc [("errors", `List [error])]))

let bad_input = error_response ~status:`Bad_Request "BAD_USER_INPUT"

(* Il lexer di graphql_parser solleva Failure su alcune query (un intero troppo
   grande, un escape \u, una stringa non chiusa) e Dream.graphql non la
   intercetta. Per distinguere quel caso da un errore interno si rianalizza la
   query: in tutti e due i casi la risposta resta errors[] con status 200. *)
let unhandled req exn =
  let%lwt body = Dream.body req in
  let lexer_failure =
    match Yojson.Basic.Util.(member "query" (Yojson.Basic.from_string body) |> to_string) with
    | query -> ( match Graphql_parser.parse query with _ -> false | exception Failure _ -> true)
    | exception _ -> false
  in
  if lexer_failure
  then error_response "GRAPHQL_VALIDATION" "Query non valida"
  else begin
    log.error (fun m -> m ~request:req "GraphQL: eccezione non gestita: %s" (Printexc.to_string exn));
    error_response "INTERNAL" "Errore interno"
  end

let wrap (inner : Dream.handler) : Dream.handler =
 fun req ->
  match%lwt inner req with
  | exception Yojson.Json_error msg -> bad_input ("JSON non valido: " ^ msg)
  | exception Yojson.Basic.Util.Type_error (msg, _) -> bad_input ("Corpo della richiesta GraphQL non valido: " ^ msg)
  | exception exn -> unhandled req exn
  | resp -> (
    let%lwt body = Dream.body resp in
    (* Dream.graphql risponde 400 senza corpo se il Content-Type non è esatto *)
    if Dream.status resp = `Bad_Request && body = ""
    then bad_input "Content-Type deve essere application/json"
    else
      match Yojson.Basic.from_string body with
      | `Assoc fields ->
        let fields =
          List.map (function "errors", `List l -> ("errors", `List (List.map rewrite_error l)) | kv -> kv) fields
        in
        Dream.set_body resp (Yojson.Basic.to_string (`Assoc fields));
        Lwt.return resp
      | _ -> Lwt.return resp
      | exception Yojson.Json_error _ -> Lwt.return resp)
