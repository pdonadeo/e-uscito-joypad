open Dream

let will_stop, stop_now = Lwt.wait ()

let signal_handler s =
  log "Exiting on signal %d" s;
  Lwt.wakeup stop_now ()

let _ = Lwt_unix.on_signal 15 signal_handler
let _ = Lwt_unix.on_signal 2 signal_handler

let level =
  match Settings.debug with
  | true -> `Debug
  | false -> `Info

let () = initialize_log ~level ()
let log = Dream.sub_log "server"

let () =
  List.iter (fun src ->
      match Logs.Src.name src with
      | "cohttp.lwt.io" | "cohttp.lwt.server" | "tls.tracing" | "tls.config" -> Logs.Src.set_level src None
      | _ -> ())
  @@ Logs.Src.list ()

let loader root path _request =
  match Static_filesystem.read (root ^ "/" ^ path) with
  | None -> Dream.empty `Not_Found
  | Some asset -> Dream.respond asset

let with_noindex_follow handler req =
  let%lwt resp = handler req in
  let () = Dream.add_header resp "X-Robots-Tag" "noindex, follow" in
  Lwt.return resp

let default_handler _req =
  let uscito, giorni_fa, data_italiano, ep_num, titolo, msg_risposta_no = Joypad_monitor.elabora_risposta () in
  Dream.html (Views.index uscito giorni_fa data_italiano ep_num titolo msg_risposta_no)

let game_page_handler req = with_noindex_follow default_handler req
let joycord_json_tree : string option ref = ref None

let store_joycord_json_tree req =
  let%lwt json = Dream.body req in
  joycord_json_tree := Some json;
  Dream.json "{ \"status\": \"ok\" }"

let get_joycord_json_tree _req =
  match !joycord_json_tree with
  | None -> Dream.json "[]"
  | Some json -> Dream.json json

(* Admin react-admin (Fase 3): SPA con HashRouter, una sola pagina. *)
let bo_index _req =
  match Static_filesystem.read "/bo/index.html" with
  | None -> Dream.empty `Not_Found
  | Some page ->
    (* come l'admin Django: niente framing (clickjacking) *)
    Dream.html
      ~headers:
        [("Cache-Control", "no-cache"); ("X-Frame-Options", "DENY"); ("Content-Security-Policy", "frame-ancestors 'none'")]
      page

let check_admin_settings () =
  let placeholder = Settings.dream_secret = Some "DREAM SECRET CHANGE ME IN PRODUCTION" in
  if (not Settings.debug) && (Settings.dream_secret = None || placeholder)
  then begin
    prerr_endline
      "ERRORE: con DEBUG=False serve una DREAM_SECRET vera (cifra le sessioni dell'admin): genera con `openssl rand \
       -base64 48`.";
    exit 1
  end;
  if Settings.dream_secret = None
  then log.warning (fun m -> m "DREAM_SECRET non impostata: le sessioni dell'admin non sopravvivono al riavvio")

let server =
  check_admin_settings ();
  Lwt.async Joypad_monitor.monitor (* TODO ELIMINARE Lwt.async *);
  Lwt.async (Utils.gc_loop Settings.gc_period_sec) (* TODO ELIMINARE Lwt.async *);

  serve
    ~interface:Settings.listen_address
    ~port:Settings.listen_port
    ~error_handler:
      (Admin.Routes.error_handler
         ~is_admin_api:Middlewares.is_admin_api
         ~fallback:
           (* in produzione niente pagine di debug: echeggerebbero gli header,
              compreso il cookie di sessione dell'admin *)
           (if Settings.debug then Dream.debug_error_handler
            else Dream.error_template (fun _error _debug_dump response -> Lwt.return response)))
    ~stop:will_stop
  @@ logger
  @@ Middlewares.except_admin_api (if Settings.debug then Dream.no_middleware else Dream.origin_referrer_check)
  @@ Middlewares.except_admin_api (if Settings.debug then Middlewares.Cors.middleware else Dream.no_middleware)
  @@ Middlewares.except_admin_api
       (if Settings.debug then Middlewares.Json_debug.middleware ~log else Dream.no_middleware)
  @@ Middlewares.No_trailing_slash.middleware
  @@ Dream.sql_pool Settings.django_connection_string
  @@ router
       [
         get "/assets/**" @@ static ~loader "/assets";
         get "/static/joypad-img.jpg" @@ static ~loader "";
         get "/static/apple-touch-icon.png" @@ static ~loader "";
         get "/e-uscito-joypad.css" @@ static ~loader "";
         get "/joypad-img.jpg" @@ static ~loader "";
         get "/favicon-16x16.png" @@ static ~loader "";
         get "/favicon-32x32.png" @@ static ~loader "";
         get "/favicon.ico" @@ static ~loader "";
         get "/api/ultima-puntata" (fun _r ->
             let uscito, giorni_fa, data_italiano, ep_num, titolo, msg_risposta_no =
               Joypad_monitor.elabora_risposta ()
             in
             let dati = Joypad_monitor.{ uscito; giorni_fa; data_italiano; ep_num; titolo; msg_risposta_no } in
             Joypad_monitor.dati_ultima_puntata_to_yojson dati |> Yojson.Safe.to_string |> Dream.json);
         get "/api/last-episodes/:num/:offset" (fun r -> Rest.decorator r Rest.Last_episodes.view);
         get "/api/search-game/:searchInput" (fun r -> Rest.decorator r Rest.Search_game.view);
         get "/api/search-game-title/:searchInput" (fun r -> Rest.decorator r Rest.Search_game_title.view);
         get "/api/episodes-by-game-id/:gameId" (fun r -> Rest.decorator r Rest.Episodes_by_game_id.view);
         post "/api/joycord/channels" store_joycord_json_tree;
         get "/api/joycord/channels" get_joycord_json_tree;
         get "/api/joycord/games-for-score.tsv" (fun r -> Dream.sql r (Rest.Games_for_score.view r));
         get "/se-ne-parla-qui/:selectedGameIdUrl/:searchInputUrl" game_page_handler;
         get "/joycord/channels" default_handler;
         get "/sitemap.xml" Sitemap.view;
         Admin.Routes.routes;
         get "/bo/files/**" (fun _ -> Dream.empty `Not_Found) (* servito da nginx *);
         get "/bo" bo_index;
         get "/bo/**" bo_index;
         get "/" default_handler;
       ]

let () = Lwt_main.run server
