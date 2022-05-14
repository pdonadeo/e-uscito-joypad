#######################
# STEP 1: BUILD IMAGE #
#######################
FROM python:3.10-alpine AS build-image

RUN apk update \
 && apk add --no-cache \
        autoconf \
        automake \
        bash \
        build-base \
        cargo \
        cmake \
        g++ \
        gcc \
        git \
        libffi \
        libtool \
        czmq-dev \
        jpeg-dev \
        libffi-dev \
        libwebp-dev \
        libxml2-dev \
        libxslt-dev \
        make \
        musl-dev \
        openssl-dev \
        python3-dev \
        unixodbc-dev \
        zlib-dev


RUN /usr/local/bin/pip install poetry

ENV HOME="/app"
ENV VIRTUAL_ENV=/venv

WORKDIR $HOME

COPY pyproject.toml poetry.lock ./

RUN python3 -m venv $VIRTUAL_ENV            \
 && poetry config virtualenvs.create false  \
 && poetry install --no-interaction --no-dev --no-root

########################
# STEP 2: DEPLOY IMAGE #
########################
FROM python:3.10-alpine AS deploy-image

ENV USER=joypad
ENV UID=1000
ENV GID=1000
ENV HOME="/app"
ENV VIRTUAL_ENV=/venv
ENV GUNICORN_TIMEOUT 30
ENV GUNICORN_WORKERS 4
ENV DJANGO_COLLECTSTATIC: "True"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR $HOME

RUN apk update                                                          \
    && apk add --no-cache                                               \
        bash sudo jpeg zlib libtool unixodbc                            \
        libffi czmq libxml2 libxslt openssl libwebp-dev libwebp ncdu    \
        htop gettext mailcap                                            \
    && addgroup -g "$GID" -S "$USER"                                    \
    && adduser                                                          \
       --disabled-password                                              \
       --gecos ""                                                       \
       --home "$HOME"                                                   \
       --ingroup "$USER"                                                \
       --no-create-home                                                 \
       --uid "$UID" "$USER"                                             \
    && echo "$USER ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/$USER      \
    && chmod 0440 /etc/sudoers.d/$USER

COPY --from=build-image $VIRTUAL_ENV $VIRTUAL_ENV
ADD . ./
RUN chmod +x ./docker-entrypoint.sh
RUN chown ${UID}:${GID} /app

USER ${UID}:${GID}

EXPOSE 8000

ENV DJANGO_SETTINGS_MODULE=euscitojoypad_db.settings_docker
ENV DEBUG=False
ENV ALLOWED_HOSTS="*"
ENV CSRF_TRUSTED_ORIGINS=""
ENV SECRET_KEY="CHANGE THIS IN PRODUCTION"
ENV DJANGO_SUPERUSER_USERNAME="admin"
ENV DJANGO_SUPERUSER_PASSWORD="admin"
ENV RAWG_API_KEY="CHANGE THIS IN PRODUCTION"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD /venv/bin/gunicorn --bind :8000 --workers $GUNICORN_WORKERS     \
    --timeout $GUNICORN_TIMEOUT -k uvicorn.workers.UvicornWorker    \
    euscitojoypad_db.asgi:application
