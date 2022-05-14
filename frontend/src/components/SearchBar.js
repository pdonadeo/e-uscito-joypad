import { useContext } from "react";
import SearchContext from "../store/search-context";

const Search = () => {
  const searchCtx = useContext(SearchContext);
  const searchHandler = (event) => {
    searchCtx.setSearch(event.target.value);
  };

  return (
    <div>
      <input type="text" placeholder={"Cerca fra i titoli"} onChange={searchHandler}></input>
    </div>
  );
};

export default Search;
