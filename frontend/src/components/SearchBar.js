import { useContext, useState } from "react";
import { DebounceInput } from 'react-debounce-input';

import SearchContext from "../store/search-context";

import { ReactComponent as SearchIcon } from "../icons/ICN_Search.svg";
import { ReactComponent as SortIcon } from "../icons/ICN_Sort.svg";

import classes from "./SearchBar.module.css";

const SearchBar = () => {
    const searchCtx = useContext(SearchContext);
    const [showModal, setShowModal] = useState(false);
    const searchHandler = (event) => {
        searchCtx.setSearch(event.target.value);
    };
    const showModalHandler = () => {
        setShowModal((previousState) => !previousState);
    };

    const reverseHandler = (order) => {
        if (order === "ascending") searchCtx.reverseList("ascending");
        if (order === "descending") searchCtx.reverseList("descending");
        showModalHandler();
    };

    // const focusHandler = () => {
    //     window.scrollTo({ top: 605, behavior: "smooth" });
    // };

    return (
        <div className={classes.searchBar}>
            <DebounceInput
                initial-scale="1"
                maximum-scale="1"
                // onFocus={focusHandler}
                type="text"
                placeholder={"| Trova quella con…"}
                className={classes.input}

                minLength={4}
                debounceTimeout={300}
                onChange={searchHandler}
            />
            <div className={classes.searchIcon}>
                <SearchIcon />
            </div>
            <div className={classes.sortIcon} onClick={showModalHandler}>
                <SortIcon />
            </div>
            <div className={`${classes.sortModal} ${showModal && classes.show}`}>
                <p className={classes.sortText}>ORDINA PER</p>
                <p className={classes.sortControl} onClick={reverseHandler.bind(this, "ascending")}>
                    Più recenti
                </p>
                <p className={classes.sortControl} onClick={reverseHandler.bind(this, "descending")}>
                    Meno recenti
                </p>
                <button className={classes.sortButton} onClick={showModalHandler}>
                    Chiudi
                </button>
            </div>
        </div>
    );
};

export default SearchBar;
