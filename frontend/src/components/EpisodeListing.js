import { useState, useCallback, useEffect } from "react";

import EpisodeItem from "./EpisodeItem";

import classes from "./EpisodeListing.module.css";

const EpisodeListing = () => {
  const [episodeList, setEpisodeList] = useState([]);

  const fetchEpisode = async () => {
    try {
      const response = await fetch("./api/db-data");
      if (!response.ok) {
        throw new Error("Something went wrong!");
      }
      const data = await response.json();

      setEpisodeList(data.episodi);
      console.log(data);
    } catch (error) {
      console.log(error.message);
    }
  };
  useEffect(() => {
    fetchEpisode();
  }, []);

  return (
    <div className={classes.listBox}>
      {episodeList.map((episode) => {
        return (
          <EpisodeItem
            key={episode.episodio_numero}
            id={episode.episodio_numero}
            titolo={episode.titolo}
            url={episode.url}
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
