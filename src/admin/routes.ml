(* Rotte dell'API admin sotto /api/bo (ra-data-simple-rest + authProvider).

   Middleware dello scope, dall'esterno:
   - controllo Origin/Referer, sempre attivo (anche con DEBUG=True);
   - attributo Secure sul cookie fuori da DEBUG;
   - segreto per cifrare i cookie (DREAM_SECRET) e sessioni su cookie. *)

let session_lifetime = 14. *. 24. *. 3600. (* come SESSION_COOKIE_AGE di Django *)

let secret =
  match Settings.dream_secret with
  | Some s -> Dream.set_secret s
  | None -> Dream.no_middleware

let h = Resp.handle
let staff handler = Auth.require_staff (h handler)
let superuser handler = Auth.require_staff (Auth.require_superuser (h handler))

let crud ~path ~list ~get ?create ?update ?delete wrap =
  List.concat
    [
      [Dream.get path (wrap list); Dream.get (path ^ "/:id") (wrap get)];
      Option.fold ~none:[] ~some:(fun f -> [Dream.post path (wrap f)]) create;
      Option.fold ~none:[] ~some:(fun f -> [Dream.put (path ^ "/:id") (wrap f)]) update;
      Option.fold ~none:[] ~some:(fun f -> [Dream.delete (path ^ "/:id") (wrap f)]) delete;
    ]

let routes =
  Dream.scope "/api/bo"
    [Auth.origin_check; Auth.secure_cookie; secret; Dream.cookie_sessions ~lifetime:session_lifetime]
    (List.concat
       [
         [
           Dream.post "/login" (h Auth.login);
           Dream.post "/logout" (h Auth.logout);
           Dream.get "/me" (staff Auth.me);
           Dream.post "/episodi/:id/cover" (staff Episodi.upload_cover);
           Dream.delete "/episodi/:id/cover" (staff Episodi.delete_cover);
         ];
         crud ~path:"/episodi" ~list:Episodi.list ~get:Episodi.get ~create:Episodi.create ~update:Episodi.update
           ~delete:Episodi.delete staff;
         crud ~path:"/videogame" ~list:Videogame.list ~get:Videogame.get ~create:Videogame.create
           ~update:Videogame.update ~delete:Videogame.delete staff;
         crud ~path:"/associazioni" ~list:Associazioni.list ~get:Associazioni.get staff;
         crud ~path:"/utenti" ~list:Utenti.list ~get:Utenti.get ~create:Utenti.create ~update:Utenti.update
           ~delete:Utenti.delete superuser;
         [Dream.any "/**" (fun _ -> Resp.error_json `Not_Found "Endpoint inesistente")];
       ])

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
