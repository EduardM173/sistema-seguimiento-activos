"""
Neo4j store for Asset and Material nodes with vector embeddings.

Each node is a denormalized replica of the corresponding PostgreSQL row plus
a 768-dim embedding vector (text-embedding-004) for cosine-similarity search.

Labels:
    Asset    — mirrors the `activos` table
    Material — mirrors the `materiales` table

Vector indexes:
    asset_embedding_idx    (Asset.embedding)
    material_embedding_idx (Material.embedding)
"""
from __future__ import annotations

import logging
from typing import Any

from neo4j import GraphDatabase, Driver

from ..config import settings

logger = logging.getLogger(__name__)

_ASSET_IDX = "asset_embedding_idx"
_MATERIAL_IDX = "material_embedding_idx"
_EMBED_DIM = 768  # text-embedding-004 output dimension


# ── Driver singleton ──────────────────────────────────────────────────────────

_driver_instance: Driver | None = None


def get_driver() -> Driver:
    global _driver_instance
    if _driver_instance is None:
        _driver_instance = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
    return _driver_instance


# ── Index bootstrap ───────────────────────────────────────────────────────────

def ensure_vector_indexes() -> None:
    """
    Create Asset and Material vector indexes in Neo4j if they do not exist.
    Safe to call on every startup (idempotent).
    """
    driver = get_driver()
    with driver.session() as session:
        session.run(
            f"""
            CREATE VECTOR INDEX {_ASSET_IDX} IF NOT EXISTS
            FOR (n:Asset) ON (n.embedding)
            OPTIONS {{
                indexConfig: {{
                    `vector.dimensions`: {_EMBED_DIM},
                    `vector.similarity_function`: 'cosine'
                }}
            }}
            """
        )
        session.run(
            f"""
            CREATE VECTOR INDEX {_MATERIAL_IDX} IF NOT EXISTS
            FOR (n:Material) ON (n.embedding)
            OPTIONS {{
                indexConfig: {{
                    `vector.dimensions`: {_EMBED_DIM},
                    `vector.similarity_function`: 'cosine'
                }}
            }}
            """
        )
    logger.info("Vector indexes ensured: %s, %s", _ASSET_IDX, _MATERIAL_IDX)


# ── Embedding text builders ───────────────────────────────────────────────────

def asset_embed_text(data: dict[str, Any]) -> str:
    """Build a rich text representation of an asset for embedding."""
    parts = [
        data.get("nombre") or "",
        data.get("marca") or "",
        data.get("modelo") or "",
        data.get("descripcion") or "",
        data.get("categoriaNombre") or "",
        data.get("ubicacionNombre") or "",
        data.get("areaNombre") or "",
    ]
    return " ".join(p for p in parts if p).strip()


def material_embed_text(data: dict[str, Any]) -> str:
    """Build a rich text representation of a material for embedding."""
    parts = [
        data.get("nombre") or "",
        data.get("descripcion") or "",
        data.get("unidad") or "",
        data.get("categoriaNombre") or "",
    ]
    return " ".join(p for p in parts if p).strip()


# ── Upsert ────────────────────────────────────────────────────────────────────

def upsert_asset(data: dict[str, Any], embedding: list[float]) -> None:
    """MERGE an Asset node in Neo4j, setting all fields + embedding."""
    with get_driver().session() as session:
        session.run(
            """
            MERGE (a:Asset {id: $id})
            SET
              a.codigo              = $codigo,
              a.nombre              = $nombre,
              a.descripcion         = $descripcion,
              a.marca               = $marca,
              a.modelo              = $modelo,
              a.numeroSerie         = $numeroSerie,
              a.estado              = $estado,
              a.categoriaId         = $categoriaId,
              a.categoriaNombre     = $categoriaNombre,
              a.ubicacionId         = $ubicacionId,
              a.ubicacionNombre     = $ubicacionNombre,
              a.areaActualId        = $areaActualId,
              a.areaNombre          = $areaNombre,
              a.responsableActualId = $responsableActualId,
              a.responsableNombre   = $responsableNombre,
              a.creadoEn            = $creadoEn,
              a.actualizadoEn       = $actualizadoEn,
              a.embedding           = $embedding
            """,
            id=data.get("id", ""),
            codigo=data.get("codigo", ""),
            nombre=data.get("nombre", ""),
            descripcion=data.get("descripcion"),
            marca=data.get("marca"),
            modelo=data.get("modelo"),
            numeroSerie=data.get("numeroSerie"),
            estado=data.get("estado", "OPERATIVO"),
            categoriaId=data.get("categoriaId"),
            categoriaNombre=data.get("categoriaNombre"),
            ubicacionId=data.get("ubicacionId"),
            ubicacionNombre=data.get("ubicacionNombre"),
            areaActualId=data.get("areaActualId"),
            areaNombre=data.get("areaNombre"),
            responsableActualId=data.get("responsableActualId"),
            responsableNombre=data.get("responsableNombre"),
            creadoEn=data.get("creadoEn"),
            actualizadoEn=data.get("actualizadoEn"),
            embedding=embedding,
        )


