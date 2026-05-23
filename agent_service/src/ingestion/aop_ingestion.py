"""
Workflow B — Direct AOP Ingestion
==================================
Accepts DSL source text directly from the user and ingests it
into the knowledge graph and vector store.
"""
from __future__ import annotations

import logging
from typing import Any

from ..dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from ..knowledge_graph import Neo4jGraphStore, MetaGraph, GraphContextType, NodeType
from ..knowledge_graph.schemas import GraphContext
from ..pipeline.knowledge_registrar import KnowledgeRegistrar, RegistrationRequest

logger = logging.getLogger(__name__)


class AOPIngestionWorkflow:
    """
    Ingests user-provided AOP / DSL source text.

    The text is parsed, evaluated, and persisted in the knowledge graph.
    It is also indexed in the PGVector store so it can be retrieved later.
    """

    def __init__(
        self,
        store: Neo4jGraphStore,
        meta_graph: MetaGraph,
        pipeline: Any,
        context_name: str = "procedures",
        registrar: KnowledgeRegistrar | None = None,
    ) -> None:
        self._store = store
        self._meta_graph = meta_graph
        self._pipeline = pipeline
        self._context_name = context_name
        self._registrar = registrar
        self._dsl_parser = DSLParser()
        self._dsl_evaluator = DSLEvaluator()
        self._translator = DSLTranslator()

        self._meta_graph.ensure_context(
            context_name,
            GraphContextType.PROCEDURES,
            "User-provided AOP / DSL procedures",
        )

    def _get_registrar(self) -> KnowledgeRegistrar:
        if self._registrar is not None:
            return self._registrar
        from ..api.dependencies import get_knowledge_registrar
        return get_knowledge_registrar()

    def ingest(self, dsl_source: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Parse and ingest *dsl_source* (DSL text).

        Returns a summary with counts of axioms, rules, and procedures ingested.
        """
        meta = metadata or {}
        results: dict[str, Any] = {
            "axioms": 0, "rules": 0, "procedures": 0, "vector_nodes": 0, "errors": []
        }

        try:
            ast_nodes = self._dsl_parser.parse(dsl_source)
        except Exception as exc:
            logger.error("AOP DSL parse error: %s", exc)
            results["errors"].append(str(exc))
            return results

        ctx = EvaluationContext()
        self._dsl_evaluator.evaluate(ast_nodes, ctx)

        registrar = self._get_registrar()
        source = meta.get("source", "aop_direct")

        for name, axiom_expr in ctx.axioms.items():
            dsl_text = self._translator.to_dsl(axiom_expr)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.AXIOM,
                context=self._context_name,
                label=name,
                source=source,
                origin="user_provided",
                extra_properties=meta,
            ))
            if reg.success:
                results["axioms"] += 1

        for name, rule in ctx.rules.items():
            dsl_text = self._translator.to_dsl(rule)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.RULE,
                context=self._context_name,
                label=name,
                source=source,
                origin="user_provided",
                extra_properties=meta,
            ))
            if reg.success:
                results["rules"] += 1

        for name, proc in ctx.procedures.items():
            dsl_text = self._translator.to_dsl(proc)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.PROCEDURE,
                context=self._context_name,
                label=name,
                source=source,
                origin="user_provided",
                extra_properties=meta,
            ))
            if reg.success:
                results["procedures"] += 1

        # Also index the raw DSL block as a unit for full-text retrieval.
        vector_count = self._pipeline.ingest_text(
            dsl_source,
            metadata={"context": self._context_name, "type": "aop_dsl", **meta},
        )
        results["vector_nodes"] = vector_count

        logger.info(
            "AOP ingestion complete: %d axioms, %d rules, %d procedures, %d vector nodes",
            results["axioms"], results["rules"], results["procedures"], results["vector_nodes"],
        )
        return results
