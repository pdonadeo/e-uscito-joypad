let spf = Printf.sprintf
let () = Gc.set { (Gc.get ()) with Gc.allocation_policy = 2; Gc.space_overhead = 85 }

let getenv ~default ~f v_name =
  try
    let v_val = Unix.getenv v_name in
    try f v_val with _ -> default
  with Not_found -> default

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
  let _unused_bool = Malloc.malloc_trim 0 in
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

let int_of_italian_month s =
  let s = String.lowercase_ascii s in
  match s with
  | "gen" -> 1
  | "feb" -> 2
  | "mar" -> 3
  | "apr" -> 4
  | "mag" -> 5
  | "giu" -> 6
  | "lug" -> 7
  | "ago" -> 8
  | "set" -> 9
  | "ott" -> 10
  | "nov" -> 11
  | "dic" -> 12
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

let read_all fname =
  let open Lwt_io in
  let%lwt ic = open_file ~mode:Input fname in
  let b = Buffer.create 1024 in
  let rec loop () =
    let%lwt chunk = read ~count:1024 ic in
    Buffer.add_string b chunk;
    if String.length chunk = 0 then Lwt.return (Buffer.contents b) else loop ()
  in
  let%lwt res = loop () in
  let%lwt () = close ic in
  Lwt.return res

let yojson_ok_exn (res : 'a Ppx_deriving_yojson_runtime.error_or) =
  match res with
  | Ok res -> res
  | Error msg -> failwith (spf "Cannot read JSON: %s" msg)

module Lwt_result = struct
  include Lwt_result

  let combine_errors xs =
    let rec loop xs oks errs =
      match xs with
      | [] -> (List.rev oks, List.rev errs)
      | x :: xs -> (
        match x with
        | Ok v -> loop xs (v :: oks) errs
        | Error e -> loop xs oks (e :: errs))
    in
    let oks, errs = loop xs [] [] in
    match errs with
    | [] -> Ok oks
    | e :: _ -> Error e

  module List = struct
    let map_s (f : 'a -> ('b, 'err) t) (xs : 'a list) : ('b list, 'err) t =
      let%lwt _results = Lwt_list.map_s (fun x -> f x) xs in
      Lwt.return (combine_errors _results)
  end
end

let quot_regexp = Re2.create_exn "\""
let apos_regexp = Re2.create_exn "'"
let lt_regexp = Re2.create_exn "<"
let gt_regexp = Re2.create_exn ">"
let amp_regexp = Re2.create_exn "&"
let xml_amp_regexp = Re2.create_exn "&amp;"

let escape_url s =
  s
  |> Re2.rewrite_exn amp_regexp ~template:"%26"
  |> Uri.of_string
  |> Uri.to_string
  |> Re2.rewrite_exn amp_regexp ~template:"&amp;"
  |> Re2.rewrite_exn quot_regexp ~template:"&quot;"
  |> Re2.rewrite_exn apos_regexp ~template:"&apos;"
  |> Re2.rewrite_exn lt_regexp ~template:"&lt;"
  |> Re2.rewrite_exn gt_regexp ~template:"&gt;"
  |> Re2.rewrite_exn xml_amp_regexp ~template:"%26"
