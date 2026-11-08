(* Risposte HTTP ed errori comuni alle API dell'admin.

   Gli handler segnalano gli errori sollevando [Http_error]; [handle] li converte
   in una risposta JSON [{"message": ...}], il formato che ra-data-simple-rest
   mostra all'utente. *)

let log = Dream.sub_log "admin"

exception Http_error of Dream.status * string

let fail status msg = raise (Http_error (status, msg))
let bad_request msg = fail `Bad_Request msg
let not_found () = fail `Not_Found "Risorsa non trovata"

let json ?(status = `OK) ?(headers = []) (body : string) = Dream.json ~status ~headers body
let json_of_yojson ?status ?headers (j : Yojson.Safe.t) = json ?status ?headers (Yojson.Safe.to_string j)
let error_json status msg = json_of_yojson ~status (`Assoc [("message", `String msg)])

(* Converte un errore Caqti in [Http_error]. Le violazioni di vincolo diventano
   4xx con un messaggio comprensibile, il resto è un 500 loggato. *)
let caqti_fail ?(unique_msg = "Esiste già un record con questi dati") (e : Caqti_error.t) =
  let cause =
    match e with
    | (`Request_failed _ | `Response_failed _) as e -> Some (Caqti_error.cause e)
    | _ -> None
  in
  match cause with
  | Some `Unique_violation -> fail `Conflict unique_msg
  | Some `Foreign_key_violation -> fail `Bad_Request "Riferimento a un record inesistente"
  | Some (`Not_null_violation | `Check_violation) ->
    fail `Bad_Request "Dati non validi"
  | _ ->
    log.error (fun m -> m "Errore database: %s" (Caqti_error.show e));
    fail `Internal_Server_Error "Errore del database"

let or_fail ?unique_msg = function
  | Ok x -> Lwt.return x
  | Error e -> caqti_fail ?unique_msg e

(* Avvolge un handler: ogni eccezione diventa una risposta JSON. *)
let handle (f : Dream.handler) : Dream.handler =
 fun req ->
  try%lwt f req with
  | Http_error (status, msg) -> error_json status msg
  | Yojson.Json_error msg -> error_json `Bad_Request ("JSON non valido: " ^ msg)
  | Yojson.Safe.Util.Type_error (msg, _) -> error_json `Bad_Request ("JSON non valido: " ^ msg)
  | exn ->
    log.error (fun m -> m ~request:req "Eccezione non gestita: %s" (Printexc.to_string exn));
    error_json `Internal_Server_Error "Errore interno"

let int64_param req name =
  match Int64.of_string_opt (Dream.param req name) with
  | Some id when id > 0L -> id
  | _ -> not_found ()

let json_body req =
  let%lwt body = Dream.body req in
  match Yojson.Safe.from_string body with
  | `Assoc _ as j -> Lwt.return j
  | _ -> bad_request "Il corpo della richiesta deve essere un oggetto JSON"
