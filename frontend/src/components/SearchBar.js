import { useContext } from "react";
import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
  const searchCtx = useContext(SearchContext);
  const searchHandler = (event) => {
    searchCtx.setSearch(event.target.value);
  };

  return (
    <div className={classes.searchBar}>
      <input type="text" placeholder={"Trova quella con.."} className={classes.input} onChange={searchHandler}></input>
      <SearchIcon />
    </div>
  );
};

export default SearchBar;
