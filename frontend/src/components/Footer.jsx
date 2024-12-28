import classes from "./Footer.module.css";

const Footer = () => {
  return (
    <footer className={classes.footer}>
      <p className={classes.note}>
        Nota per gli autori del podcast: il sito è pubblicato gratuitamente e
        con licenza open su
        <a
          href="https://github.com/pdonadeo/e-uscito-joypad"
          rel="noreferrer"
          target="_blank"
        >
          {" "}
          GitHub
        </a>{" "}
        e potete fare tutte le richieste che volete
        <a
          href="https://github.com/pdonadeo/e-uscito-joypad/issues"
          rel="noreferrer"
          target="_blank"
        >
          {" "}
          qui
        </a>
        .
      </p>
      <p>Copyright © 2023 Paolo Donadeo.</p>
      <p>
        Rilasciato sotto licenza MIT, vedi
        <a
          href="https://github.com/pdonadeo/e-uscito-joypad/blob/main/LICENSE"
          rel="noreferrer"
          target="_blank"
        >
          LICENSE.md
        </a>
      </p>
    </footer>
  );
};

export default Footer;
