###############
# BUILD PHASE #
###############
FROM ocaml/opam:alpine-ocaml-4.14

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
ADD ./e-uscito-joypad.opam.locked /home/opam/
RUN opam install ./e-uscito-joypad.opam.locked --deps-only

USER root
ADD ./ /app
RUN chown -R opam:opam /app
RUN apk add upx

USER opam
WORKDIR /home/opam
ENV PATH /home/opam/.opam/4.14/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN cd /app && opam install .
RUN upx /home/opam/.opam/4.14/bin/e_uscito_joypad

USER root
RUN mv /home/opam/.opam/4.14/bin/e_uscito_joypad /usr/local/bin/e_uscito_joypad
RUN chown root:root /usr/local/bin/e_uscito_joypad

################
# DEPLOY PHASE #
################
FROM alpine:latest
COPY --from=0 /usr/local/bin/e_uscito_joypad /usr/local/bin/
ADD ./assets /assets
RUN apk update
RUN apk add gmp libev ca-certificates ca-certificates-bundle libstdc++
COPY Dockerfile /Dockerfile

WORKDIR /
EXPOSE 3000
CMD [ "/usr/local/bin/e_uscito_joypad" ]
