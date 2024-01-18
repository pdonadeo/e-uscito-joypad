import React, { useState } from "react";
import { useParams } from "react-router-dom";

const SearchContext = React.createContext({
  searchInput: "",
  setSearchInput: () => { },
  selectedGameId: null,
  setSelectedGameId: () => { },
  sortOrder: "",
  setSortOrder: () => { }
});

export const SearchContextProvider = (props) => {
  const { selectedGameIdUrl, searchInputUrl } = useParams();
  const [searchInput, setSearchInput] = useState(searchInputUrl || "");
  const [selectedGameId, setSelectedGameId] = useState(selectedGameIdUrl || null);
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
