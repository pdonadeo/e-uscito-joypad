import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";

import { ReactComponent as PlusIcon } from "../icons/ICN_Plus.svg";

const EpisodeItem = (props) => {
  return (
    <ListTransition className={classes.card}>
      <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
      <div className={classes.textBox}>
        <p className={classes.number}>{props.numero}.</p>
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
  );
};

export default EpisodeItem;
