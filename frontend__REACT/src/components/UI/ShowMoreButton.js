import classes from "./ShowMoreButton.module.css";

const ShowMoreButton = ({ onClick, limit }) => {
  return (
    <button onClick={onClick}>
      <div className={classes.wrapper}>
        <div className={classes.button}>
          <p>Ne voglio altri {limit}!</p>
        </div>
      </div>
    </button>
  );
};

export default ShowMoreButton;
