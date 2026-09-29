# Static website served by nginx. Coolify: build pack "Dockerfile", port 80.
FROM nginx:stable-alpine

# openssl hashes the /admin basic-auth password at container start (see docker/40-admin-auth.sh)
RUN apk add --no-cache openssl && rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/admin-auth.conf /etc/nginx/snippets/admin-auth.conf
COPY docker/40-admin-auth.sh /docker-entrypoint.d/40-admin-auth.sh
RUN chmod +x /docker-entrypoint.d/40-admin-auth.sh
COPY public/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
