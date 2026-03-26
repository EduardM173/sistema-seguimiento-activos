#!/bin/bash
set -a

source ./.env

set +a

docker run -d --name postgres-16-admin \
  -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
  -e POSTGRES_USER=${POSTGRES_USER} \
  -e POSTGRES_DB=${POSTGRES_DB} \
  -p ${POSTGRES_PORT}:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine