import { ReactComponent as PlayIcon } from "../../icons/ICN_Play.svg";

import classes from "./PlayButton.module.css";

const PlayButton = (props) => {
    return (
        <a href={props.url}>
            <div className={classes.wrapper}>
                <div className={classes.button}>
                    <p>Play</p>
                    <PlayIcon />
                </div>
            </div>
        </a>
    );
};

export default PlayButton;
