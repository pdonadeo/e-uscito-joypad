let log = Dream.sub_log "SMAP"

let dati_sitemap db =
  let q =
    [%rapper
      get_many
        {sql|
          SELECT 'https://www.euscitojoypad.it/se-ne-parla-qui/'|| game.id ||'/'||game.titolo as @string{loc},
                 max(ep.data_uscita) AS @string{ultima_citazione}
          FROM backoffice_videogame game
          JOIN backoffice_associazioneepisodiovideogame ass ON (ass.videogame_id = game.id)
          JOIN backoffice_episodio ep ON (ass.episodio_id = ep.id)
          GROUP BY game.id, game.titolo
          ORDER BY ultima_citazione DESC
        |sql}]
  in
  q () db

let view (_request : Dream.request) (db : Caqti_lwt.connection) =
  match%lwt dati_sitemap db with
  | Ok data -> begin
    Dream.stream
      ~status:`OK
      ~headers:[("content-type", "text/xml; charset=UTF-8")]
      (fun stream ->
        let%lwt () =
          Dream.write
            stream
            {|<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
|}
        in

        let%lwt () =
          Lwt_list.iter_s
            (fun (url, last_mod) ->
              let url = Uri.of_string url |> Uri.to_string in
              let url_xml =
                Printf.sprintf
                  "  <url>\n\
                  \    <loc>%s</loc>\n\
                  \    <lastmod>%s</lastmod>\n\
                  \    <changefreq>monthly</changefreq>\n\
                  \  </url>\n"
                  url
                  last_mod
              in
              Dream.write stream url_xml)
            data
        in
        let%lwt () = Dream.write stream "</urlset>" in
        Lwt.return_unit)
  end
  | Error _e -> begin failwith "TODO" end
