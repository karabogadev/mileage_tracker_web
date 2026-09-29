#!/bin/sh
# Builds /etc/nginx/admin.htpasswd from ADMIN_USER / ADMIN_PASSWORD (set them in Coolify, never in the repo).
# Fails closed: without both variables the file stays empty and every /admin request gets a 401.
set -eu

file=/etc/nginx/admin.htpasswd
: > "$file"

if [ -n "${ADMIN_USER:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  case "$ADMIN_USER" in *:*|*[!A-Za-z0-9._@-]*)
    echo "admin-auth: ADMIN_USER may only contain letters, digits and . _ @ -; /admin stays locked" >&2
    exit 0 ;;
  esac
  printf '%s:%s\n' "$ADMIN_USER" "$(printf '%s' "$ADMIN_PASSWORD" | openssl passwd -6 -stdin)" > "$file"
  echo "admin-auth: user '$ADMIN_USER' enabled for /admin"
else
  echo "admin-auth: ADMIN_USER / ADMIN_PASSWORD not set; /admin stays locked" >&2
fi

chown root:nginx "$file"
chmod 640 "$file"
