"""
Chat Reasoning Agent
====================
RAG-enabled conversational agent backed by Google GenAI (Gemini) and Neo4j
PropertyGraph retrieval.  No Z3 / DSL layer — pure knowledge retrieval + LLM.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

from llama_index.core.llms import LLM, ChatMessage, MessageRole

from .property_graphs import BusinessDomainGraph
from ..telemetry import log_event, set_active_session

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ChatReasoningResult:
    """Result from processing a chat message."""
    answer: str
    proof_trace: list[str] = field(default_factory=list)
    facts_used: list[str] = field(default_factory=list)
    conjectures_made: list[str] = field(default_factory=list)
    z3_validations: list[dict[str, Any]] = field(default_factory=list)
    new_facts: list[dict[str, Any]] = field(default_factory=list)
    retrieved_rag_nodes: list[dict[str, Any]] = field(default_factory=list)
    is_conjecture: bool = False
    dsl_conclusion: str = ""
    status: str = "success"


# ─────────────────────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a helpful assistant for an asset-tracking system (sistema de seguimiento de activos).
Answer the user's questions in their language (usually Spanish).
Be concise and direct. When relevant knowledge is provided below, use it to answer accurately.
When no knowledge is provided, answer from general context or say you don't have that information.
Never mention that you searched a database or knowledge graph.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Agent class
# ─────────────────────────────────────────────────────────────────────────────

class ChatReasoningAgent:
    """
    Conversational agent for asset-tracking questions.

    Uses a single Neo4j PropertyGraph retrieval tool backed by BusinessDomainGraph.
    No Z3, no DSL — just RAG + LLM.
    """

    def __init__(
        self,
        llm: LLM,
        domain_graph: BusinessDomainGraph,
    ) -> None:
        self._llm = llm
        self._domain_graph = domain_graph
        logger.info("ChatReasoningAgent initialized (RAG-only, no Z3/DSL)")

    # ─────────────────────────────────────────────────────────────────────────
    # Public entry point
    # ─────────────────────────────────────────────────────────────────────────

    async def process_chat_message(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        allow_conjectures: bool = True,
    ) -> ChatReasoningResult:
        """Process a user message using RAG + single LLM call (no ReAct loop)."""
        ctx = context or {}
        session_id = ctx.get("session_id")
        set_active_session(session_id)

        log_event("chat.agent.process.started", {
            "session_id": session_id,
            "message_preview": message[:300],
        })

        retrieved_nodes: list[dict[str, Any]] = []

        try:
            # ── 1. Retrieve relevant knowledge ────────────────────────────
            raw_results = await self._domain_graph.aretrieve(message, top_k=8)
            for r in raw_results:
                retrieved_nodes.append({
                    "node_id": r.get("id", ""),
                    "text": (r.get("text", "") or "")[:300],
                    "score": r.get("score", 0.0),
                    "metadata": r.get("metadata", {}),
                })

            # ── 2. Build messages for a single LLM call ───────────────────
            messages = self._build_messages(message, ctx, retrieved_nodes)

            # ── 3. Single LLM call ────────────────────────────────────────
            llm_response = await self._llm.achat(messages)
            answer = (llm_response.message.content or "").strip()

            log_event("chat.agent.process.completed", {
                "session_id": session_id,
                "rag_nodes_retrieved": len(retrieved_nodes),
            })

            return ChatReasoningResult(
                answer=answer,
                retrieved_rag_nodes=retrieved_nodes,
                status="success",
            )

        except Exception as e:
            logger.exception("Error processing chat message (session=%s)", session_id)
            log_event("chat.agent.process.failed", {"session_id": session_id, "error": str(e)})
            return ChatReasoningResult(
                answer=f"Lo siento, ocurrió un error al procesar tu mensaje: {e}",
                proof_trace=[f"ERROR: {e}"],
                status="error",
            )
        finally:
            set_active_session(None)

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _build_messages(
        self,
        message: str,
        context: dict[str, Any],
        retrieved_nodes: list[dict[str, Any]],
    ) -> list[ChatMessage]:
        """Build the message list for a single LLM achat() call."""
        # System prompt + retrieved knowledge
        system_parts = [CHAT_SYSTEM_PROMPT]
        if retrieved_nodes:
            system_parts.append("\n--- INFORMACIÓN RELEVANTE DEL SISTEMA ---")
            for i, r in enumerate(retrieved_nodes, 1):
                text = r.get("text", "").strip()
                if text:
                    system_parts.append(f"{i}. {text}")
            system_parts.append("--- FIN DE LA INFORMACIÓN ---")

        user_state = context.get("user_state") or {}
        if user_state:
            system_parts.append(
                f"\nEstado actual del usuario: {json.dumps(user_state, ensure_ascii=False)}"
            )

        messages: list[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content="\n".join(system_parts))
        ]

        # Inject last 6 conversation turns
        hist = context.get("conversation_history") or []
        for msg in hist[-6:]:
            role_val = getattr(msg, "role", None)
            if hasattr(role_val, "value"):
                role_val = role_val.value
            role = MessageRole.ASSISTANT if role_val == "assistant" else MessageRole.USER
            content = getattr(msg, "content", "") or ""
            messages.append(ChatMessage(role=role, content=content))

        messages.append(ChatMessage(role=MessageRole.USER, content=message))
        return messages

