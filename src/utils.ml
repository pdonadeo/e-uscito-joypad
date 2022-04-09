type data = {
  ep_num : int;
  title : string;
  date : Timedesc.Date.t;
}

let spf = Printf.sprintf
let () = Gc.set { (Gc.get ()) with Gc.allocation_policy = 2; Gc.space_overhead = 85 }
let log = Dream.sub_log "utils"

let iter_backtrace f backtrace =
  backtrace |> String.split_on_char '\n' |> List.filter (fun line -> line <> "") |> List.iter f

let option_value o =
  match o with
  | Some x -> x
  | None -> failwith "option_value: empty option"

let get_meminfo ?(path = "/proc/meminfo") () =
  let open Lwt_io in
  with_file ~flags:[O_RDONLY] ~mode:Input path (fun ic ->
      let%lwt lines = read_lines ic |> Lwt_stream.to_list in

      let stats =
        ListLabels.fold_left
          ~init:BatMap.String.empty
          ~f:(fun stats line ->
            let tokens =
              BatString.replace_chars
                (function
                  | '\t' -> " "
                  | x -> String.make 1 x)
                line
              |> BatString.split_on_char ' '
              |> ListLabels.filter ~f:(fun t -> if String.equal t "" then false else true)
              |> Array.of_list
            in
            let name = tokens.(0) |> BatString.strip ~chars:":" in
            try
              let val_kb = tokens.(1) |> int_of_string in
              BatMap.String.add name val_kb stats
            with _ -> stats)
          lines
      in
      Lwt.return stats)

let rec gc_loop every () =
  let open Gc in
  let path = "/proc/" ^ (Unix.getpid () |> string_of_int) ^ "/status" in
  let%lwt () = Lwt_unix.sleep every in
  log.debug (fun m -> m "GARBAGE COLLECTION LOOP");
  let stat' = stat () in
  let%lwt memstats = get_meminfo ~path () in
  log.debug (fun m -> m "BEFORE GC: heap_words = %d; live_words = %d" stat'.heap_words stat'.live_words);
  log.debug (fun m -> m "           VmRSS = %d" (BatMap.String.find "VmRSS" memstats));
  compact ();
  Malloc.malloc_trim 0;
  let stat' = stat () in
  let%lwt memstats = get_meminfo ~path () in
  log.debug (fun m -> m "AFTER  GC: heap_words = %d; live_words = %d" stat'.heap_words stat'.live_words);
  log.debug (fun m -> m "           VmRSS = %d" (BatMap.String.find "VmRSS" memstats));
  gc_loop every ()

let distanza giorni =
  match giorni with
  | 0 -> "oggi"
  | 1 -> "ieri"
  | 2 -> "l'altro ieri"
  | _ -> spf "%d giorni fa" giorni

let int_of_italian_month = function
  | "Gen" -> 1
  | "Feb" -> 2
  | "Mar" -> 3
  | "Apr" -> 4
  | "Mag" -> 5
  | "Giu" -> 6
  | "Lug" -> 7
  | "Ago" -> 8
  | "Set" -> 9
  | "Ott" -> 10
  | "Nov" -> 11
  | "Dic" -> 12
  | m -> failwith (spf "int_of_italian_month: unknown month %s" m)

let string_of_date date =
  let giorno =
    match Timedesc.Date.weekday date with
    | `Sun -> "domenica"
    | `Mon -> "lunedì"
    | `Tue -> "martedì"
    | `Wed -> "mercoledì"
    | `Thu -> "giovedì"
    | `Fri -> "venerdì"
    | `Sat -> "sabato"
  in
  let mese =
    match Timedesc.Date.month date with
    | 1 -> "Gennaio"
    | 2 -> "Febbraio"
    | 3 -> "Marzo"
    | 4 -> "Aprile"
    | 5 -> "Maggio"
    | 6 -> "Giugno"
    | 7 -> "Luglio"
    | 8 -> "Agosto"
    | 9 -> "Settembre"
    | 10 -> "Ottobre"
    | 11 -> "Novembre"
    | 12 -> "Dicembre"
    | _ -> failwith "Mese impossibile"
  in
  spf "%s %d %s %d" giorno (Timedesc.Date.day date) mese (Timedesc.Date.year date)

let risposta last_episode_data =
  match last_episode_data with
  | Some last_episode_data ->
    let tz = Timedesc.Time_zone.make_exn "Europe/Rome" in
    let adesso = Timedesc.now ~tz_of_date_time:tz () in
    let oggi = Timedesc.date adesso in
    let giorni_passati = Timedesc.Date.diff_days oggi last_episode_data.date in
    let uscito = if giorni_passati <= 14 then true else false in
    let giorni_fa = distanza giorni_passati in
    let data_italiano = string_of_date last_episode_data.date in
    let fretta = if giorni_passati >= 10 && giorni_passati <= 14 then true else false in
    (uscito, fretta, giorni_fa, data_italiano, last_episode_data.ep_num, last_episode_data.title)
  | None -> (false, false, "", "", 1999, "")
