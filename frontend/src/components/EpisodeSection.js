import EpisodeListing from "./EpisodeListing";
import SearchBar from "./SearchBar";

import classes from "./EpisodeSection.module.css";

const EpisodeSection = () => {
  return (
    <div className={classes.container}>
      <SearchBar />
      <EpisodeListing />
    </div>
  );
};

export default EpisodeSection;
