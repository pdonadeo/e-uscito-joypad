import React from 'react';

import classes from './Thread.module.css';


function Thread({ jsonObj }) {
  let link = `https://discord.com/channels/${jsonObj.guildId}/${jsonObj.id}`;

  return (
    <li className={classes.discordThread}>
      <h3>Thread: <a href={link}
        target='_blank' rel="noreferrer">{jsonObj.name}</a> ({jsonObj.messageCount} messaggi)</h3>
    </li>
  );
};

export default Thread;
