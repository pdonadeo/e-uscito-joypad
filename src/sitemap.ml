let view (_ : Dream.request) =
  Dream.stream
    ~status:`OK
    ~headers:[("content-type", "application/xml; charset=UTF-8")]
    (fun stream ->
      let%lwt () =
        Dream.write
          stream
          {|<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.euscitojoypad.it/</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>
|}
      in
      Lwt.return_unit)
