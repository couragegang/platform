#!/bin/sh
# Загружает конфиг, вшитый в образ при сборке (контур prod на VPS).
set -e
if [ -f /app/config/runtime-baked.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /app/config/runtime-baked.env
  set +a
fi
if [ -z "${APP_JAR:-}" ]; then
  echo "APP_JAR is not set" >&2
  exit 1
fi
exec java -jar "$APP_JAR"
