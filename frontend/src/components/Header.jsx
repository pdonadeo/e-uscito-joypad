import { useState, useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import Message from "./Hero/Message";
import HeroLinks from "./Hero/HeroLinks";
import Logo from "./Hero/Logo";

const Header = () => {
  const [datiUltimaPuntata, setDatiUltimaPuntata] = useState({});
  const isMobile = useMediaQuery({ query: "(max-width: 920px)" });

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
    </header>
  );
};

export default Header;
