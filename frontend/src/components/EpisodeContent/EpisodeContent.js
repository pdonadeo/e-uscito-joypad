import { useState } from "react";

import classes from "./EpisodeContent.module.css";

const EpisodeContent = (props) => {
  const [section, setSection] = useState("consigli");
  const { giochi } = props;

  console.log(giochi);

  const recensioni = giochi.filter((gioco) => gioco.tipologia === "Recensione");
  const chiacchiere = giochi.filter((gioco) => gioco.tipologia === "Chiacchiera libera");
  const consigli = giochi.filter((gioco) => gioco.tipologia === "Consiglio");
  console.log("Recensioni", recensioni);
  console.log("Consigli", consigli);
  console.log("Chiacchiere", chiacchiere);

  let sectionContent;

  if (section === "recensioni")
    sectionContent = (
      <div>
        {recensioni.map((recensione, index) => (
          <h3 key={index}>{recensione.titolo}</h3>
        ))}
      </div>
    );

  if (section === "consigli")
    sectionContent = (
      <div>
        {consigli.map((consiglio, index) => (
          <h3 key={index}>{consiglio.titolo}</h3>
        ))}
      </div>
    );

  if (section === "chiacchiere")
    sectionContent = (
      <div>
        {chiacchiere.map((chiacchiera, index) => (
          <h3 key={index}>{chiacchiera.titolo}</h3>
        ))}
      </div>
    );

  const sectionHandler = (section) => {
    setSection(section);
  };

  if (section === "descrizione")
    sectionContent = (
      <div>
        <h3>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum
        </h3>
      </div>
    );

  return (
    <div>
      <ul className={classes.controls}>
        <li onClick={sectionHandler.bind(this, "recensioni")}>
          <p className={`${classes.control} ${section === "recensioni" && classes.tagActive}`}>
            RECENSIONI <span>{recensioni.length}</span>
          </p>
        </li>
        <li onClick={sectionHandler.bind(this, "consigli")}>
          <p className={`${classes.control} ${section === "consigli" && classes.tagActive}`}>
            CONSIGLI <span>{consigli.length}</span>
          </p>
        </li>
        <li onClick={sectionHandler.bind(this, "chiacchiere")}>
          <p className={`${classes.control} ${section === "chiacchiere" && classes.tagActive}`}>
            CHIACCHIERE <span>{chiacchiere.length}</span>
          </p>
        </li>
        <li onClick={sectionHandler.bind(this, "descrizione")}>
          <p className={`${classes.control} ${section === "descrizione" && classes.tagActive}`}>DESCRIZIONE</p>
        </li>
      </ul>
      <div className={classes.contentContainer}>{sectionContent}</div>
    </div>
  );
};

export default EpisodeContent;
