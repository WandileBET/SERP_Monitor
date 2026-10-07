#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
    db_host="${DB_DOCKER_HOST:-host.docker.internal}"

    export DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed \
        -e "s/@localhost:/@$db_host:/g" \
        -e "s/@127\.0\.0\.1:/@$db_host:/g")"
fi

exec "$@"