import { ReactComponent as Instagram } from '../icons/ICN_Instagram.svg';
import { ReactComponent as Discord } from '../icons/ICN_Discord.svg';
import classes from "./Footer.module.css";

const Footer = () => {
  return (
    <footer className={classes.footer}>
      <p>
        Copyright © 2022 Paolo Donadeo.</p>
      <p>
        Rilasciato sotto licenza MIT, vedi
        <a href="https://github.com/pdonadeo/e-uscito-joypad/blob/main/LICENSE">LICENSE.md</a>
      </p>
      <p>
        <a href="//www.instagram.com/corrisaltaspara/" target="_blank" rel="noreferrer">
          <Instagram className={classes.bottomIcon} />
        </a>
        <a href="//discord.gg/6KYbyutq9X" target="_blank" rel="noreferrer">
          <Discord className={classes.bottomIcon} />
        </a>
      </p>
    </footer>
  );
};


export default Footer;