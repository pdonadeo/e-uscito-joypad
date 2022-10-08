#################
# BUILD PHASE 1 #
#################
FROM node:16-alpine3.11 AS build-stage-1
WORKDIR /app
COPY ./frontend/package.json ./frontend/yarn.lock ./
RUN yarn
COPY ./frontend/ ./
RUN yarn build

#################
# BUILD PHASE 2 #
#################
FROM pdonadeo/e-uscito-joypad-base:latest AS build-stage-2

USER root
ADD --chown=opam:opam ./dune ./dune-project /app/
ADD --chown=opam:opam ./src /app/src
RUN mkdir -p /app/euscitojoypad_db /app/frontend/public /app/frontend/build
ADD --chown=opam:opam ./frontend/public /app/frontend/public
ADD --chown=opam:opam ./euscitojoypad_db/prerendered_index.html /app/euscitojoypad_db/prerendered_index.html
COPY --from=build-stage-1 --chown=opam:opam /app/build /app/frontend/build
RUN chown opam:opam /app/frontend /app/frontend/build /app/frontend/public /app/euscitojoypad_db
RUN apk add upx

USER opam
WORKDIR /app
ENV PATH /home/opam/.opam/4.14/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN dune build @install
RUN chmod +w /app/_build/default/src/e_uscito_joypad.exe && \
    upx /app/_build/default/src/e_uscito_joypad.exe

USER root
RUN mv /app/_build/default/src/e_uscito_joypad.exe /usr/local/bin/e_uscito_joypad
RUN chown root:root /usr/local/bin/e_uscito_joypad

################
# DEPLOY PHASE #
################
FROM alpine:latest
COPY --from=build-stage-2 /usr/local/bin/e_uscito_joypad /usr/local/bin/
RUN apk update
RUN apk add --no-cache                                  \
    gmp libev ca-certificates ca-certificates-bundle    \
    libstdc++ libpq libffi tzdata
ENV TZ=Europe/Rome

ENV REST_LISTEN_ADDRESS=0.0.0.0
ENV REST_LISTEN_PORT=3000
ENV DEBUG=True
ENV MEDIA_URL="bo/files/"
ENV GC_PERIOD_SEC=60
ENV PGHOST=postgresql
ENV PGPORT=5432
ENV PGUSER=django_db_user
ENV PGPASSWORD=admin
ENV PGDATABASE=euj

COPY Dockerfile /Dockerfile

WORKDIR /
EXPOSE 3000
CMD [ "/usr/local/bin/e_uscito_joypad" ]
