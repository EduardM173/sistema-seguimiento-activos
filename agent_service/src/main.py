"""
Application entry point.
Run with:  uvicorn src.main:app --reload --loop asyncio
"""
from __future__ import annotations

import atexit
import logging

import nest_asyncio
nest_asyncio.apply()

from src.api import create_app
from src.config import settings
from src.consul_utils import register_with_consul, deregister_from_consul

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

app = create_app()

# Registrar en Consul al importar el módulo (uvicorn importa main en el worker)
_consul_instance_id: str | None = None
try:
    _consul_instance_id = register_with_consul(port=settings.app_port)
    atexit.register(lambda: deregister_from_consul(_consul_instance_id) if _consul_instance_id else None)
except Exception as exc:
    logging.getLogger(__name__).warning("[Consul] No se pudo registrar: %s", exc)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
        log_level=settings.log_level.lower(),
    )
