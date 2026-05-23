"""
Workflow C — Conversation / Learned Procedure Ingestion
========================================================
Analyses past conversations with the customer-service agent.
If a conversation appears to have successfully resolved the inquiry
(detected via heuristics or explicit flag), it is:
  1. Translated to a DSL PROCEDURE by the LLM
  2. Indexed in the knowledge graph under the "conversations" context
  3. Indexed in the vector store for future retrieval
"""
from __future__ import annotations

import logging
from typing import Any

from ..dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from ..knowledge_graph import Neo4jGraphStore, MetaGraph, GraphContextType, NodeType
from ..pipeline.knowledge_registrar import KnowledgeRegistrar, RegistrationRequest

logger = logging.getLogger(__name__)

# Simple resolution signals
_SUCCESS_SIGNALS = {
    "resolved", "thank you", "thanks", "that worked", "issue fixed",
    "problem solved", "great, that helped", "perfect", "got it",
}


class ConversationIngestionWorkflow:
    """
    Ingests customer-service conversations as learned procedures.

    A conversation is a list of ``{"role": "user"|"agent", "content": "..."}``
    dicts.  The workflow decides if the conversation was successful and, if so,
    translates it to a DSL PROCEDURE and indexes it.
    """

    def __init__(
        self,
        store: Neo4jGraphStore,
        meta_graph: MetaGraph,
        dsl_translator: DSLTranslator,
        pipeline: Any,
        context_name: str = "conversations",
        registrar: KnowledgeRegistrar | None = None,
    ) -> None:
        self._store = store
        self._meta_graph = meta_graph
        self._translator = dsl_translator
        self._pipeline = pipeline
        self._context_name = context_name
        self._registrar = registrar
        self._dsl_parser = DSLParser()
        self._dsl_evaluator = DSLEvaluator()

        self._meta_graph.ensure_context(
            context_name,
            GraphContextType.CONVERSATIONS,
            "Learned procedures from successful customer conversations",
        )

    def _get_registrar(self) -> KnowledgeRegistrar:
        if self._registrar is not None:
            return self._registrar
        from ..api.dependencies import get_knowledge_registrar
        return get_knowledge_registrar()

    async def ingest(
        self,
        conversation: list[dict[str, str]],
        resolved: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Ingest a *conversation* (list of role/content dicts).

        *resolved* may be explicitly set.  If ``None``, heuristics are applied.
        Returns an ingestion summary.
        """
        meta = metadata or {}

        if resolved is None:
            resolved = self._detect_resolution(conversation)

        if not resolved:
            logger.info("Conversation not resolved — skipping ingestion")
            return {"ingested": False, "reason": "not_resolved"}

        conversation_text = self._format_conversation(conversation)

        dsl_source = await self._translator.from_natural_language(
            conversation_text,
            context_hint="customer service conversation in a banking app",
        )

        try:
            ast_nodes = self._dsl_parser.parse(dsl_source)
        except Exception as exc:
            logger.error("DSL parse error from conversation: %s", exc)
            return {"ingested": False, "reason": str(exc)}

        ctx = EvaluationContext()
        self._dsl_evaluator.evaluate(ast_nodes, ctx)

        persisted = 0
        registrar = self._get_registrar()
        for name, proc in ctx.procedures.items():
            dsl_text = self._translator.to_dsl(proc)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.PROCEDURE,
                context=self._context_name,
                label=name,
                source="conversation",
                origin="rag_derived",
                extra_properties={**meta, "learned_from": "conversation"},
            ))
            if reg.success:
                persisted += 1

        logger.info("Conversation ingested: %d procedures", persisted)
        return {"ingested": True, "procedures": persisted}

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _detect_resolution(conversation: list[dict[str, str]]) -> bool:
        """Heuristic: check last few user messages for success signals."""
        user_messages = [
            m["content"].lower()
            for m in conversation[-6:]
            if m.get("role") == "user"
        ]
        for msg in user_messages:
            for signal in _SUCCESS_SIGNALS:
                if signal in msg:
                    return True
        return False

    @staticmethod
    def _format_conversation(conversation: list[dict[str, str]]) -> str:
        return "\n".join(
            f"{m.get('role', 'unknown').upper()}: {m.get('content', '')}"
            for m in conversation
        )
