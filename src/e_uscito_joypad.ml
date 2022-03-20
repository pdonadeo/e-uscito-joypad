open Dream

let spf = Printf.sprintf

module Settings = struct
  type seconds = float
  let debug = true
  let gc_period_sec : seconds = 3600.0 *. 24.0
end

let will_stop, stop_now = Lwt.wait ()

let signal_handler s =
  log "Exiting on signal %d" s;
  Lwt.wakeup stop_now ()

let _ = Lwt_unix.on_signal 15 signal_handler
let _ = Lwt_unix.on_signal 2 signal_handler

let () = initialize_log ~level:`Debug ()

let server =
  Lwt.async (Utils.gc_loop Settings.gc_period_sec);
  serve
    ~interface:"0.0.0.0"
    ~port:8000
    ~error_handler:Dream.debug_error_handler
    ~stop:will_stop
  @@ logger
  @@ router [
    get "/apple-touch-icon.png" (static "assets");
    get "/favicon-32x32.png" (static "assets");
    get "/favicon-16x16.png" (static "assets");
    get "/site.webmanifest" (static "assets");
    get "/" (fun _req -> Dream.html (Views.index ()));
  ]

let () = Lwt_main.run server
