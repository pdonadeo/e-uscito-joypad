import { useState, useEffect, useContext } from "react";

import SearchContext from "../store/search-context";
import EpisodeListing from "./EpisodeListing";
import SearchBar from "./SearchBar";

import classes from "./EpisodeSection.module.css";

const MAX_NUMBER_OF_EPISODES = 8;

const EpisodeSection = () => {
  const { searchInput, sortOrder } = useContext(SearchContext);
  const [episodeList, setEpisodeList] = useState([]);

  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        let response = null;
        if (searchInput.trim() !== "") {
          response = await fetch(`/api/search-game/${searchInput}`);
        } else {
          response = await fetch(`/api/last-episodes/${MAX_NUMBER_OF_EPISODES}`);
        }

        if (!response.ok) {
          throw new Error("Something went wrong!");
        }
        const data = await response.json();
        if (sortOrder === "descending") {
          data.result = data.result.reverse();
        }
        setEpisodeList(data.result);
      } catch (error) {
        console.error(error.message);
      }
    };

    fetchEpisode();
  }, [searchInput, sortOrder]);

  return (
    <div id="episode-section" className={classes.container}>
      <SearchBar />
      {searchInput.trim() === "" ? (
        <p className={classes.title}>Gli ultimi {MAX_NUMBER_OF_EPISODES} episodi…</p>
      ) : (
        <p className={classes.title}>Se ne è parlato qui…</p>
      )}
      <EpisodeListing
        listLength={MAX_NUMBER_OF_EPISODES}
        episodeList={episodeList}
      />
    </div>
  );
};

export default EpisodeSection;
