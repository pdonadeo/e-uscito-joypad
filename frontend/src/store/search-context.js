import React, { useState } from "react";

const SearchContext = React.createContext({
  searchInput: "",
  setSearchInput: () => { },
  selectedGameId: null,
  setSelectedGameId: () => { },
  sortOrder: "",
  setSortOrder: () => { }
});

export const SearchContextProvider = (props) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [sortOrder, setSortOrder] = useState("ascending");

  return (
    <SearchContext.Provider
      value={{
        searchInput: searchInput,
        setSearchInput: setSearchInput,
        selectedGameId: selectedGameId,
        setSelectedGameId: setSelectedGameId,
        sortOrder: sortOrder,
        setSortOrder: setSortOrder
      }}
    >
      {props.children}
    </SearchContext.Provider>
  );
};

export default SearchContext;
