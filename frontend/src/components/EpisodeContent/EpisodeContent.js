import classes from "./EpisodeContent.module.css";

const EpisodeContent = (props) => {
  console.log(props);
  return (
    <div>
      <ul className={classes.controls}>
        <li>
          <div className={classes.control}>RECENSIONI</div>
        </li>
        <li>
          <div className={classes.control}>CONSIGLI</div>
        </li>
        <li>
          <div className={classes.control}>CHIACCHERE</div>
        </li>
        <li>
          <div className={classes.control}>DESCRIZIONE</div>
        </li>
      </ul>
    </div>
  );
};

export default EpisodeContent;
