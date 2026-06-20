#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/bizchat/backend
ARCHIVE=/tmp/bizchat-backend.tgz

install -d -m 0755 "$APP_DIR"
tar -xzf "$ARCHIVE" -C "$APP_DIR" --strip-components=1
cd "$APP_DIR"
npm ci --omit=dev

DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
  -c "ALTER ROLE bizchat_app WITH LOGIN PASSWORD '$DB_PASSWORD';"

umask 077
printf '%s\n' \
  'NODE_ENV=production' \
  'HOST=127.0.0.1' \
  'PORT=5001' \
  "DATABASE_URL=postgresql://bizchat_app:${DB_PASSWORD}@127.0.0.1:5432/bizchatdb" \
  "JWT_SECRET=${JWT_SECRET}" \
  'JWT_EXPIRES_IN=8h' \
  'CORS_ORIGIN=*' > .env

sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres \
  -c "ALTER SYSTEM SET listen_addresses = 'localhost';"
systemctl restart postgresql

pm2 delete bizchat-api >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --env production
pm2 save

curl --fail --silent --show-error http://127.0.0.1:5001/api/health
printf '\n'
curl --fail --silent --show-error http://127.0.0.1:5001/api/health/ready
printf '\n'
