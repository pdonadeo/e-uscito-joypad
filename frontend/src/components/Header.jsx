import { useState, useEffect } from "react";
import Message from "./Hero/Message";
import HeroLinks from "./Hero/HeroLinks";
import Logo from "./Hero/Logo";
import classes from "./Header.module.css";

const Header = () => {
  const [datiUltimaPuntata, setDatiUltimaPuntata] = useState({});

  useEffect(() => {
    fetch("/api/ultima-puntata")
      .then((response) => response.json())
      .then((data) => {
        setDatiUltimaPuntata(data);
      });
  }, []);

  return (
    <header>
      <Logo />
      <div className={classes.innerRow}>
        <Message dati={datiUltimaPuntata} />
        <HeroLinks />
      </div>
    </header>
  );
};

export default Header;
