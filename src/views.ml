open Tyxml
open Html

let%html risposta_si giorni_fa data_italiano ep_num titolo =
  {|
  <h1>Sì! È uscito |}
    [span ~a:[a_title data_italiano] [txt giorni_fa]]
    {|
    <u>l'episodio</u> numero |}
    [Html.txt (string_of_int ep_num)]
    {| di Joypad, dal titolo
  <em> «|}
    [Html.txt titolo]
    {|» </em>
  </h1>
  |}

let%html risposta_no giorni_fa data_italiano =
  {|
  <h1>No. L'ultimo episodio è uscito |} [txt giorni_fa] {|, |} [txt data_italiano] {|.</h1>
  |}

let%html dove_ascoltare () =
  {|<p>Ascolta la puntata <a href="https://www.ilpost.it/podcasts/joypad/">sulla pagina del Post</a>,
    sull’<a href="https://app.ilpost.it/">app</a> o sulle principali piattaforme:
    <a href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ">Spotify</a>,
    <a href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4">Apple Podcast</a> e
    <a href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk">Google Podcast</a>.
  </p>|}

let%html corri () = {|<p>
    Corri! Se aspetti ancora un po' esce il prossimo episodio!
  </p>|}

let%html main uscito fretta giorni_fa data_italiano ep_num titolo =
  {|
    <main id="root">
    |}[(
      if uscito
        then risposta_si giorni_fa data_italiano ep_num titolo
        else risposta_no giorni_fa data_italiano
      )]
    {|

    |} [ dove_ascoltare () ] {|

    |} [ (if fretta then corri () else txt "") ] {|

    <p class="nota">Nota per gli autori del podcast: il sito è pubblicato gratuitamente e con licenza open su
      <a href="https://github.com/pdonadeo/e-uscito-joypad">GitHub</a> e
      potete fare tutte le richieste che volete
      <a href="https://github.com/pdonadeo/e-uscito-joypad/issues">qui</a>.
    </p>
</main>
  |}

let%html index uscito fretta giorni_fa data_italiano ep_num titolo =
  {|
  <!DOCTYPE html>
  <html lang="it">

  <head>
    <meta charset="UTF-8">
    <meta name="google-site-verification" content="RVQl_YUzLnpzfD8LfW0RND3EgYD_grzfjKCwshqJ1Xg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="Semplice pagina di informazione per sapere se e quando è uscito Joypad, il podcast a tema videoludico di Matteo Bordone (Corri!), Francesco Fossetti (Salta!) e Alessandro Zampini (Spara! per finta)." />
    <title>È uscito Joypad?</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link
      href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
      rel="stylesheet">


    <link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16x16.png">
    <link rel="manifest" href="/static/site.webmanifest">
    <link rel="stylesheet" href="/static/e-uscito-joypad.css" media="print" onload="this.media='all'">
  </head>

  <body>
    <header>
      <img src="/static/joypad-img.jpg" alt="È uscito Joypad?">
    </header>

    |} [ main uscito fretta giorni_fa data_italiano ep_num titolo ] {|

    <footer>
      <p>Copyright © 2022 Paolo Donadeo.<br>Rilasciato sotto licenza MIT, vedi <a
          href="https://github.com/pdonadeo/e-uscito-joypad/blob/main/LICENSE">LICENSE.md</a></p>
    </footer>
  </body>

  </html>
  |}