def upsert_material(data: dict[str, Any], embedding: list[float]) -> None:
    """MERGE a Material node in Neo4j, setting all fields + embedding."""
    with get_driver().session() as session:
        session.run(
            """
            MERGE (m:Material {id: $id})
            SET
              m.codigo          = $codigo,
              m.nombre          = $nombre,
              m.descripcion     = $descripcion,
              m.unidad          = $unidad,
              m.stockActual     = $stockActual,
              m.stockMinimo     = $stockMinimo,
              m.categoriaId     = $categoriaId,
              m.categoriaNombre = $categoriaNombre,
              m.areaId          = $areaId,
              m.areaNombre      = $areaNombre,
              m.creadoEn        = $creadoEn,
              m.actualizadoEn   = $actualizadoEn,
              m.embedding       = $embedding
            """,
            id=data.get("id", ""),
            codigo=data.get("codigo", ""),
            nombre=data.get("nombre", ""),
            descripcion=data.get("descripcion"),
            unidad=data.get("unidad", ""),
            stockActual=float(data.get("stockActual") or 0),
            stockMinimo=float(data.get("stockMinimo") or 0),
            categoriaId=data.get("categoriaId"),
            categoriaNombre=data.get("categoriaNombre"),
            areaId=data.get("areaId"),
            areaNombre=data.get("areaNombre"),
            creadoEn=data.get("creadoEn"),
            actualizadoEn=data.get("actualizadoEn"),
            embedding=embedding,
        )


# ── Search helpers ────────────────────────────────────────────────────────────

_ESTADO_LABELS: dict[str, str] = {
    "OPERATIVO": "Operativo",
    "MANTENIMIENTO": "En mantenimiento",
    "FUERA_DE_SERVICIO": "Fuera de servicio",
    "DADO_DE_BAJA": "Dado de baja",
}


def _estado_label(estado: str | None) -> str:
    return _ESTADO_LABELS.get(estado or "", estado or "")


def _asset_node_to_dict(node: Any, score: float | None) -> dict[str, Any]:
    p = dict(node)
    row: dict[str, Any] = {
        "id": p.get("id"),
        "codigo": p.get("codigo"),
        "nombre": p.get("nombre"),
        "descripcion": p.get("descripcion"),
        "marca": p.get("marca"),
        "modelo": p.get("modelo"),
        "estado": p.get("estado"),
        "estadoLabel": _estado_label(p.get("estado")),
        "creadoEn": p.get("creadoEn"),
        "categoria": (
            {"id": p.get("categoriaId"), "nombre": p.get("categoriaNombre")}
            if p.get("categoriaId") else None
        ),
        "ubicacion": (
            {"id": p.get("ubicacionId"), "nombre": p.get("ubicacionNombre")}
            if p.get("ubicacionId") else None
        ),
        "area": (
            {"id": p.get("areaActualId"), "nombre": p.get("areaNombre")}
            if p.get("areaActualId") else None
        ),
        "responsable": (
            {"id": p.get("responsableActualId"), "nombreCompleto": p.get("responsableNombre")}
            if p.get("responsableActualId") else None
        ),
    }
    if score is not None:
        row["_score"] = round(score, 6)
    return row


