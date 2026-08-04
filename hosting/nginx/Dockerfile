FROM nginx:alpine

# Baked in rather than bind-mounted: Coolify rewrites relative compose bind
# mounts to /data/coolify/applications/<uuid>/... instead of the git checkout,
# so ./nginx/hosting.conf would not resolve to this repo's file.
COPY hosting.conf /etc/nginx/conf.d/default.conf
