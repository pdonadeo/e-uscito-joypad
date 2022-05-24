import React, { useState } from "react";

const SearchContext = React.createContext({
  searchInput: "",
  list: false,
  reverseList: () => {},
  setSearch: () => {},
});

export const SearchContextProvider = (props) => {
  const [searchInput, setSearchInput] = useState("");
  const [list, setList] = useState(false);

  const setSearchHandler = (input) => {
    setSearchInput(input);
  };

  const setOrderList = () => {
    setList((previousOrder) => console.log(!previousOrder));
  };

  return (
    <SearchContext.Provider
      value={{ searchInput: searchInput, setSearch: setSearchHandler, reverseList: setOrderList }}
    >
      {props.children}
    </SearchContext.Provider>
  );
};

export default SearchContext;
