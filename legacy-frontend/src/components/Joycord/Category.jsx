import Channel from "./Channel";

import classes from "./Category.module.css";

function Category({ jsonObj }) {
  return (
    <div className={classes.discordCategory}>
      <h2>{jsonObj.name}</h2>
      {jsonObj.children.length !== 0 ? (
        <ul>
          {jsonObj.children.length !== 0 &&
            jsonObj.children.map((child) => (
              <Channel key={`channel-${child.id}`} jsonObj={child} />
            ))}
        </ul>
      ) : (
        <></>
      )}
    </div>
  );
}

export default Category;
