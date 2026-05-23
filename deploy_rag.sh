#!/usr/bin/env bash
#
# deploy_rag.sh
# -------------
# Levanta los dos stacks de Docker Compose (Activos + GraphRAG/Agent) en una
# red Docker compartida, para que se puedan comunicar por nombre de servicio.
#
# Topología resultante (red `red_global`):
#
#   ┌─────────────────────────────┐         ┌──────────────────────────────┐
#   │ docker-compose.yml          │         │ agent_service/docker-compose │
#   │   activos_db_local          │         │   graphrag_db                │
#   │   activos_backend_local     │         │   graphrag_neo4j             │
#   │   activos_frontend_local ◄──┼─────────┼─► graphrag_app (DeeplinkAgent)│
#   └─────────────────────────────┘         └──────────────────────────────┘
#
# El DeeplinkAgent del agent_service consume el navigation map del frontend
# en `http://activos_frontend_local:8084/__deeplink/navigation-map.json`.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_NAME="${SHARED_NETWORK:-red_global}"

ACTIVOS_COMPOSE="${ROOT_DIR}/docker-compose.yml"
AGENT_COMPOSE="${ROOT_DIR}/agent_service/docker-compose.yml"

# URL que el agent_service usará para hablarle al frontend dentro de la red
# compartida. Override con la env var DEEPLINK_NAV_MAP_URL si hace falta.
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-activos_frontend_local}"
FRONTEND_INTERNAL_PORT="${FRONTEND_INTERNAL_PORT:-8084}"
DEEPLINK_NAV_MAP_URL="${DEEPLINK_NAV_MAP_URL:-http://${FRONTEND_CONTAINER}:${FRONTEND_INTERNAL_PORT}/__deeplink/navigation-map.json}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [up|down|restart|logs|status]

Comandos:
  up       (default) Crea la red compartida y levanta ambos stacks.
  down     Detiene y elimina ambos stacks (la red NO se borra).
  restart  Equivalente a 'down' + 'up'.
  logs     Tail de logs combinados.
  status   Muestra contenedores y red.
EOF
}

ensure_network() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "==> Creando red compartida '$NETWORK_NAME'"
    docker network create "$NETWORK_NAME" >/dev/null
  else
    echo "==> Red '$NETWORK_NAME' ya existe"
  fi
}

assert_files() {
  for f in "$ACTIVOS_COMPOSE" "$AGENT_COMPOSE"; do
    if [[ ! -f "$f" ]]; then
      echo "ERROR: no existe $f" >&2
      exit 1
    fi
  done
}

up() {
  assert_files
  ensure_network

  echo "==> Levantando stack GraphRAG (agent_service)"
  # Inyectamos la URL del frontend para que el DeeplinkAgent pueda fetchear
  # el navigation map sin tener que hardcodear el host.
  DEEPLINK_NAV_MAP_URL="$DEEPLINK_NAV_MAP_URL" \
    docker compose -f "$AGENT_COMPOSE" up -d 

  echo "==> Levantando stack Activos (backend + frontend)"
  docker compose -f "$ACTIVOS_COMPOSE" up -d 

  echo
  echo "Ambos stacks corriendo en la red '$NETWORK_NAME'."
  echo "  Frontend  : http://localhost:8085"
  echo "  Agent API : http://localhost:8000"
  echo "  DeeplinkAgent → $DEEPLINK_NAV_MAP_URL"
}

down() {
  assert_files
  echo "==> Bajando stack Activos"
  docker compose -f "$ACTIVOS_COMPOSE" down || true
  echo "==> Bajando stack GraphRAG"
  docker compose -f "$AGENT_COMPOSE" down || true
  echo "Listo. La red '$NETWORK_NAME' se conserva (borrar manual: docker network rm $NETWORK_NAME)."
}

logs() {
  docker compose -f "$AGENT_COMPOSE" -f "$ACTIVOS_COMPOSE" logs -f --tail=100
}

status() {
  echo "==> Contenedores en '$NETWORK_NAME'"
  docker ps --filter "network=${NETWORK_NAME}" \
    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo
  echo "==> Red '$NETWORK_NAME'"
  docker network inspect "$NETWORK_NAME" \
    --format '{{range .Containers}}  - {{.Name}} ({{.IPv4Address}}){{"\n"}}{{end}}'
}

cmd="${1:-up}"
case "$cmd" in
  up)      up ;;
  down)    down ;;
  restart) down; up ;;
  logs)    logs ;;
  status)  status ;;
  -h|--help|help) usage ;;
  *) usage; exit 1 ;;
esac
