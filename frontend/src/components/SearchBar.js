import { useContext, useState } from "react";
import { DebounceInput } from 'react-debounce-input';

import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";
import { ReactComponent as SortIcon } from "../icons/ICN_Sort.svg";
import { ReactComponent as CloseIcon } from "../icons/ICN_Close.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
  const searchCtx = useContext(SearchContext);
  const [showModal, setShowModal] = useState(false);
  const [sorting, setSorting] = useState('ascending');
  const [resultList, setResultList] = useState([]);

  const toggleShowModal = () => {
    setShowModal((oldState) => !oldState);
  };

  const reverseHandler = (order) => {
    searchCtx.setSortOrder(order);
    setSorting(order);
    toggleShowModal();
  };

  const getSearchResults = async (searchWords) => {
    if(searchWords.length  === 0) {setResultList([]); return;}

    const response = await fetch(`http://localhost:5000/api/search-game-title/${searchWords}`);
    const data = await response.json();
    console.log(data.result);

    const listNames = data.result.map(({titolo, id}) => ({titolo, id}));
    setResultList(listNames);
  }

  const checkIcon = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${classes.checkIcon}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>;

  return (
    <div className={classes.searchBar}>
      <DebounceInput
        initial-scale="1"
        maximum-scale="1"
        type="text"
        placeholder={"| Cerca un gioco…"}
        className={classes.input}
        minLength={4}
        debounceTimeout={300}
        onChange={(ev) => { 
          // searchCtx.setSearchInput(ev.target.value);
          getSearchResults(ev.target.value) 
          console.log(ev.target.value);
        }}
        value={searchCtx.searchInput}
      />
      {resultList.length > 0 && 
      <div className={classes.searchSuggestions}>
        {resultList.map(result=> 
        <div 
          className={classes.suggestion} 
          key={result.id} 
          onClick={()=> {searchCtx.setSearchInput(result.titolo); setResultList([])}}>
            <p >{result.titolo}</p>
          </div>
        )}
        </div>}
      <div className={classes.searchIcon}>
        <SearchIcon />
      </div>
      {searchCtx.searchInput.trim() === "" ? (
        <>
          <div className={classes.sortIcon} onClick={toggleShowModal}>
            <SortIcon />
          </div>
          <div className={`${classes.sortModal} ${showModal ? classes.show : ''}`}>
            <p className={classes.sortText}>ORDINA PER</p>
            <div className={classes.sortContainer}>
              <p className={classes.sortControl} onClick={reverseHandler.bind(this, "ascending")}>Più recenti</p>
              <div className={sorting === 'ascending' ? classes.showCheckIcon : ''}>{checkIcon}</div>
            </div>
            <div className={classes.sortContainer}>
              <p className={classes.sortControl} onClick={reverseHandler.bind(this, "descending")}>Meno recenti</p>
              <div className={sorting === 'descending' ? classes.showCheckIcon : ''}>{checkIcon}</div>
            </div>
            <button className={classes.sortButton} onClick={toggleShowModal}>
              Chiudi
            </button>
          </div>
        </>
      ) :
        <>
          <div 
            className={classes.closeIcon} 
            onClick={(ev) => { 
              searchCtx.setSearchInput(""); 
              setResultList([]); 
          }}>
            <CloseIcon />
          </div>
        </>
      }
    </div >
  );
};

export default SearchBar;
