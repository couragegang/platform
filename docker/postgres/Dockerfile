# Postgres с паролем, заданным на этапе сборки (для VPS без .env на хосте).
ARG POSTGRES_PASSWORD=platform
FROM postgres:16-alpine
ARG POSTGRES_PASSWORD
ENV POSTGRES_USER=platform
ENV POSTGRES_DB=platform
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
COPY ./init-db/ /docker-entrypoint-initdb.d/
