#!/bin/sh
set -eu

# Docker gets the same application settings from .env via docker-compose.
# When DATABASE_URL points at localhost/127.0.0.1, translate that host inside
# the container so it can reach the PostgreSQL service on the Docker host.
if [ -n "${DATABASE_URL:-}" ]; then
  db_host="${DB_DOCKER_HOST:-host.docker.internal}"
  export DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed \
    -e "s/@localhost:/@$db_host:/g" \
    -e "s/@127\\.0\\.0\\.1:/@$db_host:/g")"
fi

exec "$@"
