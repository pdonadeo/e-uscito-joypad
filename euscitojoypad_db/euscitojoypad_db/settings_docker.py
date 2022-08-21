import os
import logging.config
from django.utils.log import DEFAULT_LOGGING

from .settings import *


def bool_of_string(b_s):
    if b_s == "True":
        return True
    elif b_s == "False":
        return False
    else:
        raise ValueError("bool_of_string: %s is not a valid bool representation")


DEBUG = bool_of_string(os.environ.get("DEBUG", "False"))

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", None).split(",")
CSRF_TRUSTED_ORIGINS = os.environ.get("CSRF_TRUSTED_ORIGINS", None).split(",")
SECRET_KEY = os.environ.get("SECRET_KEY", None)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql_psycopg2",
        "HOST": os.environ.get("PGHOST", None),
        "PORT": os.environ.get("PGPORT", "5432"),
        "USER": os.environ.get("PGUSER", None),
        "PASSWORD": os.environ.get("PGPASSWORD", None),
        "NAME": os.environ.get("PGDATABASE", None),
    }
}

################################################################################
#####                      CONFIGURAZIONE SESSIONI                         #####
################################################################################
SESSION_COOKIE_AGE = int(os.environ.get("SESSION_COOKIE_AGE", 1209600))
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "sessionid")
################################################################################

################################################################################
#                             L  O  G  G  I  N  G                              #
################################################################################
LOGGING_CONFIG = None
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "console": {
                # exact format is not important, this is the minimum information
                "format": "%(asctime)s %(name)-12s %(levelname)-8s %(message)s",
            },
            "django.server": DEFAULT_LOGGING["formatters"]["django.server"],
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "console",
            },
            "django.server": DEFAULT_LOGGING["handlers"]["django.server"],
        },
        "loggers": {
            # root logger
            "": {
                "level": "INFO",
                "handlers": [
                    "console",
                ],
            },
            "django.server": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
        },
    }
)
################################################################################


################################################################################
#####                           RAWG API KEY                               #####
################################################################################
RAWG_API_KEY = os.environ.get("RAWG_API_KEY", None)
################################################################################
