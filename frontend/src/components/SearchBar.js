import { useContext } from "react";
import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";
import { ReactComponent as SortIcon } from "../icons/ICN_Sort.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
  const searchCtx = useContext(SearchContext);
  const searchHandler = (event) => {
    searchCtx.setSearch(event.target.value);
  };

  const reverseHandler = () => {
    searchCtx.reverseList();
  };

  return (
    <div className={classes.searchBar}>
      <input
        type="text"
        placeholder={"| Trova quella con.."}
        className={classes.input}
        onChange={searchHandler}
      ></input>
      <div className={classes.searchIcon}>
        <SearchIcon />
      </div>
      <div className={classes.sortIcon} onClick={reverseHandler}>
        <SortIcon />
      </div>
    </div>
  );
};

export default SearchBar;
