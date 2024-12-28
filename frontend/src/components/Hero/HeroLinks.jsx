import { Suspense, lazy } from "react";

import classes from "./HeroLinks.module.css";

import Instagram from "../../icons/ICN_Instagram.svg?react";
import Discord from "../../icons/ICN_Discord.svg?react";

const IlPost = lazy(() => import("../../icons/ICN_IlPost.svg?react"));
const Spotify = lazy(() => import("../../icons/ICN_Spotify.svg?react"));
const Apple = lazy(() => import("../../icons/ICN_Apple.svg?react"));
const Google = lazy(() => import("../../icons/ICN_Google.svg?react"));

const HeroLinks = () => {
  return (
    <div className={classes.container}>
      <p tabIndex={0} className={classes.listenMessage}>
        Ascolta la puntata{" "}
        <a
          href="https://www.ilpost.it/podcasts/joypad/"
          rel="noreferrer"
          target="_blank"
        >
          sulla pagina del Post
        </a>
        ,
        <br /> oppure
      </p>
      <div className={classes.linkBoxes}>
        <a
          aria-label="Ascolta Joypad sull'app del Post"
          href="https://app.ilpost.it/"
          rel="noreferrer"
          target="_blank"
        >
          <Suspense fallback={<div>Loading…</div>}>
            <IlPost />
          </Suspense>
        </a>
        <a
          aria-label="Ascolta Joypad su Spotify"
          href="https://open.spotify.com/show/2JXX6er1IfNvbyPbYPI9tJ"
          rel="noreferrer"
          target="_blank"
        >
          <Suspense fallback={<div>Loading…</div>}>
            <Spotify />
          </Suspense>
        </a>
        <a
          aria-label="Ascolta Joypad su Apple Podcast"
          href="https://podcasts.apple.com/us/podcast/joypad/id1491137742?uo=4"
          rel="noreferrer"
          target="_blank"
        >
          <Suspense fallback={<div>Loading…</div>}>
            <Apple />
          </Suspense>
        </a>
        <a
          aria-label="Ascolta Joypad su Google Podcast"
          href="https://www.google.com/podcasts?feed=aHR0cHM6Ly93d3cuc3ByZWFrZXIuY29tL3Nob3cvNDE1MTQyOS9lcGlzb2Rlcy9mZWVk"
          rel="noreferrer"
          target="_blank"
        >
          <Suspense fallback={<div>Loading…</div>}>
            <Google />
          </Suspense>
        </a>
      </div>
      <div className={classes.followUs}>
        <p tabIndex={0}>Seguici su:</p>
        <a
          aria-label="Unisciti al server discord di Joypad"
          href="//discord.gg/6KYbyutq9X"
          rel="noreferrer"
          target="_blank"
        >
          <Discord />
        </a>
        <a
          aria-label="Segui il profilo instagram di Joypad"
          href="//www.instagram.com/corrisaltaspara/"
          rel="noreferrer"
          target="_blank"
        >
          <Instagram />
        </a>
      </div>
    </div>
  );
};

export default HeroLinks;
