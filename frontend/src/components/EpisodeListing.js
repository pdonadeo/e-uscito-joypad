import { useState, useCallback, useEffect, useContext } from "react";
import SearchContext from "../store/search-context";

import EpisodeItem from "./EpisodeItem";

import classes from "./EpisodeListing.module.css";

const EpisodeListing = () => {
  const [episodeList, setEpisodeList] = useState([]);
  const { searchInput } = useContext(SearchContext);

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
  }, []);

  const arrInputs = searchInput.includes(" ") ? searchInput.split(" ") : [searchInput];

  let filteredQuotes = [];

  const filterSearch = (words) =>
    episodeList.filter((s) =>
      words.some(
        (w) => s.titolo.toLowerCase().includes(w.toLowerCase())
        // || s.body.toLowerCase().includes(w.toLowerCase())
      )
    );

  const trimArr = arrInputs.join(" ").trim().split(" ");

  if (arrInputs.length > 0) {
    filteredQuotes = filterSearch(trimArr);
  } else filteredQuotes = episodeList;

  return (
    <div className={classes.listBox}>
      {filteredQuotes.map((episode) => {
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
    </div>
  );
};

export default EpisodeListing;
