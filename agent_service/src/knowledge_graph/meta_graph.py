"""
Meta-Graph Manager
==================
Manages a "graph of graphs": each sub-graph (context) is a node in the
meta-graph, and context-shifting / embedding operators create edges between
them.  Uses NetworkX for in-memory graph traversal; persistence is delegated
to Neo4jGraphStore.
"""
from __future__ import annotations

import logging
from typing import Any

import networkx as nx

from .neo4j_store import Neo4jGraphStore
from .schemas import (
    GraphContext,
    GraphContextType,
    GraphNode,
    GraphEdge,
    NodeType,
    EdgeType,
)

logger = logging.getLogger(__name__)


class MetaGraph:
    """
    Maintains a directed graph where each node represents a sub-graph
    (GraphContext) and edges represent relationships between contexts.

    Responsibilities:
      - Track which contexts exist
      - Apply SHIFT_CTX / EMBED_CTX DSL operators
      - Query: reachable contexts, shortest context path, neighbours
    """

    def __init__(self, store: Neo4jGraphStore) -> None:
        self._store = store
        self._g: nx.DiGraph = nx.DiGraph()
        self._load_from_db()

    # ── Initialisation ────────────────────────────────────────────────────────

    def _load_from_db(self) -> None:
        contexts = self._store.list_contexts()
        for ctx in contexts:
            self._g.add_node(ctx.name, **ctx.model_dump())
            if ctx.parent_context:
                self._g.add_edge(ctx.parent_context, ctx.name, type="contains")

    # ── Context management ────────────────────────────────────────────────────

    def ensure_context(
        self,
        name: str,
        ctx_type: GraphContextType = GraphContextType.CUSTOM,
        description: str = "",
        parent: str | None = None,
    ) -> GraphContext:
        if name in self._g:
            return GraphContext(**self._g.nodes[name])

        ctx = GraphContext(
            name=name,
            type=ctx_type,
            description=description,
            parent_context=parent,
        )
        self._store.upsert_context(ctx)
        self._g.add_node(name, **ctx.model_dump())
        if parent and parent in self._g:
            self._g.add_edge(parent, name, type="contains")
        return ctx

    def link_contexts(self, source: str, target: str, link_type: str = "meta_link") -> None:
        """Add a directed edge between two contexts in the meta-graph."""
        for name in (source, target):
            if name not in self._g:
                self.ensure_context(name)
        self._g.add_edge(source, target, type=link_type)

        # Persist edge in graph_store as a CONTEXT node edge
        src_node = self._get_or_create_context_node(source)
        tgt_node = self._get_or_create_context_node(target)
        edge = Neo4jGraphStore.new_edge(src_node.id, tgt_node.id, EdgeType.META_LINK, {"link_type": link_type})
        self._store.upsert_edge(edge)

    # ── Queries ───────────────────────────────────────────────────────────────

    def reachable_contexts(self, start: str) -> list[str]:
        """Return all context names reachable from *start* (DFS)."""
        if start not in self._g:
            return []
        return list(nx.dfs_preorder_nodes(self._g, start))

    def shortest_path(self, source: str, target: str) -> list[str]:
        """Return shortest context path between two contexts."""
        try:
            return nx.shortest_path(self._g, source, target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def context_neighbours(self, name: str) -> list[str]:
        """Return direct successors of context *name*."""
        if name not in self._g:
            return []
        return list(self._g.successors(name))

    def all_contexts(self) -> list[str]:
        return list(self._g.nodes)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get_or_create_context_node(self, ctx_name: str) -> GraphNode:
        """Get or create a CONTEXT node for meta-graph edges."""
        # Query Neo4j for existing context node
        with self._store.driver.session() as session:
            result = session.run(
                """
                MATCH (n:GraphNode {type: 'context', label: $label})
                RETURN n.id LIMIT 1
                """,
                label=ctx_name,
            )
            record = result.single()
            if record:
                node = self._store.get_node(record[0])
                if node:
                    return node

        # Create new context node
        node = Neo4jGraphStore.new_node(
            NodeType.CONTEXT,
            label=ctx_name,
            context="meta",
            properties={"context_name": ctx_name},
        )
        self._store.upsert_node(node)
        return node
