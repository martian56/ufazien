FROM nginx:alpine

# logrotate, because the access log holds a raw address for every request to
# every hosted site and this image has nothing that would ever truncate it —
# no logrotate, no cron. Left alone the file grows without bound and keeps a
# copy of the platform's visitors for ever.
RUN apk add --no-cache logrotate

# Baked in rather than bind-mounted: Coolify rewrites relative compose bind
# mounts to /data/coolify/applications/<uuid>/... instead of the git checkout,
# so ./nginx/hosting.conf would not resolve to this repo's file.
COPY hosting.conf /etc/nginx/conf.d/default.conf

# 0644 explicitly. COPY keeps the mode the file has in the repo, which is
# group-writable — and logrotate refuses a config anybody but its owner could
# edit, silently: "Ignoring /etc/logrotate.d/hosting because it is writable by
# group or others", and then never rotates anything.
COPY --chmod=0644 logrotate-hosting /etc/logrotate.d/hosting

# The stock entrypoint runs everything in here before starting nginx.
COPY --chmod=0755 99-logrotate.sh /docker-entrypoint.d/99-logrotate.sh
