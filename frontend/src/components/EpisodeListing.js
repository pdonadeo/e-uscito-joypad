import { useState, useCallback, useEffect, useContext } from "react";
import SearchContext from "../store/search-context";

import Fuse from "fuse.js";

import EpisodeItem from "./EpisodeItem";

import classes from "./EpisodeListing.module.css";
import { AnimatePresence } from "framer-motion";
import ListTransition from "../CustomHooks/ListTransition";

const EpisodeListing = () => {
  const [episodeList, setEpisodeList] = useState([]);
  const { searchInput } = useContext(SearchContext);
  console.log("rendering");

  const fetchEpisode = useCallback(async () => {
    try {
      const response = await fetch("./api/db-data");
      if (!response.ok) {
        throw new Error("Something went wrong!");
      }
      const data = await response.json();

      setEpisodeList(data.episodi);
      // console.log(data);
    } catch (error) {
      console.log(error.message);
    }
  }, []);
  useEffect(() => {
    fetchEpisode();
  }, [fetchEpisode]);

  const fuse = new Fuse(episodeList, {
    keys: ["titolo"],
    includeScore: true,
    includeMatches: true,
    threshold: 0.5,
    findAllMatches: true,
  });

  const results = fuse.search(searchInput);

  const episodeResult = searchInput ? results.map((result) => result.item) : episodeList;

  console.log(episodeResult);

  // const arrInputs = searchInput.includes(" ") ? searchInput.split(" ") : [searchInput];

  // let filteredQuotes = [];

  // const filterSearch = (words) =>
  //   episodeList.filter((s) =>
  //     words.some(
  //       (w) => s.titolo.toLowerCase().includes(w.toLowerCase())
  //       // || s.body.toLowerCase().includes(w.toLowerCase())
  //     )
  //   );

  // const trimArr = arrInputs.join(" ").trim().split(" ");

  // if (arrInputs.length > 0) {
  //   filteredQuotes = filterSearch(trimArr);
  // } else filteredQuotes = episodeList;

  return (
    <ul className={classes.listBox}>
      {episodeResult.map((episode) => {
        return (
          <EpisodeItem
            key={episode.episodio_numero}
            id={episode.episodio_numero}
            titolo={episode.titolo}
            url={episode.url_post}
            numero={episode.episodio_numero}
            cover={episode.cover}
            uscita={episode.data_uscita}
          />
        );
      })}
    </ul>
  );
};

export default EpisodeListing;
