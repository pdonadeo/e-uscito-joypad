open Cohttp_lwt_unix

type ep_num =
  | Intero of int
  | Stringa of string
  | NonSpecificato
[@@deriving yojson]

type data = {
  ep_num : ep_num;
  title : string;
  date : Timedesc.Date.t;
}

type dati_ultima_puntata = {
  uscito : bool;
  giorni_fa : string;
  data_italiano : string;
  ep_num : ep_num;
  titolo : string;
  msg_risposta_no : string option;
}
[@@deriving yojson]

let log = Dream.sub_log "joypad.monitor"
let last_episode_data : data option ref = ref None
let soglia_uscito_giorni = 24
let soglia_lamentele_giorni = 48

let body () =
  let%lwt _, body = Client.get (Uri.of_string Settings.joypad_page) in
  let%lwt body = Cohttp_lwt.Body.to_string body in
  Lwt.return body

let date_reg = Re2.create_exn "(\\d\\d?) +(...) +(\\d\\d\\d\\d) +(?:-|—) +(\\d+) +min"

let extract_date desc =
  (* Esempio di data.desc: "09 Apr 2022 - 42 min" *)
  let matches = Re2.find_submatches_exn date_reg desc in
  let day = matches.(1) |> Utils.option_value |> int_of_string in
  let month = matches.(2) |> Utils.option_value |> Utils.int_of_italian_month in
  let year = matches.(3) |> Utils.option_value |> int_of_string in
  Timedesc.Date.of_iso8601_exn (Utils.spf "%04d-%02d-%02d" year month day)

let title_reg = Re2.create_exn "(Ep\\. +)?(\\w+) +(?:–|—) +(.*)"

let extract_ep_num_and_title data_title =
  (* "Ep. 47 – Quello con Elden Ring, il nuovo Monkey Island e il PlayStation Plus Extra Premium toppissimo" *)
  let m = Re2.find_submatches_exn title_reg data_title in
  let ep_num = m.(2) |> Option.map (fun s -> s |> String.trim) in
  let ep_num =
    match ep_num with
    | None -> NonSpecificato
    | Some s -> ( try Intero (int_of_string s) with _ -> Stringa s)
  in
  let title = m.(3) |> Utils.option_value in
  (ep_num, title)

let extract_data_from_page () =
  let open Soup in
  let%lwt body = body () in
  let soup = parse body in

  let first_div = soup $$ "main div" |> R.first in
  let title_link = first_div $$ "h3 a" |> R.first in
  let data_title = try trimmed_texts title_link |> List.hd with Failure _ -> failwith "non c'è un titolo" in

  let data_desc =
    with_stop (fun stop ->
        first_div
        |> children
        |> elements
        |> iter (fun el ->
               if has_attribute "class" el
               then begin
                 let class_text = classes el |> List.hd in
                 if Str.string_match (Str.regexp ".*_details_.*") class_text 0 then stop.throw el
               end);
        failwith "Non trovo la data di pubblicazione")
    |> trimmed_texts
    |> String.concat " "
  in
  Lwt.return (data_title, data_desc)

let elabora_risposta () =
  match !last_episode_data with
  | Some last_episode_data ->
    let tz = Timedesc.Time_zone.make_exn "Europe/Rome" in
    let adesso = Timedesc.now ~tz_of_date_time:tz () in
    let oggi = Timedesc.date adesso in
    let mese_corrente = Timedesc.Date.month oggi in
    let giorni_passati = Timedesc.Date.diff_days oggi last_episode_data.date in
    let uscito = if giorni_passati <= soglia_uscito_giorni then true else false in
    let giorni_fa = Utils.distanza giorni_passati in
    let data_italiano = Utils.string_of_date last_episode_data.date in
    let msg_risposta_no =
      match giorni_passati with
      | _n when (not uscito) && (mese_corrente = 8 || mese_corrente = 9) ->
        Some "È finita la stagione di Joypad. Aspettiamo la prossima a Settembre."
      | n when (not uscito) && n <= soglia_lamentele_giorni ->
        Some "Però adesso non torturare Zampa, aspetta ancora qualche giorno…"
      | n when (not uscito) && n > soglia_lamentele_giorni ->
        Some "Mi duole ammetterlo ma è giunto il momento di protestare!"
      | _ -> None
    in
    (uscito, giorni_fa, data_italiano, last_episode_data.ep_num, last_episode_data.title, msg_risposta_no)
  | None -> (false, "", "", NonSpecificato, "", None)

let rec monitor () =
  log.debug (fun l -> l "Scarico info ultima puntata...");

  let%lwt () =
    try%lwt
      let%lwt data_title, data_desc = extract_data_from_page () in
      let ep_num, title = extract_ep_num_and_title data_title in
      let date = extract_date data_desc in
      let data = { ep_num; title; date } in
      last_episode_data := Some data;
      log.debug (fun l -> l "...fatto!");
      Lwt.return_unit
    with exn ->
      let backtrace = Printexc.get_backtrace () in
      log.error (fun l -> l "Async exception: %s" (Printexc.to_string exn));
      backtrace |> Utils.iter_backtrace (fun s -> log.error (fun l -> l "%s" s));
      Lwt.return_unit
  in

  let%lwt () = Lwt_unix.sleep Settings.monitor_period_sec in
  monitor ()
