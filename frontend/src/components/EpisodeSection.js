import { useState, useEffect, useContext } from "react";

import SearchContext from "../store/search-context";
import EpisodeListing from "./EpisodeListing";
import SearchBar from "./SearchBar";

import classes from "./EpisodeSection.module.css";


const EpisodeSection = (props) => {
  const { searchInput, sortOrder } = useContext(SearchContext);
  const [ episodeList, setEpisodeList ] = useState([]);

  const maxNumbersOfEpisodes = 8;

  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        let response = null;
        if (searchInput.trim() !== "") {
          response = await fetch(`/api/search-game/${searchInput}`);
        } else {
          response = await fetch(`/api/last-episodes/${maxNumbersOfEpisodes}`);
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
      <p style={{fontSize: "1.8rem", textAlign: "center", marginBottom:"2rem"}}>{searchInput.trim() === "" ? `Ecco gli ultimi ${maxNumbersOfEpisodes} episodi!`: 'Se ne è parlato qui:'}</p>
      <EpisodeListing
        listLength={maxNumbersOfEpisodes}
        episodeList={episodeList}
      />
    </div>
  );
};

export default EpisodeSection;
