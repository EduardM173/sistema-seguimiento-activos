"""
Observability for the GraphRAG agent pipeline.

Uses LlamaIndex's built-in instrumentation (dispatcher / event-handler / span-
handler) to capture **every** agent step, tool call, LLM request/response, and
retrieval operation.  The old ``log_event`` / ``get_recent_events`` API is kept
for backwards compatibility, and the LlamaIndex handler writes into the same
buffer so both custom events and framework events are queryable from a single
endpoint.
"""
from __future__ import annotations

import inspect
import logging
import textwrap
from collections import deque
from datetime import datetime
from threading import Lock
from typing import Any, Optional

from llama_index.core.instrumentation import get_dispatcher
from llama_index.core.instrumentation.event_handlers import BaseEventHandler
from llama_index.core.instrumentation.span_handlers import BaseSpanHandler
from llama_index.core.instrumentation.events.agent import (
    AgentRunStepStartEvent,
    AgentRunStepEndEvent,
    AgentToolCallEvent,
)
from llama_index.core.instrumentation.events.llm import (
    LLMChatStartEvent,
    LLMChatEndEvent,
    LLMCompletionStartEvent,
    LLMCompletionEndEvent,
)

logger = logging.getLogger(__name__)

# ── Shared in-memory buffer ──────────────────────────────────────────────────

_MAX_EVENTS = 6000
_events: deque[dict[str, Any]] = deque(maxlen=_MAX_EVENTS)
_lock = Lock()

# Keeps track of which session_id is active *per-span*.  The agent sets this
# before calling ``_agent.run()``, so every child span/event inherits it.
_active_session_id: str | None = None


def set_active_session(session_id: str | None) -> None:
    """Set the session id that subsequent LlamaIndex events will be tagged with."""
    global _active_session_id
    _active_session_id = session_id


def log_event(event_type: str, payload: dict[str, Any] | None = None) -> None:
    """Append an audit event to in-memory buffer (legacy + custom events)."""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "payload": payload or {},
    }
    with _lock:
        _events.append(event)


