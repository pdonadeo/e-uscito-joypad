import React, { useState } from "react";

const SearchContext = React.createContext({
  searchInput: "",
  setSearchInput: () => { },
  sortOrder: "",
  setSortOrder: () => { }
});

export const SearchContextProvider = (props) => {
  const [searchInput, setSearchInput] = useState("");
  const [sortOrder, setSortOrder] = useState("ascending");

  return (
    <SearchContext.Provider
      value={{
        searchInput: searchInput,
        setSearchInput: setSearchInput,
        sortOrder: sortOrder,
        setSortOrder: setSortOrder
      }}
    >
      {props.children}
    </SearchContext.Provider>
  );
};

export default SearchContext;
