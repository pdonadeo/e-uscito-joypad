import React, { useState } from "react";

const SearchContext = React.createContext({
    searchInput: "",
    list: "",
    reverseList: () => {},
    setSearch: () => {},
});

export const SearchContextProvider = (props) => {
    const [searchInput, setSearchInput] = useState("");
    const [list, setList] = useState("ascending");

    const setSearchHandler = (input) => {
        setSearchInput(input);
    };

    const setOrderList = (order) => {
        setList(order);
    };

    return (
        <SearchContext.Provider
            value={{ searchInput: searchInput, list: list, setSearch: setSearchHandler, reverseList: setOrderList }}
        >
            {props.children}
        </SearchContext.Provider>
    );
};

export default SearchContext;
