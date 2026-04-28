"""
Tests for the knowledge graph module (schemas, graph store, meta-graph).
Uses SQLite for lightweight testing (no live PostgreSQL required).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from src.knowledge_graph.schemas import (
    GraphContextType, NodeType, EdgeType,
    GraphNode, GraphEdge, GraphContext,
)
from src.knowledge_graph.graph_store import GraphStore
from src.knowledge_graph.meta_graph import MetaGraph


# ── Schema tests ──────────────────────────────────────────────────────────────

class TestSchemas:

    def test_graph_node_creation(self):
        node = GraphNode(
            id=str(uuid.uuid4()),
            type=NodeType.AXIOM,
            label="TestAxiom",
            context="default",
        )
        assert node.type == NodeType.AXIOM
        assert node.label == "TestAxiom"
        assert node.properties == {}

    def test_graph_edge_creation(self):
        edge = GraphEdge(
            id=str(uuid.uuid4()),
            source_id="src",
            target_id="tgt",
            type=EdgeType.RELATED_TO,
        )
        assert edge.type == EdgeType.RELATED_TO

    def test_graph_context_creation(self):
        ctx = GraphContext(
            name="test_ctx",
            type=GraphContextType.PROCEDURES,
            description="Test context",
        )
        assert ctx.type == GraphContextType.PROCEDURES
        assert ctx.parent_context is None

    def test_graph_node_new_factory(self):
        node = GraphStore.new_node(
            NodeType.PROCEDURE,
            label="Enroll",
            context="procedures",
            properties={"version": 1},
            dsl_source="PROCEDURE Enroll BEGIN END.",
        )
        assert node.type == NodeType.PROCEDURE
        assert node.dsl_source is not None
        assert "id" in node.model_dump()

    def test_graph_edge_new_factory(self):
        edge = GraphStore.new_edge("a", "b", EdgeType.USES)
        assert edge.source_id == "a"
        assert edge.target_id == "b"
        assert edge.type == EdgeType.USES


# ── Graph store tests (with SQLite) ───────────────────────────────────────────

@pytest.fixture
def sqlite_store(tmp_path):
    """Create a GraphStore backed by an in-memory SQLite database."""
    db_path = tmp_path / "test.db"
    db_url = f"sqlite:///{db_path}"

    # Create tables using SQLite-compatible DDL
    from sqlalchemy import create_engine, text
    engine = create_engine(db_url)
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS graph_contexts (
                name TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                parent_context TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS graph_nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                context TEXT NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                properties TEXT NOT NULL DEFAULT '{}',
                dsl_source TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS graph_edges (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                properties TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()

    store = GraphStore.__new__(GraphStore)
    store._engine = engine
    return store


class TestGraphStore:

    def test_upsert_and_get_context(self, sqlite_store):
        ctx = GraphContext(
            name="test",
            type=GraphContextType.PROCEDURES,
            description="Test",
        )
        sqlite_store.upsert_context(ctx)
        fetched = sqlite_store.get_context("test")
        assert fetched is not None
        assert fetched.name == "test"

    def test_upsert_and_get_node(self, sqlite_store):
        # First ensure a context exists
        ctx = GraphContext(name="default", type=GraphContextType.CUSTOM)
        sqlite_store.upsert_context(ctx)

        node = GraphStore.new_node(NodeType.AXIOM, "Foo", context="default", dsl_source="AXIOM Foo: true.")
        sqlite_store.upsert_node(node)

        fetched = sqlite_store.get_node(node.id)
        assert fetched is not None
        assert fetched.label == "Foo"
        assert fetched.dsl_source == "AXIOM Foo: true."

    def test_get_nonexistent_node(self, sqlite_store):
        result = sqlite_store.get_node("does-not-exist")
        assert result is None

    def test_get_nonexistent_context(self, sqlite_store):
        result = sqlite_store.get_context("nonexistent")
        assert result is None

    def test_upsert_and_get_edges(self, sqlite_store):
        # Ensure context and nodes exist
        ctx = GraphContext(name="default", type=GraphContextType.CUSTOM)
        sqlite_store.upsert_context(ctx)

        node_a = GraphStore.new_node(NodeType.ENTITY, "A", context="default")
        node_b = GraphStore.new_node(NodeType.ENTITY, "B", context="default")
        sqlite_store.upsert_node(node_a)
        sqlite_store.upsert_node(node_b)

        edge = GraphStore.new_edge(node_a.id, node_b.id, EdgeType.USES)
        sqlite_store.upsert_edge(edge)

        edges = sqlite_store.get_edges(source_id=node_a.id)
        assert len(edges) == 1
        assert edges[0].target_id == node_b.id

    def test_get_nodes_by_context(self, sqlite_store):
        ctx = GraphContext(name="procedures", type=GraphContextType.PROCEDURES)
        sqlite_store.upsert_context(ctx)

        for i in range(3):
            node = GraphStore.new_node(NodeType.PROCEDURE, f"Proc{i}", context="procedures")
            sqlite_store.upsert_node(node)

        nodes = sqlite_store.get_nodes_by_context("procedures")
        assert len(nodes) == 3

    def test_list_contexts(self, sqlite_store):
        for name, ctype in [("ctx1", GraphContextType.CUSTOM),
                             ("ctx2", GraphContextType.PROCEDURES)]:
            ctx = GraphContext(name=name, type=ctype)
            sqlite_store.upsert_context(ctx)

        contexts = sqlite_store.list_contexts()
        names = [c.name for c in contexts]
        assert "ctx1" in names
        assert "ctx2" in names

    def test_delete_node(self, sqlite_store):
        ctx = GraphContext(name="default", type=GraphContextType.CUSTOM)
        sqlite_store.upsert_context(ctx)

        node = GraphStore.new_node(NodeType.ENTITY, "ToDelete", context="default")
        sqlite_store.upsert_node(node)
        sqlite_store.delete_node(node.id)

        assert sqlite_store.get_node(node.id) is None


# ── Meta-graph tests ──────────────────────────────────────────────────────────

class TestMetaGraph:

    def test_ensure_context_idempotent(self):
        store = MagicMock()
        store.list_contexts.return_value = []
        store.upsert_context.return_value = None
        mg = MetaGraph.__new__(MetaGraph)
        mg._store = store
        mg._g = __import__("networkx").DiGraph()

        ctx = mg.ensure_context("test", GraphContextType.PROCEDURES, "desc")
        ctx2 = mg.ensure_context("test", GraphContextType.PROCEDURES, "desc")
        assert ctx.name == "test"
        # upsert_context should only be called once (idempotent)
        store.upsert_context.assert_called_once()

    def test_link_contexts(self):
        store = MagicMock()
        store.list_contexts.return_value = []
        store.upsert_context.return_value = None
        store.upsert_node.return_value = None
        store.upsert_edge.return_value = None
        from sqlalchemy import create_engine, text as sql_text
        engine = create_engine("sqlite://")
        with engine.connect() as conn:
            conn.execute(sql_text("""
                CREATE TABLE graph_nodes (
                    id TEXT PRIMARY KEY, type TEXT, label TEXT, context TEXT,
                    properties TEXT DEFAULT '{}', dsl_source TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
        store._engine = engine

        mg = MetaGraph.__new__(MetaGraph)
        mg._store = store
        import networkx as nx
        mg._g = nx.DiGraph()

        mg.ensure_context("ctx_a", GraphContextType.PROCEDURES, "A")
        mg.ensure_context("ctx_b", GraphContextType.JIRA, "B")
        mg.link_contexts("ctx_a", "ctx_b", "meta_link")

        assert "ctx_b" in mg.context_neighbours("ctx_a")

    def test_reachable_contexts(self):
        import networkx as nx
        store = MagicMock()
        store.list_contexts.return_value = []

        mg = MetaGraph.__new__(MetaGraph)
        mg._store = store
        mg._g = nx.DiGraph()
        mg._g.add_nodes_from(["a", "b", "c"])
        mg._g.add_edge("a", "b")
        mg._g.add_edge("b", "c")

        reachable = mg.reachable_contexts("a")
        assert "b" in reachable
        assert "c" in reachable

    def test_shortest_path(self):
        import networkx as nx
        store = MagicMock()
        store.list_contexts.return_value = []

        mg = MetaGraph.__new__(MetaGraph)
        mg._store = store
        mg._g = nx.DiGraph()
        mg._g.add_nodes_from(["a", "b", "c"])
        mg._g.add_edge("a", "b")
        mg._g.add_edge("b", "c")

        path = mg.shortest_path("a", "c")
        assert path == ["a", "b", "c"]

    def test_shortest_path_no_path(self):
        import networkx as nx
        store = MagicMock()
        store.list_contexts.return_value = []

        mg = MetaGraph.__new__(MetaGraph)
        mg._store = store
        mg._g = nx.DiGraph()
        mg._g.add_nodes_from(["x", "y"])

        path = mg.shortest_path("x", "y")
        assert path == []
