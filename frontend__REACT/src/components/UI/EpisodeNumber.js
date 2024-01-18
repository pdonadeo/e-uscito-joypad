import classes from "./EpisodeNumber.module.css";

const EpisodeNumber = (props) => {
  if (props.numero.includes("v")) {
    return <p className={classes.video}>Video #{props.numero.slice(1)}</p>;
  }
  if (props.numero.includes("extra") || props.numero.includes("speciale")) {
    return <p className={classes.video}>{props.numero}</p>;
  }

  return <p className={classes.number}>{props.numero}.</p>;
};

export default EpisodeNumber;
