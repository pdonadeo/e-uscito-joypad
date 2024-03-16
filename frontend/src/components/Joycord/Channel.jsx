import React from 'react';

import Thread from './Thread';

import classes from './Channel.module.css';


function Channel({ jsonObj }) {
  let link = `https://discord.com/channels/${jsonObj.guildId}/${jsonObj.id}`;

  let selectedClasses = [classes.discordChannel];

  if (jsonObj.isRoot === true) {
    selectedClasses.push(classes.rootChannel);
  }

  return (
    <div className={selectedClasses.join(' ')}>
      <a href={link} target='_blank' rel="noreferrer"><h2>{jsonObj.name}</h2></a>

      {jsonObj.children.length !== 0 ? <ul>
        {jsonObj.children.length !== 0 && jsonObj.children.map((child) => (
          <Thread key={`thread-${child.id}`} jsonObj={child} />
        ))}
      </ul> : <></>}
    </div>
  );
};

export default Channel;
