import { useState } from "react";

import { useMediaQuery } from "react-responsive";

import EpisodeItem from "./EpisodeItem";
import classes from "./EpisodeListing.module.css";


const EpisodeListing = ({ /* listLength, */ episodeList }) => {
   const isMobile = useMediaQuery({ query: "(max-width: 800px)" });
   const [interestedIndex, setInterestedIndex] = useState();
   const [activeCard, setActiveCard] = useState("");

   const activeListHandler = (index, status, numBox, y) => {
      if (numBox === activeCard) {
         setActiveCard(null);
      } else {
         setActiveCard(null);
         if (isMobile) window.scrollTo({ top: y, behavior: "smooth" });
      }
      if (status) {
         setInterestedIndex(null);
         return;
      }
      if (isMobile) {
         setInterestedIndex(index);
         setTimeout(() => {
            setActiveCard(numBox);
         }, 600);
         return;
      }
      if (!isMobile && index % 2 !== 0) {
         setInterestedIndex(index);
         setTimeout(() => {
            setActiveCard(numBox);
         }, 600);
      } else {
         index = index + 1;
         setInterestedIndex(index);
         setTimeout(() => {
            setActiveCard(numBox);
         }, 600);
      }
   };

   return (
      <ul className={classes.listBox}>
         {episodeList.map((episode, index) => {
            return (
               <EpisodeItem
                  index={index}
                  key={episode.episodio_numero}
                  id={episode.episodio_numero}
                  titolo={episode.titolo}
                  url={episode.url_video ? episode.url_video : episode.url}
                  numero={episode.episodio_numero}
                  cover={episode.cover}
                  uscita={episode.data_uscita}
                  durata={episode.durata}
                  giochi={episode.giochi}
                  descrizione={episode.descrizione_txt}
                  onActive={activeListHandler}
                  active={activeCard === episode.episodio_numero}
                  involved={index === interestedIndex ? true : false}
               />
            );
         })}
      </ul>
   );
};

export default EpisodeListing;
