open Db_common

type t = {
  id : Int64.t;
  ts_created : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  ts : Timedesc.Timestamp.t; [@printer ts_pg_formatter]
  titolo : string;
  episodio_numero : string option;
  data_uscita : Timedesc.Date.t; [@printer date_pg_formatter]
  durata : Timedesc.Span.t; [@printer span_pg_formatter]
  cover : string option;
  url : string option;
  url_video : string option;
  url_post : string option;
  note : string option;
  descrizione_html : string option;
  descrizione_txt : string option;
}
[@@deriving show { with_path = false }]

let default () =
  {
    id = 0L;
    ts = Timedesc.Timestamp.now ();
    ts_created = Timedesc.Timestamp.now ();
    titolo = "";
    episodio_numero = None;
    data_uscita = today ();
    durata = Timedesc.Span.of_float_s 0.;
    cover = None;
    url = None;
    url_video = None;
    url_post = None;
    note = None;
    descrizione_html = None;
    descrizione_txt = None;
  }

let get_last_episods db ?n () =
  let n = Option.value ~default:10 n in
  let open Lwt_result.Syntax in
  let q =
    [%rapper
      get_many
        {sql|
          SELECT
              @int64{id},
              to_char(ts_created, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS @string{ts_created},
              to_char(ts, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS @string{ts},
              @string{titolo},
              @string?{episodio_numero},
              @string{data_uscita},
              @string{durata},
              @string?{cover},
              @string?{url},
              @string?{url_video},
              @string?{url_post},
              @string?{note},
              @string?{descrizione_html},
              @string?{descrizione_txt}
          FROM backoffice_episodio ep
          ORDER BY data_uscita DESC
          LIMIT %int{n}
        |sql}]
  in
  let* records = q db ~n in
  let records =
    ListLabels.map records ~f:(fun r ->
        let ( id,
              ts_created,
              ts,
              titolo,
              episodio_numero,
              data_uscita,
              durata,
              cover,
              url,
              url_video,
              url_post,
              note,
              descrizione_html,
              descrizione_txt ) =
          r
        in
        {
          id;
          ts_created = Timedesc.Timestamp.of_iso8601_exn ts_created;
          ts = Timedesc.Timestamp.of_iso8601_exn ts;
          titolo;
          episodio_numero;
          data_uscita = Timedesc.Date.of_iso8601_exn data_uscita;
          durata = span_pg_parser durata;
          cover;
          url;
          url_video;
          url_post;
          note;
          descrizione_html;
          descrizione_txt;
        })
  in
  Lwt_result.return records

let search_episodes_by_game_title db ~search_input () =
  let open Lwt_result.Syntax in
  let search_input = search_input |> String.split_on_char ' ' |> List.map String.trim |> String.concat "%" in
  let search_input = Printf.sprintf "%%%s%%" search_input in
  let q =
    [%rapper
      get_many
        {sql|
            SELECT DISTINCT
                @int64{ep.id},
                to_char(ep.ts_created, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS @string{ts_created},
                to_char(ep.ts, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS @string{ts},
                @string{ep.titolo},
                @string?{ep.episodio_numero},
                @string{ep.data_uscita},
                @string{ep.durata},
                @string?{ep.cover},
                @string?{ep.url},
                @string?{ep.url_video},
                @string?{ep.url_post},
                @string?{ep.note},
                @string?{ep.descrizione_html},
                @string?{ep.descrizione_txt}
            FROM backoffice_episodio ep
                JOIN backoffice_associazioneepisodiovideogame ass ON (ep.id = ass.episodio_id)
                JOIN backoffice_videogame game ON (game.id = ass.videogame_id)
            WHERE game.titolo ILIKE %string{search_input}
            ORDER BY ep.data_uscita DESC
          |sql}]
  in
  let* records = q db ~search_input in
  let records =
    ListLabels.map records ~f:(fun r ->
        let ( id,
              ts_created,
              ts,
              titolo,
              episodio_numero,
              data_uscita,
              durata,
              cover,
              url,
              url_video,
              url_post,
              note,
              descrizione_html,
              descrizione_txt ) =
          r
        in
        {
          id;
          ts_created = Timedesc.Timestamp.of_iso8601_exn ts_created;
          ts = Timedesc.Timestamp.of_iso8601_exn ts;
          titolo;
          episodio_numero;
          data_uscita = Timedesc.Date.of_iso8601_exn data_uscita;
          durata = span_pg_parser durata;
          cover;
          url;
          url_video;
          url_post;
          note;
          descrizione_html;
          descrizione_txt;
        })
  in
  Lwt_result.return records
