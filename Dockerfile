###########################
# BUILD PHASE 1: frontend #
###########################
FROM oven/bun:1.4.4 AS build-frontend
WORKDIR /app/frontend
COPY ./frontend/package.json ./frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY ./frontend/ ./
COPY ./docs/schema.graphql /app/docs/schema.graphql
RUN bun run build

#################
# BUILD PHASE 2 #
#################
FROM pdonadeo/e-uscito-joypad-base:latest AS build-stage-2

USER root
ADD --chown=opam:opam ./dune ./dune-project /app/
ADD --chown=opam:opam ./src /app/src
ADD --chown=opam:opam ./infra/db/migrazioni /app/infra/db/migrazioni
RUN mkdir -p /app/frontend/dist
ADD --chown=opam:opam ./frontend/dune /app/frontend/dune
COPY --from=build-frontend --chown=opam:opam /app/frontend/dist /app/frontend/dist
RUN chown opam:opam /app/frontend /app/frontend/dist
RUN test -f /app/frontend/dist/index.html
RUN apk add upx

USER opam
WORKDIR /app
ENV PATH=/home/opam/_opam/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN dune build @install
RUN chmod +w /app/_build/default/src/e_uscito_joypad.exe && \
  upx /app/_build/default/src/e_uscito_joypad.exe

USER root
RUN mv /app/_build/default/src/e_uscito_joypad.exe /usr/local/bin/e_uscito_joypad
RUN chown root:root /usr/local/bin/e_uscito_joypad

################
# DEPLOY PHASE #
################
FROM alpine:3.24
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
ENV MEDIA_ROOT=/media
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