def _material_node_to_dict(node: Any, score: float | None) -> dict[str, Any]:
    p = dict(node)
    row: dict[str, Any] = {
        "id": p.get("id"),
        "codigo": p.get("codigo"),
        "nombre": p.get("nombre"),
        "descripcion": p.get("descripcion"),
        "unidad": p.get("unidad"),
        "stockActual": p.get("stockActual"),
        "stockMinimo": p.get("stockMinimo"),
        "creadoEn": p.get("creadoEn"),
        "categoriaId": p.get("categoriaId"),
        "categoria": (
            {"id": p.get("categoriaId"), "nombre": p.get("categoriaNombre")}
            if p.get("categoriaId") else None
        ),
        "areaId": p.get("areaId"),
        "area": (
            {"id": p.get("areaId"), "nombre": p.get("areaNombre")}
            if p.get("areaId") else None
        ),
        "actualizadoEn": p.get("actualizadoEn"),
    }
    if score is not None:
        row["_score"] = round(score, 6)
    return row


# ── Cosine similarity ─────────────────────────────────────────────────────────

def _cosine_similarity(a: list[float], b: list[float] | None) -> float:
    """
    Cosine similarity between two vectors, computed in pure Python.

    text-embedding-004 vectors are L2-normalised so this reduces to a dot
    product, but we keep the full formula for robustness.
    Returns 0.0 if either vector is missing or has zero magnitude.
    """
    import math

    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Search ────────────────────────────────────────────────────────────────────

_VECTOR_POOL = 500  # kept for reference; no longer used for search


