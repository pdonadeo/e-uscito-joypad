let log = Dream.sub_log "REST"

(* Utility per timestamp *)
let format =
  "{year}-{mon:0X}-{day:0X} {hour:0X}:{min:0X}:{sec:0X}{sec-frac:.} {tzoff-sign}{tzoff-hour:0X}{tzoff-min:0X}"

let ts_pg_formatter = Timedesc.Timestamp.pp ~display_using_tz:(Timedesc.Time_zone.local_exn ()) ~format ()
let date_pg_formatter fmt d = Format.pp_print_string fmt @@ Timedesc.Date.to_rfc3339 d

let pg_null_of_option ~f = function
  | None -> "NULL"
  | Some x -> f x

let date_opt_pg_formatter fmt d =
  let str = pg_null_of_option ~f:Timedesc.Date.to_rfc3339 d in
  Format.pp_print_string fmt str

let span_pg_formatter fmt span =
  let open Timedesc.Span.For_human in
  let v = view span in
  Format.fprintf fmt "%02d:%02d:%02d" v.hours v.minutes v.seconds

let span_pg_parser str =
  let tokens = String.split_on_char ':' str in
  let hours = List.hd tokens |> int_of_string in
  let minutes = List.nth tokens 1 |> int_of_string in
  let seconds = List.nth tokens 2 in
  let sub_seconds = String.split_on_char '.' seconds in
  let seconds = List.nth sub_seconds 0 |> int_of_string in
  Timedesc.Span.For_human.make_exn ~hours ~minutes ~seconds ()

let local_timezone = Timedesc.Time_zone.local_exn ()
let today () = Timedesc.Timestamp.now () |> Timedesc.of_timestamp_exn ~tz_of_date_time:local_timezone |> Timedesc.date