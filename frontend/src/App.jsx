import React, { useState, useEffect } from "react";

import EpisodeSection from "./components/EpisodeSection";
import Message from "./components/Hero/Message";
import HeroLinks from "./components/Hero/HeroLinks";

const App = () => {
  const [datiUltimaPuntata, setDatiUltimaPuntata] = useState({});

  useEffect(() => {
    fetch("/api/ultima-puntata")
      .then((response) => response.json())
      .then((data) => {
        setDatiUltimaPuntata(data);
      });
  }, []);

  return (
    <div>
      <Message dati={datiUltimaPuntata} />
      <HeroLinks />
      {/* {datiUltimaPuntata.fretta ? <p>Corri! Se aspetti ancora un po' esce il prossimo episodio!</p> : ""} */}
      <EpisodeSection />
    </div>
  );
};

export default App;
