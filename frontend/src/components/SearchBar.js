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
  const [focus, setFocus] = useState(0);
  const [searchWords, setSearchWords] = useState('');

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

    setSearchWords(searchWords);
    const response = await fetch(`/api/search-game-title/${searchWords}`);
    const data = await response.json();
    
    const listNames = data.result.map(({titolo, id}) => ({titolo, id}));
    setResultList(listNames);
  }

  const boldName = (name, search) =>{
    
    const isMatch = name.toLowerCase().match(search.toLowerCase());
    if(isMatch) {
    const index = isMatch.index;

    if (index !== 0) {
        return <>
          {name.substr(0, index)}<strong>{name.substr(index, search.length)}</strong>{name.substr((index+search.length), name.length)}
        </>
      }
    }
    if(name.substr(0,search.length).toLowerCase() ===search.toLowerCase() ){ 
      return <>
    <strong>{name.substr(0, search.length)}</strong>{name.substr(search.length)};
    </>
    }
    return name;
  }

  const onKeyDown = (event) =>{
    if(event.key === 'ArrowDown'){
       setFocus(()=> focus + 1);
    }
    if(event.key === 'ArrowUp'){
       setFocus(()=> focus - 1);
    }
    if(event.key === 'Enter') {
      searchCtx.setSearchInput(resultList[focus].titolo);
      setResultList([]);
      setFocus(0);
    }
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
        id="search-bar"
        minLength={4}
        debounceTimeout={300}
        onChange={(ev) => { 
          // searchCtx.setSearchInput(ev.target.value);
          getSearchResults(ev.target.value) 
        }}
        value={searchCtx.searchInput}
        onKeyDown={onKeyDown}
      />
      {resultList.length > 0 && 
      <div className={classes.searchSuggestions}>
        {resultList.map((result, i)=> 
        <div 
          // style={ i === focus ? {backgroundColor: '#f7f7f8'} : {}}
          className={`${classes.suggestion} ${i === focus? classes.keyActive : ''}`} 
          key={result.id} 
          onClick={()=> {searchCtx.setSearchInput(result.titolo); setResultList([])}}>
            <p >{boldName(result.titolo, searchWords)}</p>
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
