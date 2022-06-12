import React, { useState, useEffect, Fragment } from "react";

import EpisodeSection from "./components/EpisodeSection";
import Message from "./components/Hero/Message";
import HeroLinks from "./components/Hero/HeroLinks";
import Logo from "./components/Hero/Logo";

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
        <Fragment>
            <header style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "605px" }}>
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