def get_recent_events(
    limit: int = 200,
    event_type: str | None = None,
    session_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return recent events, optionally filtered by event type or session."""
    with _lock:
        items = list(_events)

    if event_type:
        items = [e for e in items if e.get("event_type", "").startswith(event_type)]

    if session_id:
        items = [
            e for e in items
            if isinstance(e.get("payload"), dict)
            and e["payload"].get("session_id") == session_id
        ]

    if limit <= 0:
        return []
    return items[-limit:]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_str(obj: Any, max_len: int = 600) -> str:
    """Best-effort serialise *obj* to a bounded string."""
    try:
        text = str(obj)
    except Exception:
        text = repr(obj)
    if len(text) > max_len:
        return text[:max_len] + "…"
    return text


def _chat_messages_preview(messages: list[Any], max_msgs: int = 4) -> list[dict[str, str]]:
    """Summarise a list of ChatMessage objects for the audit payload."""
    out: list[dict[str, str]] = []
    for m in messages[-max_msgs:]:
        role = getattr(m, "role", "unknown")
        content = getattr(m, "content", None) or ""
        out.append({"role": str(role), "content": _safe_str(content, 400)})
    return out


# ── LlamaIndex Event Handler ─────────────────────────────────────────────────

class GraphRAGEventHandler(BaseEventHandler):
    """Captures LlamaIndex framework events into the shared audit buffer."""

    @classmethod
    def class_name(cls) -> str:
        return "GraphRAGEventHandler"

    def handle(self, event: Any, **kwargs: Any) -> None:
        """Dispatch on event type."""
        try:
            self._handle_inner(event)
        except Exception:
            logger.debug("Telemetry handler error", exc_info=True)

    # -- internal dispatch --------------------------------------------------

    def _handle_inner(self, event: Any) -> None:  # noqa: C901
        sid = _active_session_id

        # ── Agent step start ─────────────────────────────────────────────
        if isinstance(event, AgentRunStepStartEvent):
            log_event("li.agent.step.start", {
                "session_id": sid,
                "task_id": event.task_id,
                "input": _safe_str(event.input, 500),
                "step_preview": _safe_str(event.step, 300),
            })
            return

        # ── Agent step end ───────────────────────────────────────────────
        if isinstance(event, AgentRunStepEndEvent):
            step_out = event.step_output
            # ReAct step output has .output, .is_last, .response etc.
            payload: dict[str, Any] = {"session_id": sid}
            if hasattr(step_out, "output"):
                payload["output"] = _safe_str(step_out.output, 600)
            if hasattr(step_out, "is_last"):
                payload["is_last"] = step_out.is_last
            # Capture the agent's internal "thought" if present
            if hasattr(step_out, "response") and step_out.response is not None:
                payload["thought"] = _safe_str(step_out.response, 500)
            log_event("li.agent.step.end", payload)
            return

        # ── Agent tool call ──────────────────────────────────────────────
        if isinstance(event, AgentToolCallEvent):
            tool_meta = event.tool
            log_event("li.agent.tool_call", {
                "session_id": sid,
                "tool_name": tool_meta.name if tool_meta else "unknown",
                "tool_description": _safe_str(
                    tool_meta.description if tool_meta else "", 200
                ),
                "arguments": _safe_str(event.arguments, 500),
            })
            return

        # ── LLM chat start ──────────────────────────────────────────────
        if isinstance(event, LLMChatStartEvent):
            log_event("li.llm.chat.start", {
                "session_id": sid,
                "messages": _chat_messages_preview(event.messages),
                "model": event.model_dict.get("model", ""),
            })
            return

        # ── LLM chat end ────────────────────────────────────────────────
        if isinstance(event, LLMChatEndEvent):
            resp = event.response
            content = ""
            tool_calls_info: list[dict[str, Any]] = []
            if resp and resp.message:
                content = _safe_str(resp.message.content or "", 600)
                # Capture function/tool calls embedded in the LLM response
                for tc in getattr(resp.message, "additional_kwargs", {}).get(
                    "tool_calls", []
                ):
                    tool_calls_info.append({
                        "name": tc.get("function", {}).get("name", ""),
                        "arguments": _safe_str(
                            tc.get("function", {}).get("arguments", ""), 300
                        ),
                    })
            log_event("li.llm.chat.end", {
                "session_id": sid,
                "response_content": content,
                "tool_calls": tool_calls_info,
            })
            return

        # ── LLM completion start/end ────────────────────────────────────
        if isinstance(event, LLMCompletionStartEvent):
            log_event("li.llm.completion.start", {
                "session_id": sid,
                "prompt_preview": _safe_str(getattr(event, "prompt", ""), 400),
            })
            return
        if isinstance(event, LLMCompletionEndEvent):
            log_event("li.llm.completion.end", {
                "session_id": sid,
                "response_preview": _safe_str(getattr(event, "response", ""), 400),
            })
            return


# ── LlamaIndex Span Handler ──────────────────────────────────────────────────

class GraphRAGSpanHandler(BaseSpanHandler):
    """Captures span enter/exit to show hierarchical trace."""

    @classmethod
    def class_name(cls) -> str:
        return "GraphRAGSpanHandler"

    def span_enter(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        parent_id: Optional[str] = None,
        tags: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        class_name = type(instance).__name__ if instance else ""
        log_event("li.span.enter", {
            "session_id": _active_session_id,
            "span_id": id_,
            "parent_span_id": parent_id,
            "class": class_name,
            "tags": tags or {},
        })

    def span_exit(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        result: Optional[Any] = None,
        **kwargs: Any,
    ) -> None:
        log_event("li.span.exit", {
            "session_id": _active_session_id,
            "span_id": id_,
            "result_preview": _safe_str(result, 300),
        })

    def span_drop(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        err: Optional[BaseException] = None,
        **kwargs: Any,
    ) -> None:
        log_event("li.span.drop", {
            "session_id": _active_session_id,
            "span_id": id_,
            "error": str(err) if err else None,
        })

    def new_span(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        parent_span_id: Optional[str] = None,
        tags: Optional[dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Optional[str]:
        return id_

    def prepare_to_exit_span(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        result: Optional[Any] = None,
        **kwargs: Any,
    ) -> Optional[str]:
        return id_

    def prepare_to_drop_span(
        self,
        id_: str,
        bound_args: inspect.BoundArguments,
        instance: Optional[Any] = None,
        err: Optional[BaseException] = None,
        **kwargs: Any,
    ) -> Optional[str]:
        return id_


# ── Registration ──────────────────────────────────────────────────────────────

_registered = False


def register_instrumentation() -> None:
    """Register the event and span handlers with LlamaIndex's root dispatcher.

    Safe to call multiple times — will only register once.
    """
    global _registered
    if _registered:
        return
    _registered = True

    dispatcher = get_dispatcher()
    dispatcher.add_event_handler(GraphRAGEventHandler())
    dispatcher.add_span_handler(GraphRAGSpanHandler())
    logger.info("LlamaIndex instrumentation handlers registered")

