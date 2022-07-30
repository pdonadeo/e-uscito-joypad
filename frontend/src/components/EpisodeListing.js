import { useState, useCallback, useEffect, useContext } from "react";
import SearchContext from "../store/search-context";
import { useMediaQuery } from "react-responsive";

import Fuse from "fuse.js";

import EpisodeItem from "./EpisodeItem";

import classes from "./EpisodeListing.module.css";

const EpisodeListing = () => {
   const isMobile = useMediaQuery({ query: "(max-width: 800px)" });
   const [episodeList, setEpisodeList] = useState([]);
   const { searchInput, list } = useContext(SearchContext);
   const [interestedIndex, setInterestedIndex] = useState();

   ///////// ACTIVE TEST
   const [activeCard, setActiveCard] = useState("");

   const fetchEpisode = useCallback(async () => {
      try {
         const response = await fetch("./api/db-data");
         if (!response.ok) {
            throw new Error("Something went wrong!");
         }
         const data = await response.json();
         // console.log(data);
         setEpisodeList(data.episodi);
      } catch (error) {
         console.error(error.message);
      }
   }, []);
   useEffect(() => {
      fetchEpisode();
   }, [fetchEpisode]);

   const fuse = new Fuse(episodeList, {
      keys: ["giochi.titolo"],
      includeScore: true,
      includeMatches: true,
      threshold: 0.3936363,
      findAllMatches: true,
   });

   const results = fuse.search(searchInput);

   let episodeResult = searchInput ? results.map((result) => result.item) : episodeList;

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

   episodeResult.sort((a, b) => new Date(b.data_uscita) - new Date(a.data_uscita));
   let episodes = [];
   if (list === "ascending") {
      episodes = episodeResult;
   } else if (list === "descending") episodes = episodeResult.reverse();

   return (
      <ul className={classes.listBox}>
         {episodes.map((episode, index) => {
            return (
               <EpisodeItem
                  index={index}
                  key={episode.episodio_numero}
                  id={episode.episodio_numero}
                  titolo={episode.titolo}
                  url={episode.url_post}
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