def search_assets(
    query_embedding: list[float] | None,
    *,
    estado: str | None = None,
    categoria_id: str | None = None,
    ubicacion_id: str | None = None,
    area_ids: list[str] | None = None,
    sort_by: str | None = None,
    sort_type: str = "DESC",
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[dict[str, Any]], int]:
    """
    Search Asset nodes in Neo4j.

    Design rule: *query_embedding* (the `q` parameter) **only affects sort
    order — it never filters out items**.  All nodes that match the structural
    filters are always returned; `q` just re-ranks them by cosine similarity
    so the most relevant results appear first.

    When *query_embedding* is None, results are sorted by *sort_by*/*sort_type*.
    """
    driver = get_driver()
    skip = (page - 1) * page_size

    base_params: dict[str, Any] = {
        "estado": estado,
        "categoriaId": categoria_id,
        "ubicacionId": ubicacion_id,
        "areaIds": area_ids,
    }

    filter_where = """
        ($estado IS NULL OR a.estado = $estado)
        AND ($categoriaId IS NULL OR a.categoriaId = $categoriaId)
        AND ($ubicacionId IS NULL OR a.ubicacionId = $ubicacionId)
        AND ($areaIds IS NULL OR a.areaActualId IN $areaIds)
    """

    if query_embedding is not None:
        # ── Semantic re-rank: fetch ALL matching nodes, score in Python ──
        # q NEVER filters — it only changes the ordering.
        with driver.session() as session:
            all_rows = list(session.run(
                f"MATCH (a:Asset) WHERE {filter_where} RETURN a AS node",
                **base_params,
            ))

        total = len(all_rows)

        # Cold-start guard: if nothing came back and no structural filters
        # are active, verify that Neo4j actually has Asset nodes.  If the
        # index is empty (i.e. not yet seeded), raise so the caller can fall
        # back to Postgres rather than returning a misleading empty list.
        if total == 0 and not any([estado, categoria_id, ubicacion_id, area_ids]):
            with driver.session() as session:
                seed_rec = session.run(
                    "MATCH (a:Asset) RETURN count(a) AS c"
                ).single()
                if (seed_rec is None or seed_rec["c"] == 0):
                    raise RuntimeError(
                        "Neo4j Asset index is empty — not yet seeded from Postgres"
                    )

        scored = [
            (r["node"], _cosine_similarity(query_embedding, r["node"].get("embedding")))
            for r in all_rows
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        page_slice = scored[skip: skip + page_size]
        items = [_asset_node_to_dict(node, score) for node, score in page_slice]
    else:
        # ── Plain filter + sort in Cypher ────────────────────────────────
        order_field = _asset_order_field(sort_by)
        order_dir = "ASC" if (sort_type or "DESC").upper() == "ASC" else "DESC"
        params_plain = {**base_params, "skip": skip, "limit": page_size}

        with driver.session() as session:
            count_rec = session.run(
                f"MATCH (a:Asset) WHERE {filter_where} RETURN count(a) AS total",
                **base_params,
            ).single()
            total = count_rec["total"] if count_rec else 0

            rows = session.run(
                f"""
                MATCH (a:Asset)
                WHERE {filter_where}
                RETURN a AS node
                ORDER BY a.{order_field} {order_dir}
                SKIP $skip LIMIT $limit
                """,
                **params_plain,
            )
            items = [_asset_node_to_dict(r["node"], None) for r in rows]

    return items, total


def search_materials(
    query_embedding: list[float] | None,
    *,
    categoria_id: str | None = None,
    area_id: str | None = None,
    sort_by: str | None = None,
    sort_type: str = "DESC",
    page: int = 1,
    page_size: int = 10,
) -> tuple[list[dict[str, Any]], int]:
    """
    Search Material nodes in Neo4j.

    Same design rule as search_assets: `q` re-ranks but never filters.
    """
    driver = get_driver()
    skip = (page - 1) * page_size

    base_params: dict[str, Any] = {"categoriaId": categoria_id, "areaId": area_id}
    filter_where = (
        "($categoriaId IS NULL OR m.categoriaId = $categoriaId)"
        " AND ($areaId IS NULL OR m.areaId = $areaId)"
    )

    if query_embedding is not None:
        # ── Semantic re-rank ─────────────────────────────────────────────
        with driver.session() as session:
            all_rows = list(session.run(
                f"MATCH (m:Material) WHERE {filter_where} RETURN m AS node",
                **base_params,
            ))

        total = len(all_rows)

        # Cold-start guard
        if total == 0 and not any([categoria_id, area_id]):
            with driver.session() as session:
                seed_rec = session.run(
                    "MATCH (m:Material) RETURN count(m) AS c"
                ).single()
                if (seed_rec is None or seed_rec["c"] == 0):
                    raise RuntimeError(
                        "Neo4j Material index is empty — not yet seeded from Postgres"
                    )

        scored = [
            (r["node"], _cosine_similarity(query_embedding, r["node"].get("embedding")))
            for r in all_rows
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        page_slice = scored[skip: skip + page_size]
        items = [_material_node_to_dict(node, score) for node, score in page_slice]
    else:
        # ── Plain filter + sort in Cypher ────────────────────────────────
        order_field = _material_order_field(sort_by)
        order_dir = "ASC" if (sort_type or "DESC").upper() == "ASC" else "DESC"
        params_plain = {**base_params, "skip": skip, "limit": page_size}

        with driver.session() as session:
            count_rec = session.run(
                f"MATCH (m:Material) WHERE {filter_where} RETURN count(m) AS total",
                **base_params,
            ).single()
            total = count_rec["total"] if count_rec else 0

            rows = session.run(
                f"""
                MATCH (m:Material)
                WHERE {filter_where}
                RETURN m AS node
                ORDER BY m.{order_field} {order_dir}
                SKIP $skip LIMIT $limit
                """,
                **params_plain,
            )
            items = [_material_node_to_dict(r["node"], None) for r in rows]

    return items, total


def _asset_order_field(sort_by: str | None) -> str:
    mapping = {
        "codigo": "codigo",
        "nombre": "nombre",
        "categoria": "categoriaNombre",
        "ubicacion": "ubicacionNombre",
        "responsable": "responsableNombre",
        "estado": "estado",
        "creadoEn": "creadoEn",
    }
    return mapping.get(sort_by or "", "creadoEn")


def _material_order_field(sort_by: str | None) -> str:
    mapping = {
        "codigo": "codigo",
        "nombre": "nombre",
        "creadoEn": "creadoEn",
    }
    return mapping.get(sort_by or "", "creadoEn")


# ── Diff-based sync helpers ───────────────────────────────────────────────────

def get_missing_ids(ids: list[str], node_label: str) -> list[str]:
    """
    Given a list of IDs, return those that are NOT present in Neo4j.

    node_label must be either "Asset" or "Material".
    Queries are batched in chunks of 1 000 to stay within Cypher list limits.
    """
    if node_label not in ("Asset", "Material"):
        raise ValueError(f"Invalid node_label: {node_label}")
    if not ids:
        return []

    driver = get_driver()
    chunk_size = 1_000
    existing: set[str] = set()

    with driver.session() as session:
        for i in range(0, len(ids), chunk_size):
            chunk = ids[i : i + chunk_size]
            result = session.run(
                f"MATCH (n:{node_label}) WHERE n.id IN $ids RETURN n.id AS id",
                ids=chunk,
            )
            for record in result:
                existing.add(record["id"])

    return [id_ for id_ in ids if id_ not in existing]
