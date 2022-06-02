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
  const [allActive, setAllActive] = useState(false);

  const fetchEpisode = useCallback(async () => {
    try {
      const response = await fetch("./api/db-data");
      if (!response.ok) {
        throw new Error("Something went wrong!");
      }
      const data = await response.json();

      setEpisodeList(data.episodi);
    } catch (error) {
      console.log(error.message);
    }
  }, []);
  useEffect(() => {
    fetchEpisode();
  }, [fetchEpisode]);

  const fuse = new Fuse(episodeList, {
    keys: ["titolo", ["giochi", "titolo"]],
    includeScore: true,
    includeMatches: true,
    threshold: 0.5,
    findAllMatches: true,
  });

  const results = fuse.search(searchInput);

  let episodeResult = searchInput ? results.map((result) => result.item) : episodeList;

  const activeListHandler = (index, status) => {
    if (status) {
      setInterestedIndex(null);
      return;
    }
    if (isMobile) {
      setInterestedIndex(index);
      return;
    }
    if (index % 2 !== 0) setInterestedIndex(index);
    else {
      index = index + 1;
      setInterestedIndex(index);
    }
  };

  episodeResult.sort((a, b) => new Date(b.data_uscita) - new Date(a.data_uscita));
  let episodes = [];
  if (!list) {
    episodes = episodeResult;
  } else episodes = episodeResult.reverse();

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
            onActive={activeListHandler}
            active={allActive}
            involved={index === interestedIndex ? true : false}
          />
        );
      })}
    </ul>
  );
};

export default EpisodeListing;
