(* POST /api/graphql, con lo stesso stack di /api/bo: la sessione è la stessa.

   - Solo POST: in GET Dream.graphql accetta un WebSocket, che eseguirebbe
     anche le mutation.
   - Niente route con wildcard: cambierebbe il Path del cookie di sessione. *)

let routes =
  Dream.scope "/api/graphql"
    [
      Admin.Auth.origin_check;
      Admin.Auth.secure_cookie;
      Admin.Routes.secret;
      Dream.cookie_sessions ~lifetime:Admin.Routes.session_lifetime;
    ]
    [Dream.post "" (Errori.wrap (Dream.graphql Lwt.return Contratto.schema))]

(* GraphiQL solo in sviluppo: in produzione DEBUG=False. *)
let graphiql =
  if Settings.debug then Dream.get "/api/graphiql" (Dream.graphiql "/api/graphql") else Dream.scope "/" [] []
