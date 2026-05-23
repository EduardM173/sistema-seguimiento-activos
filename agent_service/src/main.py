"""
Application entry point.
Run with:  uvicorn src.main:app --reload --loop asyncio
"""
from __future__ import annotations

import nest_asyncio
nest_asyncio.apply()

import logging

from src.api import create_app
from src.config import settings

logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
        log_level=settings.log_level.lower(),
    )
