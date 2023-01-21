import classes from "./HeroLinks.module.css";

import { ReactComponent as IlPost } from "../../icons/ICN_IlPost.svg";
import { ReactComponent as Spotify } from "../../icons/ICN_Spotify.svg";
import { ReactComponent as Apple } from "../../icons/ICN_Apple.svg";
import { ReactComponent as Google } from "../../icons/ICN_Google.svg";
import { ReactComponent as Instagram } from "../../icons/ICN_Instagram.svg";
import { ReactComponent as Discord } from "../../icons/ICN_Discord.svg";

const HeroLinks = () => {
  return (
    <div className={classes.container}>
      <p className={classes.listenMessage}>
        Ascolta la puntata{" "}
        <a href="https://www.ilpost.it/podcasts/joypad/" rel="noreferrer" target="_blank">
          sulla pagina del Post
        </a>
        ,<br /> oppure
      </p>
      <div className={classes.linkBoxes}>
        <a href="https://app.ilpost.it/" rel="noreferrer" target="_blank">
          <IlPost />
        </a>
        <a href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ" rel="noreferrer" target="_blank">
          <Spotify />
        </a>
        <a href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4" rel="noreferrer" target="_blank">
          <Apple />
        </a>
        <a href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk" rel="noreferrer" target="_blank">
          <Google />
        </a>
      </div>
      <div className={classes.followUs}>
        <p>
          Seguici su:
        </p>
          <a href="//discord.gg/6KYbyutq9X" rel="noreferrer" target="_blank">
            <Discord/>
          </a>
          <a href="//www.instagram.com/corrisaltaspara/" rel="noreferrer" target="_blank">
           <Instagram/>
          </a>
      </div>
    </div>
  );
};

export default HeroLinks;
