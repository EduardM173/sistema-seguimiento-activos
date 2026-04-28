"""API routes package."""
from .admin import router as admin_router
from .chat import router as chat_router
from .ingestion import router as ingestion_router
from .query import router as query_router
from .reasoning import router as reasoning_router

__all__ = [
    "admin_router",
    "chat_router",
    "ingestion_router",
    "query_router",
    "reasoning_router",
]
