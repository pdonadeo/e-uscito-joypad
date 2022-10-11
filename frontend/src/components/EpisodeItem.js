import { useState, useEffect } from "react";

import ListTransition from "../CustomHooks/ListTransition";
import classes from "./EpisodeItem.module.css";
import { useMediaQuery } from "react-responsive";

import { ReactComponent as PlusIcon } from "../icons/ICN_Plus.svg";
import EpisodeContent from "./EpisodeContent/EpisodeContent";
import EpisodeNumber from "./UI/EpisodeNumber";
import PlayButton from "./UI/PlayButton";

const EpisodeItem = (props) => {
   const isMobile = useMediaQuery({ query: "(max-width: 800px)" });

   const y = 649 + props.index * 138;

   // const yBox = cardRef.current?.offsetTop;
   // yBox ? console.log(props.numero, yBox) : console.log(null);

   // const [active, setActive] = useState(false);

   const activeHandler = (event) => {
      // window.scrollTo({ top: y, behavior: "smooth" });
      // setActive(!active);
      // setTimeout(() => {
      // event.preventDefault();
      props.onActive(props.index, props.active, props.id, y);
      // }, 500);
   };

   const recensioni = props.giochi.filter((gioco) => gioco.tipologia === "Recensione");
   const chiacchiere = props.giochi.filter((gioco) => gioco.tipologia === "Chiacchiera libera");
   const consigli = props.giochi.filter((gioco) => gioco.tipologia === "Consiglio");

   return (
      <>
         <li className={classes.cardBox}>
            <ListTransition className={`${classes.card} ${props.active && classes.active}`} onClick={activeHandler}>
               <img className={classes.cover} src={props.cover} alt={`cover dell'episodio ${props.numero}`} />
               <div className={classes.textBox}>
                  <div className={classes.firstBox}>
                     <EpisodeNumber numero={props.numero} />
                     <div className={classes.playButton}>
                        <PlayButton url={props.url} />
                     </div>
                  </div>
                  <p className={classes.title}>{props.titolo}</p>
                  <div className={classes.additionalInfo}>
                     <p className={classes.releaseDate}>{props.uscita.replaceAll("-", ".")} </p>
                     <p>&middot;</p>
                     <p className={classes.duration}>{(props.durata / 60).toFixed(0)} min.</p>
                  </div>
                  <div className={classes.actions}>
                     <p>DETTAGLI</p>
                     <PlusIcon />
                  </div>
               </div>
            </ListTransition>
         </li>
         {props.active ? (
            <li
               className={classes.adding}
               // style={!isMobile ? { transform: `translateX(${checkEvenIndex(props.index) ? "50%" : "-50%"})` } : {}}
               style={!isMobile ? { gridRowStart: `${Math.floor(props.index / 2 + 2)}` } : {}}
            >
               <EpisodeContent
                  section='descrizione'
                  recensioni={recensioni}
                  consigli={consigli}
                  chiacchiere={chiacchiere}
                  giochi={props.giochi}
                  descrizione={props.descrizione}
               />
            </li>
         ) : (
            ""
         )}
      </>
   );
};

export default EpisodeItem;
