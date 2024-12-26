import classes from "./ShowMoreButton.module.css";

const ShowMoreButton = ({ onClick, limit }) => {
    return (
        <div className={classes.wrapper}>
            <button className={classes.button} onClick={onClick}>
                <span>Ne voglio altri {limit}!</span>
            </button>
        </div>
    );
};

export default ShowMoreButton;
