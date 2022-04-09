open Dream

let will_stop, stop_now = Lwt.wait ()

let signal_handler s =
  log "Exiting on signal %d" s;
  Lwt.wakeup stop_now ()

let _ = Lwt_unix.on_signal 15 signal_handler
let _ = Lwt_unix.on_signal 2 signal_handler
let () = initialize_log ~level:`Debug ()
let last_episode_data : Joypad_monitor.data option ref = ref None

let () =
  List.iter (fun src ->
      match Logs.Src.name src with
      | "cohttp.lwt.io" | "cohttp.lwt.server" | "tls.tracing" | "tls.config" -> Logs.Src.set_level src None
      | _ -> ())
  @@ Logs.Src.list ()

let server =
  Lwt.async (Joypad_monitor.monitor ~last_episode_data);
  Lwt.async (Utils.gc_loop Settings.gc_period_sec);
  serve ~interface:"0.0.0.0" ~port:3000 ~error_handler:Dream.debug_error_handler ~stop:will_stop
  @@ logger
  @@ router
       [
         get "/static/**" @@ static "assets";
         get "/" (fun _req ->
             let uscito, fretta, giorni_fa, data_italiano, ep_num, titolo =
               Joypad_monitor.elabora_risposta !last_episode_data
             in
             Dream.html (Views.index uscito fretta giorni_fa data_italiano ep_num titolo));
       ]

let () = Lwt_main.run server
