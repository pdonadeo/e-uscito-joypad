import { useState, useRef, useEffect } from "react";

import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";

import { ReactComponent as PlusIcon } from "../icons/ICN_Plus.svg";
import EpisodeContent from "./EpisodeContent/EpisodeContent";
import EpisodeNumber from "./UI/EpisodeNumber";

const EpisodeItem = (props) => {
  const cardRef = useRef();

  const yBox = cardRef.current?.offsetTop;
  yBox ? console.log(props.numero, yBox) : console.log("");

  const [section, setSection] = useState("recensioni");
  // const [active, setActive] = useState(false);

  const activeHandler = () => {
    window.scrollTo({ top: yBox, behavior: "smooth" });
    // setActive(!active);
    setTimeout(() => {
      props.onActive(props.index, props.active, props.id);
    }, 300);
  };

  // let activation = props.cardState;
  // if (props.active) {
  //   activation = true;
  // } else {
  //   activation = props.cardState;
  // }

  // useEffect(() => {
  //   console.log("rendering");
  //   console.log(activation);
  // }, [activation]);

  const recensioni = props.giochi.filter((gioco) => gioco.tipologia === "Recensione");
  const chiacchiere = props.giochi.filter((gioco) => gioco.tipologia === "Chiacchiera libera");
  const consigli = props.giochi.filter((gioco) => gioco.tipologia === "Consiglio");

  useEffect(() => {
    const groupsArr = [recensioni, consigli, chiacchiere];
    const firstActive = groupsArr.findIndex((group) => group.length !== 0);
    if (firstActive === -1) setSection("descrizione");
    if (firstActive === 0) setSection("recensioni");
    if (firstActive === 1) setSection("consigli");
    if (firstActive === 2) setSection("chiacchiere");
  }, []);

  return (
    <li ref={cardRef} className={classes.cardBox}>
      <ListTransition className={`${classes.card} ${props.active && classes.active}`} onClick={activeHandler}>
        <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
        <div className={classes.textBox}>
          <EpisodeNumber numero={props.numero} />
          <p className={classes.title}>{props.titolo}</p>
          <div className={classes.additionalInfo}>
            <p className={classes.releaseDate}>{props.uscita.replaceAll("-", ".")} </p>
            <p>&middot;</p>
            <p className={classes.duration}>{(props.durata / 60).toFixed(0)} min.</p>
          </div>
          <div className={classes.actions}>
            <PlusIcon />
          </div>
        </div>
      </ListTransition>
      {props.involved ? (
        <div className={classes.adding}>
          <EpisodeContent
            section={section}
            recensioni={recensioni}
            consigli={consigli}
            chiacchiere={chiacchiere}
            giochi={props.giochi}
          />
        </div>
      ) : (
        ""
      )}
    </li>
  );
};

export default EpisodeItem;
