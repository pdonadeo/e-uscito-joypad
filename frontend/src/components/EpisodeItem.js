import classes from "./EpisodeItem.module.css";

const EpisodeItem = (props) => {
  return (
    <div className={classes.card}>
      <div>
        <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
      </div>
      <div className={classes.textBox}>
        <p>{props.numero}</p>
        <p>{props.titolo}</p>
        <p>Data di uscita:{props.uscita}</p>
        <a href={props.url}>Ascolta Qua</a>
      </div>
    </div>
  );
};

export default EpisodeItem;
