"""
Utilidad de registro en Consul para el agent service (Python).
Replica el contrato de @activos/config para el ecosistema Python.

Variables de entorno:
  CONSUL_HOST      — hostname del servidor Consul (default: localhost)
  CONSUL_PORT      — puerto del servidor Consul  (default: 8500)
  SERVICE_ADDRESS  — dirección con la que otros contenedores alcanzan este servicio
"""
from __future__ import annotations

import logging
import os
import socket

import consul  # pip: python-consul2

logger = logging.getLogger(__name__)

# Nombre canónico de este servicio en Consul (mismo valor que ActivosService.AGENT en TS)
ACTIVOS_SERVICE_NAME = "activos-agent"
ACTIVOS_TAG = "activos"


def _build_client() -> consul.Consul:
    host = os.environ.get("CONSUL_HOST")
    port_raw = os.environ.get("CONSUL_PORT")

    if not host:
        raise RuntimeError("[consul_utils] Falta la variable de entorno CONSUL_HOST")
    if not port_raw:
        raise RuntimeError("[consul_utils] Falta la variable de entorno CONSUL_PORT")

    try:
        port = int(port_raw)
    except ValueError:
        raise RuntimeError(f"[consul_utils] CONSUL_PORT no es un número válido: '{port_raw}'")

    return consul.Consul(host=host, port=port)


def register_with_consul(port: int, health_path: str = "/health") -> str:
    """
    Registra este proceso en Consul.
    Devuelve el instance_id (necesario para deregister).
    """
    client = _build_client()
    address = os.environ.get("SERVICE_ADDRESS", "127.0.0.1")
    hostname = os.environ.get("HOSTNAME", socket.gethostname())
    instance_id = f"{ACTIVOS_SERVICE_NAME}-{hostname}"

    client.agent.service.register(
        name=ACTIVOS_SERVICE_NAME,
        service_id=instance_id,
        address=address,
        port=port,
        tags=[ACTIVOS_TAG],
        check=consul.Check.http(
            url=f"http://{address}:{port}{health_path}",
            interval="10s",
            deregister="30s",
        ),
    )

    logger.info(
        "[Consul] Registrado '%s' (%s) en %s:%s",
        ACTIVOS_SERVICE_NAME, instance_id, address, port,
    )
    return instance_id


def deregister_from_consul(instance_id: str) -> None:
    """Elimina este proceso del registro de Consul."""
    client = _build_client()
    client.agent.service.deregister(instance_id)
    logger.info("[Consul] Dado de baja '%s'", instance_id)
