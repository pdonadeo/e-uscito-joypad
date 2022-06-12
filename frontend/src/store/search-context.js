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
        if (input.length > 3) setSearchInput(input);
    };

    const setOrderList = () => {
        setList((previousOrder) => !previousOrder);
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
