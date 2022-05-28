import classes from "./GameBox.module.css";

const GameBox = (props) => {
  const { titolo, speaker, istante } = props;

  const minutes = Math.floor(istante / 60);
  const seconds = istante - minutes * 60;

  return (
    <div className={classes.container}>
      <div className={classes.textBox}>
        <h3 className={classes.title}> &gt; {titolo}</h3>
        <p className={classes.speaker}>SPEAKER: {speaker}</p>
      </div>
      <div className={classes.timeStamp}>
        <p>
          {minutes}' {seconds}''
        </p>
      </div>
    </div>
  );
};

export default GameBox;
