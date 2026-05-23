"""
FastAPI application factory.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.ingestion import router as ingestion_router
from .routes.query import router as query_router
from .routes.admin import router as admin_router
from .routes.reasoning import router as reasoning_router
from .routes.chat import router as chat_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    # Register LlamaIndex instrumentation BEFORE anything else touches the framework.
    from ..telemetry import register_instrumentation
    register_instrumentation()

    app = FastAPI(
        title="GraphRAG — Banking Customer Service Assistant",
        description=(
            "LlamaIndex + Google GenAI based agentic RAG pipeline with:\n"
            "- PropertyGraphIndex stores for axioms, rules, facts, theorems\n"
            "- Z3 theorem prover for formal verification\n"
            "- Symbolic logic evaluator engine for customer service assistance\n"
            "- PostgreSQL persistence and multi-modal document ingestion\n"
            "- RAG-enabled chat with dynamic Z3 deduction and admin verification"
        ),
        version="0.3.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(ingestion_router, prefix="/ingest", tags=["Ingestion"])
    app.include_router(query_router, prefix="/query", tags=["Query"])
    app.include_router(reasoning_router, prefix="/reason", tags=["Reasoning"])
    app.include_router(chat_router, prefix="/chat", tags=["Chat"])
    app.include_router(admin_router, prefix="/admin", tags=["Admin"])

    @app.get("/health", tags=["Health"])
    async def health() -> dict:
        return {"status": "ok"}

    return app
