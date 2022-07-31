import { useContext } from "react";

import SearchContext from "../store/search-context";
import EpisodeListing from "./EpisodeListing";
import SearchBar from "./SearchBar";

import classes from "./EpisodeSection.module.css";

const MAX_NUMBER_OF_EPISODES = 8;

const EpisodeSection = () => {
  const { searchInput } = useContext(SearchContext);

  return (
    <div className={classes.container}>
      <SearchBar />
      {searchInput.trim() === "" ? (
        <p className={classes.title}>Gli ultimi {MAX_NUMBER_OF_EPISODES} episodi…</p>
      ) : (
        <p className={classes.title}>Se ne è parlato qui…</p>
      )}
      <EpisodeListing listLength={MAX_NUMBER_OF_EPISODES} />
    </div>
  );
};

export default EpisodeSection;
