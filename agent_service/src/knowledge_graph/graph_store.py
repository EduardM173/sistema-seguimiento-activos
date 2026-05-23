"""
PostgreSQL-backed Graph Store
=============================
Uses SQLAlchemy to persist nodes, edges, and contexts.
Integrates with LlamaIndex's PGVectorStore for vector retrieval.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from ..config import settings
from .schemas import GraphNode, GraphEdge, GraphContext, NodeType, EdgeType, GraphContextType

logger = logging.getLogger(__name__)


class GraphStore:
    """
    Persistent graph store backed by PostgreSQL.

    Tables (created by migrations/init.sql):
      - graph_contexts  : sub-graph metadata
      - graph_nodes     : nodes with optional DSL source and JSON properties
      - graph_edges     : directed edges between nodes
    """

    def __init__(self, db_url: str | None = None) -> None:
        url = db_url or settings.postgres_url
        self._engine = create_engine(url, pool_pre_ping=True)

    # ── Contexts ──────────────────────────────────────────────────────────────

    def upsert_context(self, ctx: GraphContext) -> GraphContext:
        with Session(self._engine) as session:
            session.execute(
                text(
                    """
                    INSERT INTO graph_contexts (name, type, description, parent_context, created_at)
                    VALUES (:name, :type, :desc, :parent, :now)
                    ON CONFLICT (name) DO UPDATE
                      SET description = EXCLUDED.description,
                          parent_context = EXCLUDED.parent_context
                    """
                ),
                {
                    "name": ctx.name,
                    "type": ctx.type.value,
                    "desc": ctx.description,
                    "parent": ctx.parent_context,
                    "now": ctx.created_at,
                },
            )
            session.commit()
        return ctx

    def get_context(self, name: str) -> GraphContext | None:
        with Session(self._engine) as session:
            row = session.execute(
                text("SELECT name, type, description, parent_context, created_at FROM graph_contexts WHERE name = :n"),
                {"n": name},
            ).fetchone()
        if row is None:
            return None
        return GraphContext(
            name=row[0],
            type=GraphContextType(row[1]),
            description=row[2],
            parent_context=row[3],
            created_at=row[4],
        )

    def list_contexts(self) -> list[GraphContext]:
        with Session(self._engine) as session:
            rows = session.execute(
                text("SELECT name, type, description, parent_context, created_at FROM graph_contexts ORDER BY name")
            ).fetchall()
        return [
            GraphContext(
                name=r[0],
                type=GraphContextType(r[1]),
                description=r[2],
                parent_context=r[3],
                created_at=r[4],
            )
            for r in rows
        ]

    # ── Nodes ─────────────────────────────────────────────────────────────────

    def upsert_node(self, node: GraphNode) -> GraphNode:
        import json
        with Session(self._engine) as session:
            session.execute(
                text(
                    """
                    INSERT INTO graph_nodes
                      (id, type, context, label, properties, dsl_source, created_at, updated_at)
                    VALUES
                      (:id, :type, :ctx, :label, :props, :dsl, :created, :updated)
                    ON CONFLICT (id) DO UPDATE
                      SET label      = EXCLUDED.label,
                          properties = EXCLUDED.properties,
                          dsl_source = EXCLUDED.dsl_source,
                          updated_at = EXCLUDED.updated_at
                    """
                ),
                {
                    "id": node.id,
                    "type": node.type.value,
                    "ctx": node.context,
                    "label": node.label,
                    "props": json.dumps(node.properties),
                    "dsl": node.dsl_source,
                    "created": node.created_at,
                    "updated": node.updated_at,
                },
            )
            session.commit()
        return node

    def get_node(self, node_id: str) -> GraphNode | None:
        import json
        with Session(self._engine) as session:
            row = session.execute(
                text(
                    "SELECT id, type, context, label, properties, dsl_source, created_at, updated_at "
                    "FROM graph_nodes WHERE id = :id"
                ),
                {"id": node_id},
            ).fetchone()
        if row is None:
            return None
        return GraphNode(
            id=row[0],
            type=NodeType(row[1]),
            context=row[2],
            label=row[3],
            properties=json.loads(row[4]) if row[4] else {},
            dsl_source=row[5],
            created_at=row[6],
            updated_at=row[7],
        )

    def get_nodes_by_context(self, context: str) -> list[GraphNode]:
        import json
        with Session(self._engine) as session:
            rows = session.execute(
                text(
                    "SELECT id, type, context, label, properties, dsl_source, created_at, updated_at "
                    "FROM graph_nodes WHERE context = :ctx ORDER BY created_at"
                ),
                {"ctx": context},
            ).fetchall()
        return [
            GraphNode(
                id=r[0], type=NodeType(r[1]), context=r[2], label=r[3],
                properties=json.loads(r[4]) if r[4] else {}, dsl_source=r[5],
                created_at=r[6], updated_at=r[7],
            )
            for r in rows
        ]

    def delete_node(self, node_id: str) -> None:
        with Session(self._engine) as session:
            session.execute(text("DELETE FROM graph_nodes WHERE id = :id"), {"id": node_id})
            session.commit()

    # ── Edges ─────────────────────────────────────────────────────────────────

    def upsert_edge(self, edge: GraphEdge) -> GraphEdge:
        import json
        with Session(self._engine) as session:
            session.execute(
                text(
                    """
                    INSERT INTO graph_edges (id, source_id, target_id, type, properties, created_at)
                    VALUES (:id, :src, :tgt, :type, :props, :now)
                    ON CONFLICT (id) DO UPDATE
                      SET properties = EXCLUDED.properties
                    """
                ),
                {
                    "id": edge.id,
                    "src": edge.source_id,
                    "tgt": edge.target_id,
                    "type": edge.type.value,
                    "props": json.dumps(edge.properties),
                    "now": edge.created_at,
                },
            )
            session.commit()
        return edge

    def get_edges(self, source_id: str | None = None, target_id: str | None = None) -> list[GraphEdge]:
        import json
        conditions = []
        params: dict[str, Any] = {}
        if source_id is not None:
            conditions.append("source_id = :src")
            params["src"] = source_id
        if target_id is not None:
            conditions.append("target_id = :tgt")
            params["tgt"] = target_id
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        with Session(self._engine) as session:
            rows = session.execute(
                text(f"SELECT id, source_id, target_id, type, properties, created_at FROM graph_edges {where}"),
                params,
            ).fetchall()
        return [
            GraphEdge(
                id=r[0], source_id=r[1], target_id=r[2], type=EdgeType(r[3]),
                properties=json.loads(r[4]) if r[4] else {}, created_at=r[5],
            )
            for r in rows
        ]

    def get_edges_by_source(self, source_id: str) -> list[GraphEdge]:
        """Get all edges originating from a specific node."""
        return self.get_edges(source_id=source_id)

    def get_edges_by_target(self, target_id: str) -> list[GraphEdge]:
        """Get all edges pointing to a specific node."""
        return self.get_edges(target_id=target_id)

    def get_edges_by_context(self, context: str) -> list[GraphEdge]:
        """Get all edges where source or target is in the given context."""
        import json
        with Session(self._engine) as session:
            rows = session.execute(
                text(
                    """
                    SELECT e.id, e.source_id, e.target_id, e.type, e.properties, e.created_at
                    FROM graph_edges e
                    JOIN graph_nodes n ON e.source_id = n.id OR e.target_id = n.id
                    WHERE n.context = :ctx
                    """
                ),
                {"ctx": context},
            ).fetchall()
        return [
            GraphEdge(
                id=r[0], source_id=r[1], target_id=r[2], type=EdgeType(r[3]),
                properties=json.loads(r[4]) if r[4] else {}, created_at=r[5],
            )
            for r in rows
        ]

    def delete_edge(self, edge_id: str) -> None:
        """Delete an edge by ID."""
        with Session(self._engine) as session:
            session.execute(text("DELETE FROM graph_edges WHERE id = :id"), {"id": edge_id})
            session.commit()

    # ── Convenience factory methods ───────────────────────────────────────────

    @staticmethod
    def new_node(
        node_type: NodeType,
        label: str,
        context: str = "default",
        properties: dict[str, Any] | None = None,
        dsl_source: str | None = None,
    ) -> GraphNode:
        now = datetime.utcnow()
        return GraphNode(
            id=str(uuid.uuid4()),
            type=node_type,
            label=label,
            context=context,
            properties=properties or {},
            dsl_source=dsl_source,
            created_at=now,
            updated_at=now,
        )

    @staticmethod
    def new_edge(
        source_id: str,
        target_id: str,
        edge_type: EdgeType,
        properties: dict[str, Any] | None = None,
    ) -> GraphEdge:
        return GraphEdge(
            id=str(uuid.uuid4()),
            source_id=source_id,
            target_id=target_id,
            type=edge_type,
            properties=properties or {},
        )
