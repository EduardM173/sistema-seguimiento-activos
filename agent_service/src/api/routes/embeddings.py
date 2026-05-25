"""
Embeddings ingestion routes
============================
POST /embeddings/asset    — upsert an asset into Neo4j with its embedding
POST /embeddings/material — upsert a material into Neo4j with its embedding

These endpoints are called internally by the backend after every
create / update of an Activo or Material in PostgreSQL.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ...pipeline.embeddings import build_gemini_embedding
from ...knowledge_graph.asset_embedding_store import (
    asset_embed_text,
    material_embed_text,
    upsert_asset,
    upsert_material,
    get_missing_ids,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Embedding model singleton ─────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _embed_model():
    return build_gemini_embedding()


def _get_embedding(text: str) -> list[float]:
    if not text.strip():
        raise ValueError("Cannot embed empty text")
    return _embed_model().get_text_embedding(text)


# ── Typing ───────────────────────────────────────────────────────────────────
from typing import Literal

# ── Request schemas ───────────────────────────────────────────────────────────

class AssetSyncPayload(BaseModel):
    """Flat asset payload sent by the backend after create / update."""
    id: str
    codigo: str
    nombre: str
    descripcion: str | None = None
    marca: str | None = None
    modelo: str | None = None
    numeroSerie: str | None = None
    estado: str = "OPERATIVO"
    categoriaId: str | None = None
    categoriaNombre: str | None = None
    ubicacionId: str | None = None
    ubicacionNombre: str | None = None
    areaActualId: str | None = None
    areaNombre: str | None = None
    responsableActualId: str | None = None
    responsableNombre: str | None = None
    creadoEn: str | None = None
    actualizadoEn: str | None = None


class MaterialSyncPayload(BaseModel):
    """Flat material payload sent by the backend after create / update."""
    id: str
    codigo: str
    nombre: str
    descripcion: str | None = None
    unidad: str = ""
    stockActual: float = 0.0
    stockMinimo: float = 0.0
    categoriaId: str | None = None
    categoriaNombre: str | None = None
    areaId: str | None = None
    areaNombre: str | None = None
    creadoEn: str | None = None
    actualizadoEn: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/asset",
    status_code=status.HTTP_200_OK,
    summary="Sync asset to Neo4j with embedding",
)
async def sync_asset(payload: AssetSyncPayload) -> dict[str, Any]:
    data = payload.model_dump()
    text = asset_embed_text(data)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Asset has no indexable text (nombre is required).",
        )
    try:
        embedding = _get_embedding(text)
        upsert_asset(data, embedding)
        logger.info("[Embeddings] Asset synced to Neo4j: %s (%s)", payload.id, payload.nombre)
        return {"synced": True, "id": payload.id}
    except Exception as exc:
        logger.error("[Embeddings] Failed to sync asset %s: %s", payload.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to sync asset to graph: {exc}",
        ) from exc


@router.post(
    "/material",
    status_code=status.HTTP_200_OK,
    summary="Sync material to Neo4j with embedding",
)
async def sync_material(payload: MaterialSyncPayload) -> dict[str, Any]:
    data = payload.model_dump()
    text = material_embed_text(data)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Material has no indexable text (nombre is required).",
        )
    try:
        embedding = _get_embedding(text)
        upsert_material(data, embedding)
        logger.info("[Embeddings] Material synced to Neo4j: %s (%s)", payload.id, payload.nombre)
        return {"synced": True, "id": payload.id}
    except Exception as exc:
        logger.error("[Embeddings] Failed to sync material %s: %s", payload.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to sync material to graph: {exc}",
        ) from exc


# ── Diff-sync: check which IDs are missing from Neo4j ────────────────────────

class CheckMissingRequest(BaseModel):
    ids: list[str]
    type: Literal["asset", "material"]


@router.post(
    "/check-missing",
    status_code=status.HTTP_200_OK,
    summary="Return IDs not yet indexed in Neo4j",
)
async def check_missing(body: CheckMissingRequest) -> dict[str, Any]:
    """
    Given a list of Postgres IDs, return the subset that is NOT present
    in Neo4j.  Used by the backend rebuild-index endpoint to do a
    diff-based sync (only push what is actually missing).
    """
    node_label = "Asset" if body.type == "asset" else "Material"
    try:
        missing = get_missing_ids(body.ids, node_label)
        return {"missing": missing, "total": len(missing)}
    except Exception as exc:
        logger.error("[CheckMissing] Failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Neo4j unavailable: {exc}",
        ) from exc
