import { useMediaQuery } from "react-responsive";

import classes from "./Logo.module.css";

const Logo = () => {
    const isMobile = useMediaQuery({ query: "(max-width: 800px)" });
    return (
        <div className={classes.logoContainer}>
            <img
                src={`${process.env.PUBLIC_URL}${isMobile ? "/joypad-img_mobile.jpg" : "/joypad-img.jpg"}`}
                alt="joypad logo"
                className={classes.logoImage}
            />
        </div>
    );
};

export default Logo;
