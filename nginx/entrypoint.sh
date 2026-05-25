#!/bin/sh
set -e

# ── Fail Fast: CONSUL_HOST y CONSUL_PORT son obligatorias ────────────────────
if [ -z "${CONSUL_HOST}" ]; then
  echo "[nginx-gateway] ERROR: Falta la variable de entorno CONSUL_HOST" >&2
  exit 1
fi
if [ -z "${CONSUL_PORT}" ]; then
  echo "[nginx-gateway] ERROR: Falta la variable de entorno CONSUL_PORT" >&2
  exit 1
fi
if [ -z "${APP_DOMAIN}" ]; then
  echo "[nginx-gateway] ERROR: Falta la variable de entorno APP_DOMAIN" >&2
  exit 1
fi

CONSUL_ADDR="${CONSUL_HOST}:${CONSUL_PORT}"
TEMPLATE="/etc/nginx/nginx.conf.ctmpl:/etc/nginx/conf.d/default.conf"

echo "[nginx-gateway] Esperando a Consul en ${CONSUL_ADDR}..."
until consul-template \
  -consul-addr "${CONSUL_ADDR}" \
  -template "${TEMPLATE}" \
  -once 2>/dev/null; do
  echo "[nginx-gateway] Consul no disponible, reintentando en 3s..."
  sleep 3
done

echo "[nginx-gateway] Config inicial generada. Arrancando Nginx..."

# Nginx en background
nginx -g "daemon off;" &
NGINX_PID=$!

# consul-template en foreground: regenera la config y hace
# "nginx -s reload" automáticamente cada vez que Consul cambia
consul-template \
  -consul-addr "${CONSUL_ADDR}" \
  -template "${TEMPLATE}:nginx -s reload"

# Si consul-template muere, matar nginx también
kill "${NGINX_PID}"
