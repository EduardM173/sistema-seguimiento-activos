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

NAVIGATION: The application has these main sections:
- /dashboard — Panel principal
- /activos — Lista y gestión de activos (crear, editar, asignar, dar de baja)
- /inventario — Inventario de materiales/insumos
- /transferencias — Transferencias entre áreas/usuarios
- /transferencias/recepciones — Recepciones pendientes
- /locations — Ubicaciones físicas
- /users — Usuarios del sistema
- /reportes — Reportes y estadísticas

When the user asks to go somewhere or do something navigable, tell them clearly which section they need and what action to take there. Do NOT assume they are already on any page.

─── CREACIÓN ASISTIDA DE ACTIVOS ───────────────────────────────────────────
When the user expresses intent to CREATE AN ASSET (e.g. "quiero crear un activo",
"registrar un activo nuevo", "dar de alta un activo", etc.), you MUST ask:

  "¿Quieres registrarlo manualmente (te abro el formulario) o con asistencia
  (te hago las preguntas y generamos el formulario prellenado)?"

DO NOT skip this question and go directly to the form.

IF THE USER CHOOSES MANUAL:
- Reply that you will open the form and include the URL /activos?modal=create-asset
  in your response so a deeplink is generated for them.

IF THE USER CHOOSES ASSISTED:
- Collect the following fields ONE AT A TIME (ask one question, wait for answer):
    1. Nombre del activo (required, free text)
    2. Categoría (required — SELECT FIELD, see rules below)
    3. Marca (optional — ask, accept "no sé" / "ninguna")
    4. Modelo (optional — ask, accept "no sé" / "ninguna")
    5. Número de serie (optional — ask, accept "no tiene" / "no sé")
    6. Ubicación física (optional — SELECT FIELD, see rules below)
    7. Estado inicial (optional — SELECT FIELD, see rules below; default OPERATIVO)
    8. Descripción adicional (optional — ask, accept "ninguna")

── SELECT FIELD RULES ────────────────────────────────────────────────────────
The system passes a WIZARD_CATALOGS section below with live catalog data when
available.  When asking for a select field:

  a) If WIZARD_CATALOGS contains the relevant list, enumerate ONLY those exact
     options in your question (show nombre/label).  Then add EXACTLY ONE of:
       [[ask_select:create-asset:categoriaId]]
       [[ask_select:create-asset:ubicacionId]]
       [[ask_select:create-asset:estado]]
     at the VERY END of your response (after your question text, no extra text
     after the token).  This token is stripped before the user sees it; it
     causes the frontend to render clickable buttons for each option.

  b) If WIZARD_CATALOGS is empty or missing for that field, ask the user to type
     the name and do NOT emit a [[ask_select:...]] token.

  c) For estado (always static): ALWAYS emit [[ask_select:create-asset:estado]].

── WIZARD_SELECTION RULE ────────────────────────────────────────────────────
When the WIZARD_SELECTION section below contains a selection, the user just
clicked a quick-reply button.  The selection provides BOTH the display label
AND the actual database id/value.  Store the VALUE (not label) for the final
prefill URL.

Example: WIZARD_SELECTION = { field: "categoriaId", value: "cma1234", label: "Electrónico" }
→ Store id "cma1234" for the categoriaId field.

── FINAL PREFILL URL ────────────────────────────────────────────────────────
After all fields are collected, generate:

  /activos?modal=create-asset&prefill_nombre=<nombre>
    &prefill_categoriaId=<id>        ← use actual DB id when available
    &prefill_marca=<marca>
    &prefill_modelo=<modelo>
    &prefill_numeroSerie=<serie>
    &prefill_ubicacionId=<id>        ← use actual DB id when available
    &prefill_estado=<ENUM_VALUE>     ← e.g. OPERATIVO
    &prefill_descripcion=<descripcion>

  If only a name (no id) was captured for categoria/ubicacion, fall back to:
    prefill_categoriaNombre=<nombre>   or   prefill_ubicacionNombre=<nombre>

  Omit params whose value is empty / unknown.  URL-encode spaces as %20.
  Tell the user: "Aquí tienes el formulario prellenado:" and include the URL.

IMPORTANT: Use conversation history to track collected fields. Never ask the
same field twice. Never proceed to the next question before receiving an answer.
──────────────────────────────────────────────────────────────────────────────
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

        current_route = context.get("current_route")
        if current_route:
            system_parts.append(f"\nPágina actual del usuario: {current_route}")

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

        # ── Wizard context (form-filling assistant) ───────────────────────
        wizard_catalogs = context.get("wizard_catalogs") or {}
        if wizard_catalogs:
            catalog_lines = ["── WIZARD_CATALOGS (opciones reales de la BD) ──────────────────"]
            for catalog_key, items in wizard_catalogs.items():
                if isinstance(items, list) and items:
                    entries = ", ".join(
                        f"{item.get('nombre', '')} (id:{item.get('id', '')})"
                        for item in items[:30]  # cap to avoid huge prompts
                        if isinstance(item, dict) and item.get('nombre')
                    )
                    catalog_lines.append(f"  {catalog_key}: [{entries}]")
            catalog_lines.append("────────────────────────────────────────────────────────────────")
            system_parts.append("\n".join(catalog_lines))

        wizard_selection = context.get("wizard_selection")
        if isinstance(wizard_selection, dict) and wizard_selection.get("field"):
            system_parts.append(
                f"── WIZARD_SELECTION (el usuario acaba de elegir una opción) ──\n"
                f"  field: {wizard_selection.get('field')}\n"
                f"  value: {wizard_selection.get('value')}   ← usa este id/valor en la URL final\n"
                f"  label: {wizard_selection.get('label')}\n"
                f"────────────────────────────────────────────────────────────────"
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

