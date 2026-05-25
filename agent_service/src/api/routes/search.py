"""
Semantic search routes
=======================
GET /search/assets    — semantic + filtered search over Asset nodes
GET /search/materials — semantic + filtered search over Material nodes

The `q` parameter drives cosine-similarity ranking via the stored embeddings.
All other parameters (estado, categoriaId, etc.) are applied as exact-match
Cypher filters — independent of the semantic score.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Query

from ...pipeline.embeddings import build_gemini_embedding
from ...knowledge_graph.asset_embedding_store import (
    search_assets as _neo_search_assets,
    search_materials as _neo_search_materials,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Embedding model singleton ─────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _embed_model():
    return build_gemini_embedding()


def _query_embedding(q: str | None) -> list[float] | None:
    if not q or not q.strip():
        return None
    try:
        return _embed_model().get_text_embedding(q.strip())
    except Exception as exc:
        logger.warning("[Search] Failed to embed query '%s': %s", q, exc)
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/assets",
    summary="Semantic search over assets",
    description=(
        "Returns assets ranked by cosine similarity to *q*. "
        "All other query params are applied as exact filters in Neo4j."
    ),
)
async def search_assets(
    q: str | None = Query(None, description="Free-text semantic query"),
    estado: str | None = Query(None, description="Exact estado filter"),
    categoriaId: str | None = Query(None, description="Exact categoriaId filter"),  # noqa: N803
    ubicacionId: str | None = Query(None, description="Exact ubicacionId filter"),  # noqa: N803
    areaIds: list[str] | None = Query(None, description="Allowed areaActualId values (scoping)"),  # noqa: N803
    sortBy: str | None = Query(None, description="Field to sort by when q is absent"),  # noqa: N803
    sortType: str = Query("DESC", description="ASC or DESC"),  # noqa: N803
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),  # noqa: N803
) -> dict[str, Any]:
    embedding = _query_embedding(q)

    items, total = _neo_search_assets(
        embedding,
        estado=estado,
        categoria_id=categoriaId,
        ubicacion_id=ubicacionId,
        area_ids=areaIds if areaIds else None,
        sort_by=sortBy,
        sort_type=sortType,
        page=page,
        page_size=pageSize,
    )

    return {
        "data": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }


@router.get(
    "/materials",
    summary="Semantic search over materials",
    description=(
        "Returns materials ranked by cosine similarity to *q*. "
        "categoriaId and areaId are applied as exact filters."
    ),
)
async def search_materials(
    q: str | None = Query(None, description="Free-text semantic query"),
    categoriaId: str | None = Query(None, description="Exact categoriaId filter"),  # noqa: N803
    areaId: str | None = Query(None, description="Exact areaId filter"),  # noqa: N803
    sortBy: str | None = Query(None, description="Field to sort by when q is absent"),  # noqa: N803
    sortType: str = Query("DESC", description="ASC or DESC"),  # noqa: N803
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=200),  # noqa: N803
) -> dict[str, Any]:
    embedding = _query_embedding(q)

    items, total = _neo_search_materials(
        embedding,
        categoria_id=categoriaId,
        area_id=areaId,
        sort_by=sortBy,
        sort_type=sortType,
        page=page,
        page_size=pageSize,
    )

    return {
        "data": items,
        "total": total,
        "page": page,
        "pageSize": pageSize,
    }
