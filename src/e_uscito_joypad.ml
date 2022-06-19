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

type dati_ultima_puntata = {
  uscito : bool;
  fretta : bool;
  giorni_fa : string;
  data_italiano : string;
  ep_num : int;
  titolo : string;
  rompi_le_palle : bool;
}
[@@deriving yojson]

type gioco_episodio = {
  titolo : string;
  descrizione_txt : string;
  descrizione_html : string;
  cover : string option;
  istante : float;
  speaker : string;
  tipologia : string;
}
[@@deriving yojson]

type gioco = {
  titolo : string;
  descrizione_txt : string;
  descrizione_html : string;
  cover : string option;
  rawg_slug : string;
}
[@@deriving yojson]

type episode = {
  titolo : string;
  episodio_numero : string option;
  data_uscita : string;
  descrizione_html : string;
  descrizione_txt : string;
  durata : float;
  url : string option;
  url_post : string option;
  url_video : string option;
  cover : string option;
  giochi : gioco_episodio list;
}
[@@deriving yojson]

type db_data = {
  episodi : episode list;
  giochi : gioco list;
}
[@@deriving yojson]

let server =
  Lwt.async (Joypad_monitor.monitor ~last_episode_data);
  Lwt.async (Utils.gc_loop Settings.gc_period_sec);
  let%lwt db_data_string = Utils.read_all "assets/db_data.json" in
  let db_data = Yojson.Safe.from_string db_data_string |> db_data_of_yojson |> Utils.yojson_ok_exn in
  serve ~interface:"0.0.0.0" ~port:3000 ~error_handler:Dream.debug_error_handler ~stop:will_stop
  @@ logger
  @@ router
       [
         get "/static/static/js/**" @@ static "assets/js";
         get "/static/static/css/**" @@ static "assets/css";
         get "/static/**" @@ static "assets";
         get "/api/ultima-puntata" (fun _req ->
             let uscito, fretta, giorni_fa, data_italiano, ep_num, titolo, rompi_le_palle =
               Joypad_monitor.elabora_risposta !last_episode_data
             in
             let dati = { uscito; fretta; giorni_fa; data_italiano; ep_num; titolo; rompi_le_palle } in
             dati_ultima_puntata_to_yojson dati |> Yojson.Safe.to_string |> Dream.json);
         get "/api/db-data" (fun _req -> db_data |> db_data_to_yojson |> Yojson.Safe.to_string |> Dream.json);
         get "/" (fun _req ->
             let uscito, fretta, giorni_fa, data_italiano, ep_num, titolo, rompi_le_palle =
               Joypad_monitor.elabora_risposta !last_episode_data
             in
             Dream.html (Views.index uscito fretta giorni_fa data_italiano ep_num titolo rompi_le_palle));
       ]

let () = Lwt_main.run server
