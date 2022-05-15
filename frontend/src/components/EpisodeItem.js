import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";

const EpisodeItem = (props) => {
  return (
    <ListTransition className={classes.card}>
      <div>
        <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
      </div>
      <div className={classes.textBox}>
        <p>{props.numero}</p>
        <p>{props.titolo}</p>
        <p>{(props.durata / 60).toFixed(0)} min</p>
        <p>Data di uscita:{props.uscita}</p>
        <a href={props.url}>Ascolta Qua</a>
      </div>
    </ListTransition>
  );
};

export default EpisodeItem;
