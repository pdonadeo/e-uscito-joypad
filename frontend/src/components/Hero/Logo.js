import classes from "./Logo.module.css";

const Logo = () => {
    return (
        <div className={classes.logoContainer}>
            <a tabIndex={0} aria-label="Benvenuti su Joypad, Corri, salta, spara" href="/">
                <img
                    src={`${process.env.PUBLIC_URL}${"/joypad-img.jpg"}`}
                    alt="joypad logo"
                    tabIndex={-1}
                    className={classes.logoImage}
                />
            </a>
        </div>
    );
};

export default Logo;
