#!/bin/sh
# Container start-up: bring the database up to date, then hand off to the CMD.
#
# migrate and create_subscription_plans used to run at image *build* time, which
# meant every build needed a reachable production database and mutated it as a
# side effect of building. They belong here, at run time, instead.
#
# collectstatic stays in the Dockerfile: it needs no database, and the manifest
# it produces is required by WhiteNoise's CompressedManifestStaticFilesStorage.

set -e

DB_PORT="${DB_PORT:-5432}"

if [ -n "$DB_HOST" ]; then
    echo "Waiting for database at ${DB_HOST}:${DB_PORT} ..."
    i=0
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
        i=$((i + 1))
        if [ "$i" -ge 30 ]; then
            echo "Database not reachable after 60s, giving up." >&2
            exit 1
        fi
        sleep 2
    done
    echo "Database is up."
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Applying migrations ..."
    python manage.py migrate --noinput
    python manage.py create_subscription_plans
else
    echo "RUN_MIGRATIONS is not 'true', skipping migrations."
fi

# Provisions the media buckets and reasserts their read policies. A no-op when
# object storage is unconfigured. Deliberately not fatal: object storage being
# briefly unreachable should not stop the site from serving.
python manage.py ensure_media_buckets || \
    echo "ensure_media_buckets failed; uploads may not work until this is resolved." >&2

exec "$@"
