import React, { useState } from "react";

const SearchContext = React.createContext({
  searchInput: "",
  setSearch: () => {},
});

export const SearchContextProvider = (props) => {
  const [searchInput, setSearchInput] = useState("");

  const setSearchHandler = (input) => {
    setSearchInput(input);
  };

  return (
    <SearchContext.Provider value={{ searchInput: searchInput, setSearch: setSearchHandler }}>
      {props.children}
    </SearchContext.Provider>
  );
};

export default SearchContext;
