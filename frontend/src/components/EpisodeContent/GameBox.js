import { Fragment, useState } from "react";
import classes from "./GameBox.module.css";

import { ReactComponent as IconClose } from "../../icons/ICN_Close.svg";
import ListTransition from "../../CustomHooks/ListTransition";

const GameBox = (props) => {
    const [showGame, setShowGame] = useState(false);
    const { titolo, speaker, istante, descrizione, cover } = props;

    const minutes = Math.floor(istante / 60);
    const seconds = istante - minutes * 60;

    // const backdrop = ReactDOM.createPortal(
    //   <div className={`${classes.modal} ${showGame ? classes.showModalGame : ""} `}>
    //     <p>{descrizione}</p>
    //   </div>,
    //   document.getElementById("modal")
    // );

    const showGameHandler = () => {
        setShowGame((previousState) => !previousState);
        document.querySelector("body").style = `overflow: ${!showGame ? "hidden" : "scroll"}`;
    };

    return (
        <Fragment>
            <div className={classes.container} onClick={showGameHandler}>
                <div className={classes.textBox}>
                    <h3 className={classes.title}> &rsaquo; {titolo}</h3>
                    <p className={classes.speaker}>
                        <span>speaker</span>: {speaker}
                    </p>
                </div>
                <div className={classes.timeStamp}>
                    <p>
                        {minutes}' {seconds}''
                    </p>
                </div>
            </div>
            <ListTransition>
                <div className={`${classes.modal} ${showGame ? classes.showModalGame : ""} `}>
                    <div className={classes.firstRow}>
                        <h2 className={classes.gameTitle}>{titolo}</h2>
                        <div onClick={showGameHandler} className={classes.closeButton}>
                            <IconClose />
                        </div>
                    </div>
                    <img src={cover} alt={`cover di ${titolo}`} className={classes.gameImage} />
                    <p className={classes.gameDescription}>{descrizione}</p>
                </div>
            </ListTransition>
        </Fragment>
    );
};

export default GameBox;
