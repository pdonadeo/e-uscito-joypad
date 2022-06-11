import { useState } from "react";

import classes from "./EpisodeContent.module.css";
import GameBox from "./GameBox";

const EpisodeContent = (props) => {
  const [section, setSection] = useState(props.section);
  const { recensioni, consigli, chiacchiere } = props;

  const createContent = (section) => {
    return (
      <div>
        {section.map((element, index) => (
          <GameBox
            key={index}
            titolo={element.titolo}
            speaker={element.speaker}
            istante={element.istante}
            descrizione={element.descrizione_txt}
            cover={element.cover}
          />
        ))}
      </div>
    );
  };

  let sectionContent;

  if (section === "recensioni") sectionContent = createContent(props.recensioni);
  if (section === "consigli") sectionContent = createContent(props.consigli);
  if (section === "chiacchiere") sectionContent = createContent(props.chiacchiere);

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

  const sectionHandler = (section) => {
    setSection(section);
  };

  return (
    <div className={classes.containerAnimation}>
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
