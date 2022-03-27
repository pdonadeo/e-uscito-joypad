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

let index risposta uscito fretta =
  <!DOCTYPE html>
  <html lang="en">

  <head>
      <meta charset="UTF-8">
      <meta name="google-site-verification" content="RVQl_YUzLnpzfD8LfW0RND3EgYD_grzfjKCwshqJ1Xg" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="ie=edge">
      <title>È uscito Joypad?</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500&display=swap" rel="stylesheet">

      <link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32x32.png">
      <link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16x16.png">
      <link rel="manifest" href="/static/site.webmanifest">
      <style>
          body {
              font-family: 'Montserrat', sans-serif;
              text-align: center;
              background-color: beige;
          }

          h1 {
              margin: auto;
              margin-top: 3em;
              width: 75%;
          }

          p {
            margin: auto;
            margin-top: 2em;
            text-align: left;
            width: 75%;
            font-style: italic;
            font-size: 20px;
          }
      </style>
  </head>

  <body>
      <h1>
          <%s risposta %>
      </h1>

      <%s! if uscito then dove_ascoltare () else "" %>

      <%s! if fretta then corri () else "" %>
  </body>

  </html>