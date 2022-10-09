import { useContext, useState } from "react";
import { DebounceInput } from 'react-debounce-input';

import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";
import { ReactComponent as SortIcon } from "../icons/ICN_Sort.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
  const searchCtx = useContext(SearchContext);
  const [showModal, setShowModal] = useState(false);
  const [sorting, setSorting] = useState('ascending');

  const toggleShowModal = () => {
    setShowModal((oldState) => !oldState);
  };

  const reverseHandler = (order) => {
    searchCtx.setSortOrder(order);
    setSorting(order);
    toggleShowModal();
  };

  const checkIcon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${classes.checkIcon}`}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>;

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
        <div className={classes.sortContainer}>
          <p className={classes.sortControl} onClick={reverseHandler.bind(this, "ascending")}>Più recenti</p>
          <div className={sorting === 'ascending' && classes.showCheckIcon}>{checkIcon}</div>
        </div>
        <div className={classes.sortContainer}>
          <p className={classes.sortControl} onClick={reverseHandler.bind(this, "descending")}>Meno recenti</p>
          <div className={sorting === 'descending' && classes.showCheckIcon}>{checkIcon}</div>
        </div>
        <button className={classes.sortButton} onClick={toggleShowModal}>
          Chiudi
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
