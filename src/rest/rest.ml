let log = Dream.sub_log "REST"

module Types = struct
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

  let decode_speaker = function
    | "TUTT" -> "Tutti"
    | "BORD" -> "Matteo Bordone (corri!)"
    | "FOSS" -> "Francesco Fossetti (salta!)"
    | "ZAMP" -> "Alessandro Zampini (spara!)"
    | s -> failwith (Printf.sprintf "decode_speaker: unknown value \"%s\"" s)

  let decode_tipologia = function
    | "FREE" -> "Chiacchiera libera"
    | "RECE" -> "Recensione"
    | "CONS" -> "Consiglio"
    | "STAR" -> "Osservatorio Start Citizen"
    | s -> failwith (Printf.sprintf "decode_tipologia: unknown value \"%s\"" s)

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
end

let decorator request view =
  let%lwt json, status =
    try%lwt
      let%lwt json_or_error = Dream.sql request (view request) in
      match json_or_error with
      | Ok json -> Lwt.return (`Assoc [("status", `String "ok"); ("result", json)], `OK)
      | Error e -> begin
        let msg = Caqti_error.show e |> Str.global_replace (Str.regexp "\\\\n") "\n" in

        log.error (fun m -> m "Caqti Error!\n%s" msg);

        let msg =
          msg
          |> String.split_on_char '\n'
          |> List.filter (fun l -> if String.trim l = "" then false else true)
          |> List.map (fun l -> `String l)
        in

        let json = `Assoc [("status", `String "error"); ("message", `List msg)] in
        Lwt.return (json, `Internal_Server_Error)
      end
    with exn ->
      let stack_list =
        [`String (Printexc.to_string exn)]
        @ (Printexc.get_backtrace ()
          |> String.split_on_char '\n'
          |> List.filter (fun l -> if String.trim l = "" then false else true)
          |> List.map (fun l -> `String l))
      in
      let json = `Assoc [("status", `String "error"); ("message", `List stack_list)] in
      log.error (fun m -> m "EXCEPTION: %s" (Yojson.Safe.pretty_to_string json));
      Lwt.return (json, `Internal_Server_Error)
  in
  Dream.json ~status (Yojson.Safe.to_string json)

let get_games_by_episode db ~episodio_id =
  let open Lwt_result.Syntax in
  let q =
    [%rapper
      get_many
        {sql|
            SELECT
                @string{game.titolo},
                @string{game.descrizione_raw},
                @string{game.descrizione_html},
                @string?{game.cover},
                @string{ass.istante},
                @string{ass.speaker},
                @string{ass.tipologi}a
            FROM backoffice_videogame game
                JOIN backoffice_associazioneepisodiovideogame ass ON (game.id = ass.videogame_id)
            WHERE ass.episodio_id = %int64{episodio_id}
            ORDER BY ass.istante
          |sql}]
  in
  let* records = q db ~episodio_id in
  let records =
    ListLabels.map records ~f:(fun r ->
        let titolo, descrizione_txt, descrizione_html, cover, istante, speaker, tipologia = r in
        Types.
          {
            titolo;
            descrizione_txt;
            descrizione_html;
            cover;
            istante = Db.Common.span_pg_parser istante |> Timedesc.Timestamp.to_float_s;
            speaker = decode_speaker speaker;
            tipologia = decode_tipologia tipologia;
          })
  in
  Lwt_result.return records

let episodes_adapter db episodi_db =
  let open Lwt_result.Syntax in
  let* episodi =
    Utils.Lwt_result.List.map_s
      (fun ep_db ->
        let cover = Option.map (fun s -> Printf.sprintf "/%s%s" Settings.media_url s) ep_db.Db.Django.Episodio.cover in

        let* giochi = get_games_by_episode db ~episodio_id:ep_db.id in

        let ep =
          {
            Types.titolo = ep_db.Db.Django.Episodio.titolo;
            episodio_numero = ep_db.Db.Django.Episodio.episodio_numero;
            data_uscita = ep_db.Db.Django.Episodio.data_uscita |> Timedesc.Date.to_rfc3339;
            descrizione_html = Option.value ~default:"" ep_db.Db.Django.Episodio.descrizione_html;
            descrizione_txt = Option.value ~default:"" ep_db.Db.Django.Episodio.descrizione_txt;
            durata = ep_db.Db.Django.Episodio.durata |> Timedesc.Span.to_float_s;
            url = ep_db.Db.Django.Episodio.url;
            url_post = ep_db.Db.Django.Episodio.url_post;
            url_video = ep_db.Db.Django.Episodio.url_video;
            cover;
            giochi;
          }
          |> Types.episode_to_yojson
        in
        Lwt_result.return ep)
      episodi_db
  in

  Lwt_result.return (`List episodi)

module Last_episodes = struct
  let view (request : Dream.request) (db : Caqti_lwt.connection) =
    let open Lwt_result.Syntax in
    let%lwt offset = try%lwt Dream.param request "offset" |> int_of_string |> Lwt.return with _ -> Lwt.return 0 in
    let num = Dream.param request "num" |> int_of_string in

    let* episodi_db = Db.Django.Episodio.get_last_episods db ~offset ~n:num () in
    episodes_adapter db episodi_db
end

module Search_game = struct
  let log = Dream.sub_log "search"

  let view (request : Dream.request) (db : Caqti_lwt.connection) =
    let open Lwt_result.Syntax in
    let search_input = Dream.param request "searchInput" in
    log.debug (fun m -> m "Searching for \"%s\"" search_input);

    let* episodi_db = Db.Django.Episodio.search_episodes_by_game_title db ~search_input () in
    episodes_adapter db episodi_db
end

module Search_game_title = struct
  let search_game_id_by_title db ~search_input () =
    let open Lwt_result.Syntax in
    let search_input = String.trim search_input in
    let q =
      [%rapper
        get_many
          {sql|
              SELECT
                  @int64{id},
                  game.titolo AS @string{titolo},
                  word_similarity(unaccent(%string{search_input}), unaccent(game.titolo)) AS @float{sim}
              FROM backoffice_videogame game
              WHERE word_similarity(unaccent(%string{search_input}), unaccent(game.titolo)) > 0.25
              ORDER BY sim DESC
          |sql}]
    in
    let* records = q db ~search_input in
    let records =
      ListLabels.map records ~f:(fun r ->
          let id, titolo, similarity = r in
          `Assoc [("id", `Intlit (Int64.to_string id)); ("titolo", `String titolo); ("similarity", `Float similarity)])
    in
    Lwt_result.return (`List records)

  let view (request : Dream.request) (db : Caqti_lwt.connection) =
    let search_input = Dream.param request "searchInput" in
    search_game_id_by_title db ~search_input ()
end

module Episodes_by_game_id = struct
  let view (request : Dream.request) (db : Caqti_lwt.connection) =
    let open Lwt_result.Syntax in
    let game_id = Dream.param request "gameId" |> Int64.of_string in
    let* episodi_db = Db.Django.Episodio.search_episodes_by_game_id db ~game_id () in
    episodes_adapter db episodi_db
end
