import classes from "./Message.module.css";

const Message = (props) => {
  const { ep_num, giorni_fa, titolo, uscito, data_italiano, rompi_le_palle } = props.dati;

  if (!uscito) {
    return (
      <div className={classes.wrapper}>
        <p className={classes.message}>
          <span className={classes.bold}>Sì!</span> <br /> È uscito {giorni_fa} l'episodio
          <br /> <span className={classes.bold}>numero {ep_num}</span> <br />
          di Joypad, dal titolo <br />
          &#171;{titolo}&#187;
        </p>
      </div>
    );
  } else
    return (
      <div className={classes.wrapper}>
        <p className={classes.message}>
          <span className={classes.bold}>No.</span> <br /> L'ultimo episodio è uscito {giorni_fa},
          <br /> <span className={classes.date}> {data_italiano}.</span> <br />
          {rompi_le_palle ? (
            <span className={classes.comment}>Mi duole ammetterlo ma è giunto il momento di protestare!</span>
          ) : (
            <span className={classes.comment}>Però adesso non torturare Zampa, aspetta ancora qualche giorno…</span>
          )}
        </p>
      </div>
    );
};

export default Message;
