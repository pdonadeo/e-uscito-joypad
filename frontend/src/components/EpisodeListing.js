import { useState, useCallback, useEffect, useContext } from "react";
import SearchContext from "../store/search-context";

import Fuse from "fuse.js";

import EpisodeItem from "./EpisodeItem";

import classes from "./EpisodeListing.module.css";

const EpisodeListing = () => {
  const [episodeList, setEpisodeList] = useState([]);
  const { searchInput } = useContext(SearchContext);
  const [interestedIndex, setInterestedIndex] = useState();

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

  const activeListHandler = (index, status) => {
    if (status) {
      setInterestedIndex(null);
      return;
    }

    if (index % 2 !== 0) setInterestedIndex(index);
    else {
      index = index + 1;
      setInterestedIndex(index);
    }
  };

  return (
    <ul className={classes.listBox}>
      {episodeResult.map((episode, index) => {
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
            onActive={activeListHandler}
            involved={index === interestedIndex ? true : false}
          />
        );
      })}
    </ul>
  );
};

export default EpisodeListing;
