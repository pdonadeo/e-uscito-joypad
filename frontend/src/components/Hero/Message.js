import classes from "./Message.module.css";

const Message = (props) => {
  const { ep_num, giorni_fa, titolo, uscito, data_italiano, msg_risposta_no } = props.dati;

  if (uscito) {
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
          {msg_risposta_no ? (
            <span className={classes.comment}>{ msg_risposta_no }</span>
          ) : (
            <span></span>
          )}
        </p>
      </div>
    );
};

export default Message;
