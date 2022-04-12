let dove_ascoltare () =
  <p>Ascolta la puntata <a href="https://www.ilpost.it/podcasts/joypad/">sulla pagina del Post</a>,
    sull’<a href="https://app.ilpost.it/">app</a> o sulle principali piattaforme:
    <a href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ">Spotify</a>,
    <a href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4">Apple Podcast</a> e
    <a href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk">Google Podcast</a>.
  </p>

let corri () =
  <p>
    Corri! Se aspetti ancora un po' esce il prossimo episodio!
  </p>

let risposta_si giorni_fa data_italiano ep_num titolo =
  <h1>Sì! È uscito <span title="<%s data_italiano %>"><%s! giorni_fa %></span> <u>l'episodio</u> numero <%d ep_num %> di Joypad, dal titolo
  <em> «<%s titolo %>» </em>
  </h1>

let risposta_no giorni_fa data_italiano _ep_num _titolo =
  <h1>No. L'ultimo episodio è uscito <%s giorni_fa%>, <%s data_italiano %>.</h1>

let index uscito fretta giorni_fa data_italiano ep_num titolo =
  <!DOCTYPE html>
  <html lang="it">

  <head>
    <meta charset="UTF-8">
    <meta name="google-site-verification" content="RVQl_YUzLnpzfD8LfW0RND3EgYD_grzfjKCwshqJ1Xg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>È uscito Joypad?</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
      href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900&display=swap"
      rel="stylesheet">


    <link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16x16.png">
    <link rel="manifest" href="/static/site.webmanifest">
    <style>
      body {
        min-height: calc(100vh - 20px);
        margin: 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-family: 'Montserrat', sans-serif;
        text-align: left;
        background-color: #f7f7f7;
      }

      header {
        display: flex;
        justify-content: center;
        height: 30vh;
      }

      header img {
        height: 100%;
      }

      h1 {
        margin: auto;
        width: 80%;
        font-size: 20px;
        line-height: 25px;
        font-weight: 700;
        margin-top: 10px;
        margin-bottom: 10px;
      }

      h1 em {
        font-weight: 900;
      }

      p {
        margin: auto;
        text-align: left;
        width: 80%;
        font-size: 15px;
        line-height: 20px;
        margin-top: 10px;
        margin-bottom: 10px;
      }

      .nota {
        font-style: italic;
        font-size: 12px;
        line-height: 15px;
      }

      a {
        color: #29ABE2;
        font-weight: 700;
        text-decoration: unset;
        transition: color 0.2s;
        -webkit-transition: color 0.2s;
      }

      a:hover {
        color: #313131;
        transition: color 0.2s;
        -webkit-transition: color 0.2s;
      }

      footer {
        height: 30px;
        margin-top: 20px;
        margin-bottom: 20px;
      }

      footer p {
        font-size: 10px;
        line-height: 12px;
        text-align: center;
      }
    </style>
  </head>

  <body>
    <header>
      <img src="/static/joypad-img.jpg" alt="È uscito Joypad?">
    </header>

    <main>
      <%s! if uscito
        then risposta_si giorni_fa data_italiano ep_num titolo
        else risposta_no giorni_fa data_italiano ep_num titolo %>

      <%s! dove_ascoltare () %>

      <%s! if fretta then corri () else "" %>

      <p class="nota">Nota per gli autori del podcast: il sito è pubblicato gratuitamente e con licenza open su
        <a href="https://github.com/pdonadeo/e-uscito-joypad">GitHub</a> e
        potete fare tutte le richieste che volete
        <a href="https://github.com/pdonadeo/e-uscito-joypad/issues">qui</a>.
      </p>
    </main>

    <footer>
      <p>Copyright © 2022 Paolo Donadeo.<br>Rilasciato sotto licenza MIT, vedi <a
          href="https://github.com/pdonadeo/e-uscito-joypad/blob/main/LICENSE">LICENSE.md</a></p>
    </footer>
  </body>

  </html>