import { useMediaQuery } from "react-responsive";

import classes from "./Logo.module.css";

const Logo = () => {
  
  const isMobile = useMediaQuery({ query: "(max-width: 920px)" });

  return (
    <div className={classes.logoContainer}>
      <a tabIndex={0} aria-label="Benvenuti su Joypad, Corri, salta, spara" href="/">
        <img
          src={`${process.env.PUBLIC_URL}${isMobile ? "/joypad-img_mobile.jpg" : "/joypad-img.jpg"}`}
          alt="joypad logo"
          tabIndex={-1}
          className={classes.logoImage}
        />
      </a>
    </div>
  );
};

export default Logo;
