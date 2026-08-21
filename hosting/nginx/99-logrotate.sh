#!/bin/sh
# Rotate the access log, nightly.
#
# nginx:alpine has no cron running, so a logrotate config on its own would
# never fire. busybox crond is in the image already; this starts it in the
# background before nginx takes the foreground.
#
# Dropped in /docker-entrypoint.d rather than replacing CMD or ENTRYPOINT: the
# stock nginx entrypoint runs everything here first, so the template handling
# it does for us is left alone.
set -e

mkdir -p /var/log/hosting

cat > /etc/crontabs/root <<'CRON'
0 1 * * * /usr/sbin/logrotate /etc/logrotate.d/hosting --state /var/lib/logrotate.status
CRON

crond -b -l 8
