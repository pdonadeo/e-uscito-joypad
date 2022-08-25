open Db_common

type speaker =
  | Tutti [@printer fun fmt _v -> fprintf fmt "TUTT"]
  | Bordone [@printer fun fmt _v -> fprintf fmt "BORD"]
  | Fossetti [@printer fun fmt _v -> fprintf fmt "FOSS"]
  | Zampini [@printer fun fmt _v -> fprintf fmt "ZAMP"]
[@@deriving show { with_path = false }]

type tipologia =
  | Chiacchiera [@printer fun fmt _v -> fprintf fmt "FREE"]
  | Recensione [@printer fun fmt _v -> fprintf fmt "RECE"]
  | Consiglio [@printer fun fmt _v -> fprintf fmt "CONS"]
  | Osservatorio_star_citizen [@printer fun fmt _v -> fprintf fmt "STAR"]
[@@deriving show { with_path = false }]

type t = {
  id : Int64.t;
  ts_created : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  ts : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  istante : Timedesc.Span.t; [@printer span_pg_formatter]
  speaker : speaker;
  tipologia : tipologia;
  episodio_id : Int64.t;
  videogame_id : Int64.t;
}
[@@deriving show { with_path = false }]

let default () =
  {
    id = 0L;
    ts = Timedesc.Timestamp.now ();
    ts_created = Timedesc.Timestamp.now ();
    istante = Timedesc.Span.of_float_s 0.;
    speaker = Tutti;
    tipologia = Chiacchiera;
    episodio_id = 0L;
    videogame_id = 0L;
  }
