import classes from "./HeroLinks.module.css";

import { ReactComponent as IlPost } from "../../icons/ICN_IlPost.svg";
import { ReactComponent as Spotify } from "../../icons/ICN_Spotify.svg";
import { ReactComponent as Apple } from "../../icons/ICN_Apple.svg";
import { ReactComponent as Google } from "../../icons/ICN_Google.svg";

const HeroLinks = () => {
  return (
    <div className={classes.container}>
      <p className={classes.listenMessage}>
        Ascolta la puntata{" "}
        <a href="https://www.ilpost.it/podcasts/joypad/">
          sulla pagina del Post
        </a>
        ,<br /> oppure
      </p>
      <div className={classes.linkBoxes}>
        <a href="https://app.ilpost.it/">
          <IlPost />
        </a>
        <a href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ">
          <Spotify />
        </a>
        <a href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4">
          <Apple />
        </a>
        <a href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk">
          <Google />
        </a>
      </div>
      <p className={classes.note}>
        Nota per gli autori del podcast: il sito è pubblicato gratuitamente e
        con licenza open su
        <a href="https://github.com/pdonadeo/e-uscito-joypad"> GitHub</a> e
        potete fare tutte le richieste che volete
        <a href="https://github.com/pdonadeo/e-uscito-joypad/issues"> qui</a>.
      </p>
    </div>
  );
};

export default HeroLinks;
