(* Scope /api/bo: dopo la rimozione della REST di react-admin restano solo
   l'upload e la rimozione della cover di un episodio (multipart, fuori da
   GraphQL). Tutto il resto passa da /api/graphql.

   Middleware dello scope, dall'esterno:
   - controllo Origin/Referer, sempre attivo (anche con DEBUG=True);
   - attributo Secure sul cookie fuori da DEBUG;
   - segreto per cifrare i cookie (DREAM_SECRET) e sessioni su cookie.

   [secret] e [session_lifetime] li usa anche GraphQL, così la sessione è
   condivisa. *)

let session_lifetime = 14. *. 24. *. 3600. (* come SESSION_COOKIE_AGE di Django *)

let secret =
  match Settings.dream_secret with
  | Some s -> Dream.set_secret s
  | None -> Dream.no_middleware

let h = Resp.handle
let staff handler = Auth.require_staff (h handler)

let routes =
  Dream.scope "/api/bo"
    [Auth.origin_check; Auth.secure_cookie; secret; Dream.cookie_sessions ~lifetime:session_lifetime]
    [
      Dream.post "/episodi/:id/cover" (staff Episodi.upload_cover);
      Dream.delete "/episodi/:id/cover" (staff Episodi.delete_cover);
      Dream.any "/**" (fun _ -> Resp.error_json `Not_Found "Endpoint inesistente");
    ]

(* Error handler: per /api/bo la risposta dell'handler (JSON {"message": ...})
   passa invariata; se è vuota (eccezione non gestita) diventa un JSON
   generico. Per le altre rotte si usa [fallback]. Senza questo, il
   debug_error_handler di Dream sostituirebbe il JSON con una pagina HTML che
   riporta anche gli header della richiesta, cookie di sessione compreso. *)
let api_error_handler =
  Dream.error_template (fun _error _debug_dump response ->
      let%lwt body = Dream.body response in
      if body = ""
      then begin
        let status = Dream.status response in
        Dream.set_header response "Content-Type" Dream.application_json;
        Dream.set_body response
          (Yojson.Safe.to_string (`Assoc [("message", `String (Dream.status_to_string status))]))
      end;
      Lwt.return response)

let error_handler ~(fallback : Dream.error_handler) ~is_admin_api : Dream.error_handler =
 fun error ->
  match error.request with
  | Some req when is_admin_api req -> api_error_handler error
  | _ -> fallback error
