import { useContext, useState } from "react";
import { DebounceInput } from 'react-debounce-input';

import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";
import { ReactComponent as SortIcon } from "../icons/ICN_Sort.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
  const searchCtx = useContext(SearchContext);
  const [showModal, setShowModal] = useState(false);

  const toggleShowModal = () => {
    setShowModal((oldState) => !oldState);
  };

  const reverseHandler = (order) => {
    if (order === "ascending") searchCtx.setSortOrder("ascending");
    if (order === "descending") searchCtx.setSortOrder("descending");
    toggleShowModal();
  };

  // const focusHandler = () => {
  //     window.scrollTo({ top: 605, behavior: "smooth" });
  // };

  return (
    <div className={classes.searchBar}>
      <DebounceInput
        initial-scale="1"
        maximum-scale="1"
        // onFocus={focusHandler}
        type="text"
        placeholder={"| Cerca un gioco…"}
        className={classes.input}

        minLength={4}
        debounceTimeout={300}
        onChange={(ev) => { searchCtx.setSearchInput(ev.target.value) }}
      />
      <div className={classes.searchIcon}>
        <SearchIcon />
      </div>
      <div className={classes.sortIcon} onClick={toggleShowModal}>
        <SortIcon />
      </div>
      <div className={`${classes.sortModal} ${showModal && classes.show}`}>
        <p className={classes.sortText}>ORDINA PER</p>
        <p className={classes.sortControl} onClick={reverseHandler.bind(this, "ascending")}>
          Più recenti
        </p>
        <p className={classes.sortControl} onClick={reverseHandler.bind(this, "descending")}>
          Meno recenti
        </p>
        <button className={classes.sortButton} onClick={toggleShowModal}>
          Chiudi
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
