###############
# BUILD PHASE #
###############
FROM ocaml/opam:alpine-ocaml-4.12

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
RUN opam install dream batteries timedesc

USER root
ADD ./ /app
RUN chown -R opam:opam /app
RUN apk add upx

USER opam
WORKDIR /home/opam
ENV PATH /home/opam/.opam/4.12/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN cd /app && dune build src/e_uscito_joypad.exe
RUN upx /app/_build/default/src/e_uscito_joypad.exe

USER root
RUN mv /app/_build/default/src/e_uscito_joypad.exe /usr/local/bin/e_uscito_joypad
RUN chown root:root /usr/local/bin/e_uscito_joypad

################
# DEPLOY PHASE #
################
FROM alpine:latest
COPY --from=0 /usr/local/bin/e_uscito_joypad /usr/local/bin/
ADD ./assets /assets
RUN apk update
RUN apk add gmp libev ca-certificates ca-certificates-bundle
COPY Dockerfile /Dockerfile

WORKDIR /
EXPOSE 8000
ENV ULTIMA_PUNTATA "2022-03-19"
CMD [ "/usr/local/bin/e_uscito_joypad" ]
