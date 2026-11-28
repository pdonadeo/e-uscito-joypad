import React from "react";

import Channel from "./components/Joycord/Channel";
import Category from "./components/Joycord/Category";
import Thread from "./components/Joycord/Thread";

function JoycordChannels() {
  const [channels, setChannels] = React.useState([]);

  React.useEffect(() => {
    document.title = "Joycord - Canali";
  });

  React.useEffect(() => {
    fetch("/api/joycord/channels")
      .then((response) => response.json())
      .then((data) => {
        // Do something with the downloaded JSON data
        setChannels(data);
      })
      .catch(() => {
        // Handle any errors that occur during the fetch
      });
  }, [setChannels]);

  return (
    <>
      <h1>Lista dei canali e delle discussioni aperte di Joycord</h1>
      <ul>
        {channels.map((channel) => (
          <li key={channel.id}>
            {channel.nodeType === "channelType" ? (
              <Channel jsonObj={channel} />
            ) : channel.nodeType === "categoryType" ? (
              <Category jsonObj={channel} />
            ) : channel.nodeType === "threadType" ? (
              <Thread jsonObj={channel} />
            ) : (
              <div>{channel.id}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default JoycordChannels;
