import React, { useState, useEffect, Fragment } from "react";
import { useMediaQuery } from "react-responsive";
import EpisodeSection from "./components/EpisodeSection";
import Message from "./components/Hero/Message";
import HeroLinks from "./components/Hero/HeroLinks";
import Logo from "./components/Hero/Logo";

const App = () => {
    const [datiUltimaPuntata, setDatiUltimaPuntata] = useState({});
    const isMobile = useMediaQuery({ query: "(max-width: 800px)" });

    useEffect(() => {
        fetch("/api/ultima-puntata")
            .then((response) => response.json())
            .then((data) => {
                setDatiUltimaPuntata(data);
            });
    }, []);

    const style = isMobile
        ? { display: "flex", flexDirection: "column", justifyContent: "center", height: "605px" }
        : {};

    return (
        <Fragment>
            <header style={style}>
                <Logo />
                <Message dati={datiUltimaPuntata} />
                <HeroLinks />
                {/* {datiUltimaPuntata.fretta ? <p>Corri! Se aspetti ancora un po' esce il prossimo episodio!</p> : ""} */}
            </header>
            <EpisodeSection />
        </Fragment>
    );
};

export default App;
