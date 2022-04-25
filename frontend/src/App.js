import React from "react";

import RispostaSi from "./RispostaSi";
import RispostaNo from "./RispostaNo";


function App() {
  const [datiUltimaPuntata, setDatiUltimaPuntata] = React.useState({});

  React.useEffect(() => {
    console.log("App.js: useEffect");
    fetch("/api/ultima-puntata")
      .then(response => response.json())
      .then(data => {
        setDatiUltimaPuntata(data);
      });
  }, []);

  return (<>
    {datiUltimaPuntata.uscito ? <RispostaSi dati={datiUltimaPuntata} /> : <RispostaNo dati={datiUltimaPuntata} />}

    <p>
      Ascolta la puntata <a href="https://www.ilpost.it/podcasts/joypad/">sulla pagina del Post</a>,&nbsp;
      sull’<a href="https://app.ilpost.it/">app</a> o sulle principali piattaforme:&nbsp;
      <a href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ">Spotify</a>,&nbsp;
      <a href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4">Apple Podcast</a> e&nbsp;
      <a href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk">Google Podcast</a>.
    </p>

    {datiUltimaPuntata.fretta ? <p>
      Corri! Se aspetti ancora un po' esce il prossimo episodio!
    </p> : ""
    }

    <p class="nota">Nota per gli autori del podcast: il sito è pubblicato gratuitamente e con licenza open su&nbsp;
      <a href="https://github.com/pdonadeo/e-uscito-joypad">GitHub</a> e&nbsp;
      potete fare tutte le richieste che volete&nbsp;
      <a href="https://github.com/pdonadeo/e-uscito-joypad/issues">qui</a>.
    </p>
  </>);
}

export default App;
