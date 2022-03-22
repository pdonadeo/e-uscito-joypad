open Logs

let spf = Printf.sprintf
let () = Gc.set { (Gc.get ()) with Gc.allocation_policy = 2; Gc.space_overhead = 85 }

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
  debug (fun m -> m "GARBAGE COLLECTION LOOP");
  let stat' = stat () in
  let%lwt memstats = get_meminfo ~path () in
  debug (fun m -> m "BEFORE GC: heap_words = %d; live_words = %d" stat'.heap_words stat'.live_words);
  debug (fun m -> m "           VmRSS = %d" (BatMap.String.find "VmRSS" memstats));
  compact ();
  Malloc.malloc_trim 0;
  let stat' = stat () in
  let%lwt memstats = get_meminfo ~path () in
  debug (fun m -> m "AFTER  GC: heap_words = %d; live_words = %d" stat'.heap_words stat'.live_words);
  debug (fun m -> m "           VmRSS = %d" (BatMap.String.find "VmRSS" memstats));
  gc_loop every ()

let distanza giorni =
  match giorni with
  | 0 -> "oggi"
  | 1 -> "ieri"
  | 2 -> "l'altro ieri"
  | _ -> spf "%d giorni fa" giorni

let string_of_date ts =
  let giorno =
    match Timedesc.weekday ts with
    | `Sun -> "domenica"
    | `Mon -> "lunedì"
    | `Tue -> "martedì"
    | `Wed -> "mercoledì"
    | `Thu -> "giovedì"
    | `Fri -> "venerdì"
    | `Sat -> "sabato"
  in
  let mese =
    match Timedesc.month ts with
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
  spf "%s %d %s %d" giorno (Timedesc.day ts) mese (Timedesc.year ts)

let risposta () =
  let tz = Timedesc.Time_zone.make_exn "Europe/Rome" in
  let ultima_puntata = Timedesc.make_exn ~tz ~year:2022 ~month:3 ~day:19 ~hour:12 ~minute:0 ~second:0 () in
  let adesso = Timedesc.now ~tz_of_date_time:tz () in
  let oggi = Timedesc.date adesso in
  let data_ultima_puntata = Unix.getenv "ULTIMA_PUNTATA" |> Timedesc.Date.of_iso8601_exn in
  let giorni_passati = Timedesc.Date.diff_days oggi data_ultima_puntata in
  let uscito = if giorni_passati <= 20 then true else false in
  let risposta =
    if uscito then spf "Sì è uscito %s, %s!" (distanza giorni_passati) (string_of_date ultima_puntata) else "No."
  in
  let fretta = if giorni_passati >= 10 && giorni_passati <= 20 then true else false in
  (risposta, uscito, fretta)
