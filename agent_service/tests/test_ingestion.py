"""
Tests for ingestion workflows that don't require external services.

AOPIngestionWorkflow and ConversationIngestionWorkflow are tested
with mocked pipeline / store / meta_graph objects.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.ingestion import AOPIngestionWorkflow, ConversationIngestionWorkflow
from src.dsl import DSLTranslator


# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_mock_pipeline():
    pipeline = MagicMock()
    pipeline.ingest_text.return_value = 3
    pipeline.dsl_translator = DSLTranslator(llm=None)
    return pipeline


def make_mock_store():
    store = MagicMock()
    store.upsert_node.return_value = None
    store.upsert_edge.return_value = None
    return store


def make_mock_meta_graph():
    mg = MagicMock()
    mg.ensure_context.return_value = None
    return mg


# ── AOP Ingestion tests ───────────────────────────────────────────────────────

class TestAOPIngestionWorkflow:

    def setup_method(self):
        self.store = make_mock_store()
        self.meta_graph = make_mock_meta_graph()
        self.pipeline = make_mock_pipeline()
        self.workflow = AOPIngestionWorkflow(
            store=self.store,
            meta_graph=self.meta_graph,
            pipeline=self.pipeline,
        )

    def test_ingest_axiom(self):
        dsl = "AXIOM A1: Authenticated(?user)."
        result = self.workflow.ingest(dsl)
        assert result["axioms"] == 1
        assert result["rules"] == 0
        assert result["procedures"] == 0
        assert result["errors"] == []

    def test_ingest_rule(self):
        dsl = "RULE R1: IF HasAccount(?u); THEN Authenticated(?u)."
        result = self.workflow.ingest(dsl)
        assert result["rules"] == 1

    def test_ingest_procedure(self):
        dsl = "PROCEDURE P1 BEGIN STEP s1: DoThing(?x); END."
        result = self.workflow.ingest(dsl)
        assert result["procedures"] == 1

    def test_ingest_multiple(self):
        dsl = """
        AXIOM A1: IsUser(?u).
        RULE R1: IF IsUser(?u); THEN HasAccount(?u).
        PROCEDURE Enroll BEGIN STEP verify: IsUser(?u); END.
        """
        result = self.workflow.ingest(dsl)
        assert result["axioms"] == 1
        assert result["rules"] == 1
        assert result["procedures"] == 1

    def test_ingest_invalid_dsl(self):
        dsl = "THIS IS NOT VALID !!!"
        result = self.workflow.ingest(dsl)
        assert len(result["errors"]) > 0

    def test_upsert_node_called(self):
        dsl = "AXIOM A1: Foo."
        self.workflow.ingest(dsl)
        self.store.upsert_node.assert_called()

    def test_vector_index_called(self):
        dsl = "AXIOM A1: Foo."
        self.workflow.ingest(dsl)
        self.pipeline.ingest_text.assert_called_once()

    def test_metadata_passed(self):
        dsl = "AXIOM A1: Foo."
        meta = {"source": "test_file.dsl"}
        self.workflow.ingest(dsl, metadata=meta)
        call_kwargs = self.pipeline.ingest_text.call_args[1]
        assert "metadata" in call_kwargs
        assert call_kwargs["metadata"]["source"] == "test_file.dsl"


# ── Conversation ingestion tests ──────────────────────────────────────────────

class TestConversationIngestionWorkflow:

    def setup_method(self):
        self.store = make_mock_store()
        self.meta_graph = make_mock_meta_graph()
        self.pipeline = make_mock_pipeline()

        # We need a DSLTranslator with a mocked LLM for from_natural_language
        mock_llm = MagicMock()
        mock_llm.acomplete = AsyncMock(return_value=MagicMock(
            text="PROCEDURE ResolvedFlow BEGIN STEP step1: DoAction(?u); END."
        ))
        self.translator = DSLTranslator(llm=mock_llm)

        self.workflow = ConversationIngestionWorkflow(
            store=self.store,
            meta_graph=self.meta_graph,
            dsl_translator=self.translator,
            pipeline=self.pipeline,
        )

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_resolved_conversation_ingested(self):
        conversation = [
            {"role": "user", "content": "How do I reset my password?"},
            {"role": "agent", "content": "You can reset it via the app settings."},
            {"role": "user", "content": "Thanks, that worked!"},
        ]
        result = self._run(self.workflow.ingest(conversation))
        assert result["ingested"] is True

    def test_unresolved_conversation_skipped(self):
        conversation = [
            {"role": "user", "content": "My transfer failed."},
            {"role": "agent", "content": "Let me check that for you."},
        ]
        result = self._run(self.workflow.ingest(conversation))
        assert result["ingested"] is False
        assert result["reason"] == "not_resolved"

    def test_explicit_resolved_flag(self):
        conversation = [
            {"role": "user", "content": "Some question"},
            {"role": "agent", "content": "Some answer"},
        ]
        result = self._run(self.workflow.ingest(conversation, resolved=True))
        assert result["ingested"] is True

    def test_explicit_unresolved_flag(self):
        conversation = [
            {"role": "user", "content": "Thanks, that worked!"},
        ]
        result = self._run(self.workflow.ingest(conversation, resolved=False))
        assert result["ingested"] is False

    @pytest.mark.parametrize("signal", [
        "thank you", "thanks", "that worked", "issue fixed",
        "problem solved", "perfect", "got it",
    ])
    def test_resolution_signals(self, signal: str):
        conv = [
            {"role": "user", "content": "How do I do X?"},
            {"role": "agent", "content": "Do Y."},
            {"role": "user", "content": f"{signal}, very helpful!"},
        ]
        assert ConversationIngestionWorkflow._detect_resolution(conv) is True

    def test_no_resolution_signal(self):
        conv = [
            {"role": "user", "content": "My issue is still not fixed."},
        ]
        assert ConversationIngestionWorkflow._detect_resolution(conv) is False
