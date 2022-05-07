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
FROM ocaml/opam:alpine-ocaml-4.14 AS build-stage-2

USER root
RUN apk update && apk upgrade
RUN apk add libgmpxx gmp-dev \
    libev-dev libev \
    openssl-dev \
    zlib-dev

USER opam
WORKDIR /home/opam
RUN opam repo set-url default https://opam.ocaml.org
RUN opam update -y && opam upgrade -y
ADD ./e-uscito-joypad.opam.locked.docker /home/opam/e-uscito-joypad.opam.locked
RUN opam install ./e-uscito-joypad.opam.locked --deps-only

USER root
ADD ./ /app
RUN chown -R opam:opam /app
RUN apk add upx

USER opam
WORKDIR /app
ENV PATH /home/opam/.opam/4.14/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN rm -Rf assets && mkdir assets
COPY --from=build-stage-1 /app/build/* ./assets/
COPY --from=build-stage-1 /app/build/* ./frontend/build/
USER root
RUN rm -Rf ./assets/js && mkdir ./assets/js
USER opam
COPY --from=build-stage-1 /app/build/static/js/* ./assets/js/
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
COPY --from=build-stage-2 /app/assets /assets
RUN apk update
RUN apk add gmp libev ca-certificates ca-certificates-bundle libstdc++
COPY Dockerfile /Dockerfile

WORKDIR /
EXPOSE 3000
CMD [ "/usr/local/bin/e_uscito_joypad" ]
