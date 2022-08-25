open Db_common

type t = {
  id : Int64.t;
  ts_created : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  ts : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  titolo : string option;
  descrizione_html : string option;
  descrizione_raw : string option;
  cover : string option;
  rawg_slug : string;
  rawg_json : Yojson.Safe.t;
}
[@@deriving show { with_path = false }]

let default () =
  {
    id = 0L;
    ts = Timedesc.Timestamp.now ();
    ts_created = Timedesc.Timestamp.now ();
    titolo = None;
    descrizione_html = None;
    descrizione_raw = None;
    cover = None;
    rawg_slug = "";
    rawg_json = `Assoc [];
  }
