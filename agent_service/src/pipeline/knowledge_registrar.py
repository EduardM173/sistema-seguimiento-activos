"""
Unified Knowledge Registrar
============================
Single entry point for registering knowledge into the system, regardless
of origin (chat approval, manual admin input, document ingestion, Jira,
conversation learning).

Every knowledge registration goes through the same pipeline:
  1. DSL parsing & validation
  2. AST decomposition (extract predicates, entities, dependencies)
  3. Rich embedding text generation
  4. Neo4j node creation with proper labels and first-class properties
  5. LlamaIndex PropertyGraphIndex insertion (for semantic retrieval)
  6. RAG vector store indexing (for text-similarity retrieval)
  7. Dependency edge creation
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..knowledge_graph import Neo4jGraphStore, NodeType, EdgeType
from ..knowledge_graph.schemas import GraphNode, GraphEdge
from ..pipeline.rich_embeddings import build_rich_embedding_text

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Registration request & result
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RegistrationRequest:
    """All the information needed to register a knowledge item."""
    dsl_source: str
    node_type: NodeType
    context: str                            # graph context name, e.g. "axioms"
    label: str = ""                         # human-readable label
    source: str = "unknown"                 # origin: "admin_manual", "chat", "document:file.pdf", etc.
    confidence: float = 1.0
    origin: str = "unknown"                 # FactOrigin value: "rag_derived", "ai_conjecture", etc.
    session_id: str | None = None
    description: str = ""
    extra_properties: dict[str, Any] = field(default_factory=dict)
    # For theorems/derived facts
    z3_validated: bool = False
    z3_proof_trace: list[str] = field(default_factory=list)
    depends_on_facts: list[str] = field(default_factory=list)
    derived_from_rag: list[str] = field(default_factory=list)


@dataclass
class RegistrationResult:
    """Result of a knowledge registration."""
    node_id: str
    success: bool
    neo4j_stored: bool = False
    vector_indexed: bool = False
    embedding_generated: bool = False
    edges_created: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Type → context mapping
# ═══════════════════════════════════════════════════════════════════════════════

_TYPE_TO_CONTEXT = {
    NodeType.AXIOM: "axioms",
    NodeType.FACT: "business_domain",
    NodeType.RULE: "deduction_rules",
    NodeType.THEOREM: "theorems",
    NodeType.PROCEDURE: "business_domain",
    NodeType.ENTITY: "business_domain",
    NodeType.DOCUMENT: "system_entities",
    NodeType.CONVERSATION: "business_domain",
    NodeType.JIRA_TICKET: "business_domain",
}

_TYPE_TO_GRAPH_KEY = {
    NodeType.AXIOM: "axioms",
    NodeType.FACT: "facts",
    NodeType.RULE: "rules",
    NodeType.THEOREM: "theorems",
    NodeType.PROCEDURE: "facts",
    NodeType.ENTITY: "facts",
    NodeType.DOCUMENT: "facts",
    NodeType.CONVERSATION: "facts",
    NodeType.JIRA_TICKET: "facts",
}


class KnowledgeRegistrar:
    """
    Unified registration pipeline for all knowledge entering the system.

    Usage::

        registrar = KnowledgeRegistrar(
            graph_store=neo4j_store,
            property_graphs={"axioms": ..., "rules": ..., "facts": ..., "theorems": ...},
            rag_pipeline=pipeline,
        )
        result = registrar.register(RegistrationRequest(
            dsl_source="AXIOM user_access: HasRole(?u, \"admin\") IMPLIES FullAccess(?u).",
            node_type=NodeType.AXIOM,
            context="axioms",
            source="admin_manual",
        ))
    """

    def __init__(
        self,
        graph_store: Neo4jGraphStore,
        property_graphs: dict[str, Any] | None = None,
        rag_pipeline: Any | None = None,
    ) -> None:
        self._store = graph_store
        self._property_graphs = property_graphs or {}
        self._rag_pipeline = rag_pipeline

    # ─── Main entry point ────────────────────────────────────────────────

    def register(self, req: RegistrationRequest) -> RegistrationResult:
        """
        Register a knowledge item through the full pipeline.

        Steps:
        1. Parse DSL → AST (best-effort, non-blocking)
        2. Build rich embedding text
        3. Create Neo4j node with proper labels & flattened properties
        4. Insert into LlamaIndex PropertyGraphIndex
        5. Index in RAG vector store
        6. Create dependency edges
        """
        node_id = str(uuid.uuid4())
        result = RegistrationResult(node_id=node_id, success=False)

        context = req.context or _TYPE_TO_CONTEXT.get(req.node_type, "business_domain")
        label = req.label or req.dsl_source[:80]

        # ── 1. Parse DSL (best-effort) ──────────────────────────────────
        ast_node = None
        predicates: list[str] = []
        entities: list[str] = []
        try:
            from ..dsl import DSLParser
            parser = DSLParser()
            nodes = parser.parse(req.dsl_source)
            if nodes:
                ast_node = nodes[0]
                predicates = _extract_predicates(ast_node)
                entities = _extract_entities(ast_node)
        except Exception as e:
            result.warnings.append(f"DSL parse warning: {e}")
            logger.debug("DSL parse issue (non-fatal): %s", e)

        # ── 2. Build rich embedding text ────────────────────────────────
        properties = {
            "dsl_source": req.dsl_source,
            "source": req.source,
            "origin": req.origin,
            "confidence": req.confidence,
            "description": req.description,
            "status": "active",
            "z3_validated": req.z3_validated,
            "created_at": datetime.utcnow().isoformat(),
        }
        if req.session_id:
            properties["session_id"] = req.session_id
        if req.z3_proof_trace:
            properties["z3_proof_trace"] = req.z3_proof_trace
        if predicates:
            properties["predicates"] = predicates
        if entities:
            properties["entities"] = entities
        properties.update(req.extra_properties)

        rich_text = build_rich_embedding_text(
            dsl_source=req.dsl_source,
            node_type=req.node_type.value,
            label=label,
            properties=properties,
            ast_node=ast_node,
        )
        result.embedding_generated = True

        # Back-fill description with the rich embedding text when none was provided,
        # so every node has a searchable natural-language description in Neo4j.
        if not properties.get("description"):
            properties["description"] = rich_text

        # ── 3. Create Neo4j node ────────────────────────────────────────
        try:
            graph_node = GraphNode(
                id=node_id,
                type=req.node_type,
                context=context,
                label=label,
                properties=properties,
                dsl_source=req.dsl_source,
            )
            self._store.upsert_node(graph_node)
            result.neo4j_stored = True
        except Exception as e:
            err = f"Neo4j storage failed: {e}"
            result.errors.append(err)
            logger.error(err)
            return result

        # ── 4. Insert into PropertyGraphIndex ───────────────────────────
        graph_key = _TYPE_TO_GRAPH_KEY.get(req.node_type, "facts")
        pg = self._property_graphs.get(graph_key)
        if pg is not None:
            try:
                from llama_index.core.schema import TextNode
                text_node = TextNode(
                    text=rich_text,
                    id_=node_id,
                    metadata={
                        "type": req.node_type.value,
                        "context": context,
                        "dsl_source": req.dsl_source,
                        "label": label,
                        "source": req.source,
                        "origin": req.origin,
                        "confidence": req.confidence,
                    },
                )
                pg.index.insert_nodes([text_node])
            except Exception as e:
                err_str = str(e)
                # Event-loop conflicts are non-fatal — data is in Neo4j
                loop_conflict = (
                    "attached to a different loop" in err_str
                    or "cannot be called from a running event loop" in err_str
                    or ("got Future" in err_str and "different loop" in err_str)
                )
                if loop_conflict:
                    result.warnings.append(f"PropertyGraphIndex insert deferred (loop conflict)")
                    logger.warning("PropertyGraphIndex insert deferred for %s: %s", node_id, err_str)
                else:
                    result.warnings.append(f"PropertyGraphIndex insert failed: {e}")
                    logger.warning("PropertyGraphIndex insert failed for %s: %s", node_id, e)

        # ── 5. Index in RAG vector store ────────────────────────────────
        if self._rag_pipeline is not None:
            try:
                import asyncio

                _meta = {
                    "source": req.source,
                    "type": req.node_type.value,
                    "context": context,
                    "node_id": node_id,
                    "dsl_source": req.dsl_source,
                }
                try:
                    asyncio.get_running_loop()
                    # We are inside the event loop thread (direct call from async code).
                    # nest_asyncio (applied in main.py) allows the nested run_until_complete
                    # that PGVectorStore uses internally.
                    self._rag_pipeline.ingest_text(rich_text, metadata=_meta)
                except RuntimeError:
                    # No running loop in this thread — we were dispatched via
                    # anyio.to_thread.run_sync().  Bridge back to the main event
                    # loop so the asyncpg pool (created there) is reused correctly.
                    from anyio.from_thread import run as _anyio_run
                    _anyio_run(self._rag_pipeline.aingest_text(rich_text, metadata=_meta))
                result.vector_indexed = True
            except Exception as e:
                result.warnings.append(f"Vector indexing failed: {e}")
                logger.warning("Vector indexing failed for %s: %s", node_id, e)

        # ── 6. Dependency edges ─────────────────────────────────────────
        edges_created = 0
        for dep_id in req.depends_on_facts:
            try:
                edge = Neo4jGraphStore.new_edge(
                    source_id=node_id,
                    target_id=dep_id,
                    edge_type=EdgeType.DERIVED_FROM,
                    properties={"auto_created": True},
                )
                self._store.upsert_edge(edge)
                edges_created += 1
            except Exception as e:
                result.warnings.append(f"Edge creation failed for dep {dep_id}: {e}")
        for rag_id in req.derived_from_rag:
            try:
                edge = Neo4jGraphStore.new_edge(
                    source_id=node_id,
                    target_id=rag_id,
                    edge_type=EdgeType.RELATED_TO,
                    properties={"auto_created": True, "relation": "derived_from_rag"},
                )
                self._store.upsert_edge(edge)
                edges_created += 1
            except Exception as e:
                result.warnings.append(f"Edge creation failed for rag {rag_id}: {e}")
        
        # ── 7. Implied Entity Edges from Explicit Binary Predicates ─────
        # If the DSL contains relations like Teaches("John", "Alice"),
        # we create the Entity nodes and the Teaches edge explicitly in Neo4j.
        if ast_node:
            triples = _extract_binary_relations(ast_node)
            for subj_str, pred_name, obj_str in triples:
                try:
                    # Deterministic ID for entity nodes based on their exact string name
                    # (Slugifying or simple prefixing)
                    subj_prefix = "".join(c for c in subj_str if c.isalnum() or c in ("_", "-"))
                    obj_prefix = "".join(c for c in obj_str if c.isalnum() or c in ("_", "-"))
                    
                    subj_id = f"entity:{subj_prefix.lower()}"
                    obj_id = f"entity:{obj_prefix.lower()}"
                    
                    # Ensure Subject
                    subj_node = Neo4jGraphStore.new_node(
                        node_type=NodeType.ENTITY,
                        label=subj_str,
                        context=context,
                        properties={"source": req.source, "origin": req.origin, "auto_extracted": True}
                    )
                    subj_node.id = subj_id
                    self._store.upsert_node(subj_node)
                    
                    # Ensure Object
                    obj_node = Neo4jGraphStore.new_node(
                        node_type=NodeType.ENTITY,
                        label=obj_str,
                        context=context,
                        properties={"source": req.source, "origin": req.origin, "auto_extracted": True}
                    )
                    obj_node.id = obj_id
                    self._store.upsert_node(obj_node)
                    
                    # Create Edge
                    rel_edge = Neo4jGraphStore.new_edge(
                        source_id=subj_id,
                        target_id=obj_id,
                        edge_type=EdgeType.RELATED_TO,
                        properties={
                            "relation": pred_name,
                            "auto_extracted": True,
                            "source_fact_id": node_id
                        }
                    )
                    self._store.upsert_edge(rel_edge)
                    edges_created += 1
                except Exception as e:
                    result.warnings.append(f"Implied edge creation failed for {pred_name}: {e}")

        result.edges_created = edges_created

        result.success = True
        logger.info(
            "Registered knowledge [%s] %s in context '%s' (neo4j=%s, vector=%s, edges=%d)",
            req.node_type.value, node_id, context,
            result.neo4j_stored, result.vector_indexed, edges_created,
        )
        return result


# ═══════════════════════════════════════════════════════════════════════════════
# AST helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_predicates(node: Any) -> list[str]:
    """Extract predicate names from a parsed AST node."""
    predicates: list[str] = []
    _walk_ast(node, predicates, "predicate")
    return list(set(predicates))


def _extract_entities(node: Any) -> list[str]:
    """Extract entity/literal names from a parsed AST node."""
    entities: list[str] = []
    _walk_ast(node, entities, "entity")
    return list(set(entities))


def _extract_binary_relations(node: Any) -> list[tuple[str, str, str]]:
    """
    Extract explicit binary relations from the AST.
    Looks for PredicateNode(name, [LiteralNode(A), LiteralNode(B)])
    and returns (A, name, B) tuples.
    """
    relations: list[tuple[str, str, str]] = []
    from ..dsl.parser import PredicateNode, LiteralNode, SubstNode

    def _walk_for_triples(n: Any):
        if n is None:
            return
        
        # We also want to pierce Substituted variables.
        # But for simplicity we just look for literal arguments.
        if isinstance(n, PredicateNode):
            if len(n.args) == 2:
                arg1, arg2 = n.args
                # Check if both are literals
                if isinstance(arg1, LiteralNode) and isinstance(arg2, LiteralNode):
                    if isinstance(arg1.value, str) and isinstance(arg2.value, str):
                        relations.append((arg1.value, n.name, arg2.value))
            # Continue checking sub-args just in case (e.g. nested logic)
            for a in n.args:
                _walk_for_triples(a)
        
        # Generic AST walking
        if hasattr(n, "operand"):
            _walk_for_triples(getattr(n, "operand"))
        if hasattr(n, "left"):
            _walk_for_triples(getattr(n, "left"))
        if hasattr(n, "right"):
            _walk_for_triples(getattr(n, "right"))
        if hasattr(n, "body"):
            _walk_for_triples(getattr(n, "body"))
        if hasattr(n, "expr") and not isinstance(n, SubstNode): # Avoid infinite on SubstNode string
            _walk_for_triples(getattr(n, "expr"))
        if hasattr(n, "premises") and isinstance(getattr(n, "premises"), list):
            for p in getattr(n, "premises"):
                _walk_for_triples(p)
        if hasattr(n, "conclusion"):
            _walk_for_triples(getattr(n, "conclusion"))

    _walk_for_triples(node)
    return list(set(relations))


def _walk_ast(node: Any, collector: list[str], mode: str) -> None:
    """Recursively walk an AST node and collect predicates or entities."""
    from ..dsl.parser import (
        PredicateNode, LiteralNode, BinaryOpNode, NotNode,
        QuantifiedNode, AxiomNode, RuleNode, ProcedureNode,
    )

    if node is None:
        return

    if isinstance(node, PredicateNode):
        if mode == "predicate":
            collector.append(node.name)
        for arg in (node.args or []):
            _walk_ast(arg, collector, mode)
    elif isinstance(node, LiteralNode):
        if mode == "entity" and isinstance(node.value, str):
            collector.append(node.value)
    elif isinstance(node, BinaryOpNode):
        _walk_ast(node.left, collector, mode)
        _walk_ast(node.right, collector, mode)
    elif isinstance(node, NotNode):
        _walk_ast(node.operand, collector, mode)
    elif isinstance(node, QuantifiedNode):
        _walk_ast(node.body, collector, mode)
    elif isinstance(node, AxiomNode):
        _walk_ast(node.expr, collector, mode)
    elif isinstance(node, RuleNode):
        for p in (node.premises or []):
            _walk_ast(p, collector, mode)
        _walk_ast(node.conclusion, collector, mode)
    elif isinstance(node, ProcedureNode):
        for step in (node.steps or []):
            _walk_ast(step, collector, mode)
