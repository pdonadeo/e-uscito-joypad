FROM golang:1.24.1-alpine3.21 AS build-stage

USER root
ADD  ./go.mod ./go.sum ./bot.go /app/
RUN cd /app && go build .

FROM alpine:3.21

COPY --from=build-stage /app/discord-bot /usr/local/bin/discord-bot

ENV DISCORD_APPLICATION_ID=CHANGE_ME_IN_PRODUCTION
ENV DISCORD_BOT_TOKEN=CHANGE_ME_IN_PRODUCTION
ENV PGHOST=postgresql
ENV PGPORT=5432
ENV PGUSER=django_db_user
ENV PGPASSWORD=admin
ENV PGDATABASE=euj
ENV DEBUG=True

WORKDIR /
ENTRYPOINT ["/usr/local/bin/discord-bot"]
