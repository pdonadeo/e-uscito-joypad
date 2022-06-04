import { useState, useRef } from "react";

import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";

import { ReactComponent as PlusIcon } from "../icons/ICN_Plus.svg";
import EpisodeContent from "./EpisodeContent/EpisodeContent";
import EpisodeNumber from "./UI/EpisodeNumber";

const EpisodeItem = (props) => {
  const cardRef = useRef();
  // const [active, setActive] = useState(false);

  const activeHandler = () => {
    // setActive(!active);
    props.onActive(props.index, props.active, props.id);
    const yBox = cardRef.current.offsetTop;
    window.scrollTo({ top: yBox, behavior: "smooth" });
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
          <EpisodeContent giochi={props.giochi} />
        </div>
      ) : (
        ""
      )}
    </li>
  );
};

export default EpisodeItem;
