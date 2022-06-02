import { useEffect, useState } from "react";

import classes from "./EpisodeContent.module.css";
import GameBox from "./GameBox";

const EpisodeContent = (props) => {
  const [section, setSection] = useState("");
  const { giochi } = props;

  const recensioni = giochi.filter((gioco) => gioco.tipologia === "Recensione");
  const chiacchiere = giochi.filter((gioco) => gioco.tipologia === "Chiacchiera libera");
  const consigli = giochi.filter((gioco) => gioco.tipologia === "Consiglio");

  useEffect(() => {
    const groupsArr = [recensioni, consigli, chiacchiere];

    const firstActive = groupsArr.findIndex((group) => group.length !== 0);
    if (firstActive === -1) setSection("descrizione");
    if (firstActive === 0) setSection("recensioni");
    if (firstActive === 1) setSection("consigli");
    if (firstActive === 2) setSection("chiacchiere");
  }, []);

  let sectionContent;

  if (section === "recensioni")
    sectionContent = (
      <div>
        {recensioni.map((recensione, index) => (
          <GameBox
            key={index}
            titolo={recensione.titolo}
            speaker={recensione.speaker}
            istante={recensione.istante}
            descrizione={recensione.descrizione_txt}
            cover={recensione.cover}
          />
        ))}
      </div>
    );

  if (section === "consigli")
    sectionContent = (
      <div>
        {consigli.map((consiglio, index) => (
          <GameBox
            key={index}
            titolo={consiglio.titolo}
            speaker={consiglio.speaker}
            istante={consiglio.istante}
            descrizione={consiglio.descrizione_txt}
            cover={consiglio.cover}
          />
        ))}
      </div>
    );

  if (section === "chiacchiere")
    sectionContent = (
      <div>
        {chiacchiere.map((chiacchiera, index) => (
          <GameBox
            key={index}
            titolo={chiacchiera.titolo}
            speaker={chiacchiera.speaker}
            istante={chiacchiera.istante}
            descrizione={chiacchiera.descrizione_txt}
            cover={chiacchiera.cover}
          />
        ))}
      </div>
    );

  const sectionHandler = (section) => {
    setSection(section);
  };

  if (section === "descrizione")
    sectionContent = (
      <div>
        <p className={classes.description}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
          consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
          est laborum
        </p>
      </div>
    );

  return (
    <div>
      <ul className={classes.controls}>
        {recensioni.length !== 0 && (
          <li onClick={sectionHandler.bind(this, "recensioni")}>
            <p className={`${classes.control} ${section === "recensioni" && classes.tagActive}`}>
              RECENSIONI <span>{recensioni.length}</span>
            </p>
          </li>
        )}
        {consigli.length !== 0 && (
          <li onClick={sectionHandler.bind(this, "consigli")}>
            <p className={`${classes.control} ${section === "consigli" && classes.tagActive}`}>
              CONSIGLI <span>{consigli.length}</span>
            </p>
          </li>
        )}
        {chiacchiere.length !== 0 && (
          <li onClick={sectionHandler.bind(this, "chiacchiere")}>
            <p className={`${classes.control} ${section === "chiacchiere" && classes.tagActive}`}>
              CHIACCHIERE <span>{chiacchiere.length}</span>
            </p>
          </li>
        )}
        <li onClick={sectionHandler.bind(this, "descrizione")}>
          <p className={`${classes.control} ${section === "descrizione" && classes.tagActive}`}>DESCRIZIONE</p>
        </li>
      </ul>
      <div className={classes.contentContainer}>{sectionContent}</div>
    </div>
  );
};

export default EpisodeContent;
