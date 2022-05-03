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

let%html non_rompere_msg = {|
    <h2><em>Però adesso non torturare Zampa, aspetta ancora qualche giorno…</em></h2>
  |}

let%html rompi_pure_msg = {|
    <h2><em>Mi duole ammetterlo ma è giunto il momento di protestare!</em></h2>
  |}

let%html risposta_no giorni_fa data_italiano rompi_le_palle =

  {|
  <div>
  <h1>No. L'ultimo episodio è uscito |} [txt giorni_fa] {|, |} [txt data_italiano] {|.</h1>
  |}[(
    if rompi_le_palle
    then rompi_pure_msg
    else non_rompere_msg
  )]{| </div> |}

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

let%html main uscito fretta giorni_fa data_italiano ep_num titolo rompi_le_palle =
  {|
    <main id="root">
    |}[(
      if uscito
        then risposta_si giorni_fa data_italiano ep_num titolo
        else risposta_no giorni_fa data_italiano rompi_le_palle
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

let index uscito fretta giorni_fa data_italiano ep_num titolo rompi_le_palle =
  let open Soup in

  let index = React.react_build_index () in
  let index_s = Format.asprintf "%a" (pp ()) index in
  let soup_i = parse index_s in

  let main = main uscito fretta giorni_fa data_italiano ep_num titolo rompi_le_palle in
  let main_s =  Format.asprintf "%a" (pp_elt ()) main in
  let soup_m = parse main_s in

  replace (soup_i $ "main#root") soup_m;
  to_string soup_i
