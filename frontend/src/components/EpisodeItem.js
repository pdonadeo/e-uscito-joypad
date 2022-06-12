import { useState, useEffect } from "react";

import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";

import { ReactComponent as PlusIcon } from "../icons/ICN_Plus.svg";
import EpisodeContent from "./EpisodeContent/EpisodeContent";
import EpisodeNumber from "./UI/EpisodeNumber";

const EpisodeItem = (props) => {
    const [section, setSection] = useState("recensioni");

    const y = 605 + props.index * 133;

    // const yBox = cardRef.current?.offsetTop;
    // yBox ? console.log(props.numero, yBox) : console.log(null);

    // const [active, setActive] = useState(false);

    const activeHandler = (event) => {
        // window.scrollTo({ top: y, behavior: "smooth" });
        // setActive(!active);
        // setTimeout(() => {
        event.preventDefault();
        props.onActive(props.index, props.active, props.id, y);
        // }, 500);
    };

    // let activation = props.cardState;
    // if (props.active) {
    //   activation = true;
    // } else {
    //   activation = props.cardState;
    // }

    // useEffect(() => {
    //   console.log("rendering");
    //   console.log(activation);
    // }, [activation]);

    const recensioni = props.giochi.filter((gioco) => gioco.tipologia === "Recensione");
    const chiacchiere = props.giochi.filter((gioco) => gioco.tipologia === "Chiacchiera libera");
    const consigli = props.giochi.filter((gioco) => gioco.tipologia === "Consiglio");

    useEffect(() => {
        const groupsArr = [recensioni, consigli, chiacchiere];
        const firstActive = groupsArr.findIndex((group) => group.length !== 0);
        if (firstActive === -1) setSection("descrizione");
        if (firstActive === 0) setSection("recensioni");
        if (firstActive === 1) setSection("consigli");
        if (firstActive === 2) setSection("chiacchiere");
    }, []);

    return (
        <li className={classes.cardBox}>
            <a href={props.url}>
                <ListTransition className={`${classes.card} ${props.active && classes.active}`}>
                    <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
                    <div className={classes.textBox}>
                        <EpisodeNumber numero={props.numero} />
                        <p className={classes.title}>{props.titolo}</p>
                        <div className={classes.additionalInfo}>
                            <p className={classes.releaseDate}>{props.uscita.replaceAll("-", ".")} </p>
                            <p>&middot;</p>
                            <p className={classes.duration}>{(props.durata / 60).toFixed(0)} min.</p>
                        </div>
                        <div className={classes.actions} onClick={activeHandler}>
                            <PlusIcon />
                        </div>
                    </div>
                </ListTransition>
            </a>
            {props.active ? (
                <div className={classes.adding}>
                    <EpisodeContent
                        section={section}
                        recensioni={recensioni}
                        consigli={consigli}
                        chiacchiere={chiacchiere}
                        giochi={props.giochi}
                    />
                </div>
            ) : (
                ""
            )}
        </li>
    );
};

export default EpisodeItem;
