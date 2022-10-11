import React, { useState, useEffect, Fragment, useContext } from "react";
import { useMediaQuery } from "react-responsive";
import EpisodeSection from "./components/EpisodeSection";
import Message from "./components/Hero/Message";
import HeroLinks from "./components/Hero/HeroLinks";
import Logo from "./components/Hero/Logo";
import SearchContext from "./store/search-context";

const App = () => {
  const [datiUltimaPuntata, setDatiUltimaPuntata] = useState({});
  const isMobile = useMediaQuery({ query: "(max-width: 800px)" });
  const { searchInput } = useContext(SearchContext);

  const maxNumbersOfEpisodes = 8;

  useEffect(() => {
    fetch("/api/ultima-puntata")
      .then((response) => response.json())
      .then((data) => {
        setDatiUltimaPuntata(data);
      });
  }, []);

  const style = isMobile
    ? {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "605px",
      }
    : {};

  return (
    <Fragment>
      <header style={style}>
        <Logo />
        <div
          style={
            !isMobile
              ? {
                  display: "flex",
                  flexDirection: "row",
                  margin: "0 auto",
                  width: "91.9rem",
                  justifyContent: "space-between",
                }
              : {}
          }
        >
          <Message dati={datiUltimaPuntata} />
          <HeroLinks />
        </div>
        <p style={{fontSize: "1.6rem", textAlign: "center"}}>{searchInput.trim() === "" ? `Ecco gli ultimi ${maxNumbersOfEpisodes} episodi!`: 'Se ne è parlato qui:'}</p>
      </header>
      <EpisodeSection maxNumberOfEpisode={maxNumbersOfEpisodes}/>
    </Fragment>
  );
};

export default App;
