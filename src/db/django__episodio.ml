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

let get_last_episods db ?(n=10) ~offset  () =
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
          WHERE ep.pubblicato = TRUE
          ORDER BY data_uscita DESC
          LIMIT %int{n}
          OFFSET %int{offset}
        |sql}]
  in
  let* records = q db ~n ~offset in
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
  let search_input = String.trim search_input in

  let search_input, q =
    if String.length search_input < 6
    then begin
      let search_input =
        search_input |> String.split_on_char ' ' |> List.map String.trim |> String.concat "%" |> Printf.sprintf "%%%s%%"
      in
      let q =
        [%rapper
          get_many
            {sql|
                SELECT
                  @int64{id},
                  @string{ts_created},
                  @string{ts},
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
                  @string?{descrizione_txt},
                  @float{similarity},
                  @int{pri}
                FROM (
                    SELECT DISTINCT ON (ep.id)
                      ep.id AS id,
                      to_char(ep.ts_created, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts_created,
                      to_char(ep.ts, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts,
                      ep.titolo,
                      ep.episodio_numero,
                      ep.data_uscita,
                      ep.durata,
                      ep.cover,
                      ep.url,
                      ep.url_video,
                      ep.url_post,
                      ep.note,
                      ep.descrizione_html,
                      ep.descrizione_txt,
                      0.0 AS similarity,
                      (
                        CASE
                          WHEN ass.tipologia = 'RECE' THEN 1
                          WHEN ass.tipologia = 'CONS' THEN 2
                          WHEN ass.tipologia = 'FREE' THEN 3
                          ELSE 4
                        END
                      ) AS pri
                    FROM backoffice_episodio ep
                      JOIN backoffice_associazioneepisodiovideogame ass ON (ep.id = ass.episodio_id)
                      JOIN backoffice_videogame game ON (game.id = ass.videogame_id)
                    WHERE unaccent(game.titolo) ILIKE unaccent(%string{search_input})
                      AND ep.pubblicato = TRUE
                  ) t
                ORDER BY similarity DESC, pri ASC, data_uscita DESC
              |sql}]
      in
      (search_input, q)
    end
    else begin
      let q =
        [%rapper
          get_many
            {sql|
                SELECT
                  @int64{id},
                  @string{ts_created},
                  @string{ts},
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
                  @string?{descrizione_txt},
                  @float{similarity},
                  @int{pri}
                FROM (
                    SELECT DISTINCT ON (ep.id)
                      ep.id AS id,
                      to_char(ep.ts_created, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts_created,
                      to_char(ep.ts, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts,
                      ep.titolo,
                      ep.episodio_numero,
                      ep.data_uscita,
                      ep.durata,
                      ep.cover,
                      ep.url,
                      ep.url_video,
                      ep.url_post,
                      ep.note,
                      ep.descrizione_html,
                      ep.descrizione_txt,
                      word_similarity(unaccent(%string{search_input}), unaccent(game.titolo)) AS similarity,
                      (
                        CASE
                          WHEN ass.tipologia = 'RECE' THEN 1
                          WHEN ass.tipologia = 'CONS' THEN 2
                          WHEN ass.tipologia = 'FREE' THEN 3
                          ELSE 4
                        END
                      ) AS pri
                    FROM backoffice_episodio ep
                      JOIN backoffice_associazioneepisodiovideogame ass ON (ep.id = ass.episodio_id)
                      JOIN backoffice_videogame game ON (game.id = ass.videogame_id)
                    WHERE word_similarity(unaccent(%string{search_input}), unaccent(game.titolo)) > 0.25
                      AND ep.pubblicato = TRUE
                  ) t
                ORDER BY similarity DESC, pri ASC, data_uscita DESC
              |sql}]
      in
      (search_input, q)
    end
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
              descrizione_txt,
              _similarity,
              _priority ) =
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

let search_episodes_by_game_id db ~game_id () =
  let open Lwt_result.Syntax in
  let q =
    [%rapper
      get_many
        {sql|
            SELECT
                @int64{id},
                @string{ts_created},
                @string{ts},
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
            FROM (
                    SELECT DISTINCT ON (ep.id)
                        ep.id,
                        to_char(ep.ts_created, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts_created,
                        to_char(ep.ts, 'YYYY-MM-DD HH24:MI:SS.USTZH:TZM') AS ts,
                        ep.titolo,
                        ep.episodio_numero,
                        ep.data_uscita,
                        ep.durata,
                        ep.cover,
                        ep.url,
                        ep.url_video,
                        ep.url_post,
                        ep.note,
                        ep.descrizione_html,
                        ep.descrizione_txt,
                        (
                          CASE
                            WHEN ass.tipologia = 'RECE' THEN 1
                            WHEN ass.tipologia = 'CONS' THEN 2
                            WHEN ass.tipologia = 'FREE' THEN 3
                            ELSE 4
                          END
                        ) AS pri
                    FROM backoffice_episodio ep
                        JOIN backoffice_associazioneepisodiovideogame ass ON (ep.id = ass.episodio_id)
                        JOIN backoffice_videogame game ON (game.id = ass.videogame_id)
                    WHERE game.id = %int64{game_id}
                      AND ep.pubblicato = TRUE
                ) t
            ORDER BY pri ASC, data_uscita DESC
          |sql}]
  in
  let* records = q db ~game_id in
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
