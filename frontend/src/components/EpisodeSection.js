import { useState, useEffect, useContext, useReducer } from "react";

import SearchContext from "../store/search-context";
import EpisodeListing from "./EpisodeListing";
import SearchBar from "./SearchBar";
import ShowMoreButton from "./UI/ShowMoreButton";

import classes from "./EpisodeSection.module.css";


const limit = 8;

const EpisodeSection = () => {
  const { searchInput, sortOrder, selectedGameId } = useContext(SearchContext);
  const [episodeList, setEpisodeList] = useState([]);
  const [offset, setOffset] = useState(0);

  const reducer = (state, action) => {
    if (state === undefined) return;

    let url = null;
    let makeNewEpisodeList = null;
    let new_state = state;

    switch (action) {
      case "game_selected":
        switch (state) {
          case "episode_list":
            url = `/api/episodes-by-game-id/${selectedGameId}`;
            makeNewEpisodeList = (data) => (prevEpisodeList) => data.result;
            new_state = "game";
            break;
          case "game":
            url = `/api/episodes-by-game-id/${selectedGameId}`;
            makeNewEpisodeList = (data) => (prevEpisodeList) => data.result;
            new_state = "game";
            break;
          default:
            break;
        }
        break;
      case "episode_list_selected":
        switch (state) {
          case "episode_list":
            url = `/api/last-episodes/${limit}/${offset}`;
            makeNewEpisodeList = (data) => (prevEpisodeList) => data.result;
            new_state = "episode_list";
            break;
          case "game":
            url = `/api/last-episodes/${limit}/0`;
            makeNewEpisodeList = (data) => (prevEpisodeList) => data.result;
            new_state = "episode_list";
            break;
          default:
            break;
        }
        break;
      case "show_more":
        switch (state) {
          case "episode_list":
            setOffset((prevOffset) => prevOffset + limit);
            url = `/api/last-episodes/${limit}/${offset + limit}`;
            makeNewEpisodeList = (data) => (prevEpisodeList) => [...new Map([...prevEpisodeList, ...data.result].map(item => [item['episodio_numero'], item])).values()];
            new_state = "episode_list";
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }

    fetch(url).then(
      (response) => {
        if (!response.ok) {
          throw new Error("Something went wrong!");
        }
        return response.json();
      }
    ).then(
      (data) => {
        if (sortOrder === "descending") {
          data.result = data.result.reverse();
        }
        setEpisodeList(makeNewEpisodeList(data));
      }
    ).catch(
      (error) => {
        console.error(error.message);
      }
    );
    return new_state;
  };

  const [state, dispatch] = useReducer(reducer, "episode_list");

  useEffect(() => {
    if (searchInput.trim() !== "") {
      dispatch("game_selected");
    } else {
      dispatch("episode_list_selected");
    }
  }, [searchInput, sortOrder, selectedGameId]);

  return (
    <div id="episode-section" className={classes.container}>
      <SearchBar />
      <p id="focus-search-list" tabIndex={0} style={{ fontSize: "1.8rem", textAlign: "center", marginBottom: "2rem" }}>
        {state === "episode_list" ?
          `Ecco gli ultimi ${limit + offset} episodi!`
          : "Se ne è parlato qui:"
        }
      </p>
      <EpisodeListing
        listLength={limit}
        episodeList={episodeList}
      />

      {state === "episode_list" &&
        <ShowMoreButton
          onClick={() => { dispatch("show_more"); }}
          limit={limit}
        />
      }
    </div>
  );
};

export default EpisodeSection;
