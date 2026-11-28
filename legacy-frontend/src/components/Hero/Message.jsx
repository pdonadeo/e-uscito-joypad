import classes from "./Message.module.css";

const Message = ({ dati }) => {
  const { ep_num, giorni_fa, titolo, uscito, data_italiano, msg_risposta_no } =
    dati;

  let ep_num_decoded = null;
  if (ep_num) {
    if (ep_num[0] === "Intero") {
      ep_num_decoded = `numero ${ep_num[1]}`;
    } else if (ep_num[0] === "Stringa") {
      ep_num_decoded = ep_num[1];
    } else {
      ep_num_decoded = "";
    }
  } else {
    return <div />;
  }

  if (uscito) {
    return (
      <div className={classes.wrapper}>
        <p tabIndex={0} id="for-prerender" className={classes.message}>
          <span className={classes.bold}>Sì!</span> <br /> È uscito {giorni_fa}{" "}
          l&apos;episodio
          <br /> <span className={classes.bold}>{ep_num_decoded}</span> <br />
          di Joypad, dal titolo <br />
          &#171;{titolo}&#187;
        </p>
      </div>
    );
  } else
    return (
      <div className={classes.wrapper}>
        <p tabIndex={0} id="for-prerender" className={classes.message}>
          <span className={classes.bold}>No.</span> <br /> L&apos;ultimo
          episodio è uscito {giorni_fa},
          <br /> <span className={classes.date}> {data_italiano}.</span> <br />
          {msg_risposta_no ? (
            <span className={classes.comment}>{msg_risposta_no}</span>
          ) : (
            <span></span>
          )}
        </p>
      </div>
    );
};

export default Message;
