"""
Chat routes — RAG-enabled conversational interface with Z3 deduction.

This module provides:
1. Chat session management (create, get, end)
2. Message handling with reasoning agent integration
3. Dynamic Z3 validation of AI conjectures
4. Generation of pending facts for admin review
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ...models.chat import (
    ChatSession,
    ChatSessionStatus,
    ChatMessage,
    MessageRole,
    PendingFact,
    PendingFactType,
    PendingFactStatus,
    FactOrigin,
    ChatSessionWithMessages,
    CreateSessionRequest,
    CreateSessionResponse,
    SendMessageRequest,
    SendMessageResponse,
    EndSessionRequest,
    EndSessionResponse,
    PendingFactSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter()

from ...telemetry import log_event, get_recent_events
from ...persistence.chat_db import (
    persist_session as _db_persist_session,
    persist_message as _db_persist_message,
    list_sessions_from_db as _db_list_sessions,
    get_session_from_db as _db_get_session,
    get_messages_from_db as _db_get_messages,
    persist_pending_fact as _db_persist_pending_fact,
    update_pending_fact_in_db as _db_update_pending_fact,
    list_pending_facts_from_db as _db_list_pending_facts,
    get_pending_fact_from_db as _db_get_pending_fact,
    delete_pending_fact_from_db as _db_delete_pending_fact,
)


# ═══════════════════════════════════════════════════════════════════════════════
# In-memory storage (replace with database in production)
# ═══════════════════════════════════════════════════════════════════════════════

_sessions: dict[str, ChatSession] = {}
_messages: dict[str, list[ChatMessage]] = {}  # session_id -> messages
_pending_facts: dict[str, PendingFact] = {}   # fact_id -> fact
_session_facts: dict[str, list[str]] = {}     # session_id -> fact_ids


# ═══════════════════════════════════════════════════════════════════════════════
# Session restore helper
# ═══════════════════════════════════════════════════════════════════════════════

def _restore_session(session_id: str) -> ChatSession | None:
    """
    Try to restore a session from the DB into the in-memory cache.
    Called whenever session_id is not in _sessions.
    Returns the ChatSession if found in DB, None otherwise.
    """
    row = _db_get_session(session_id)
    if row is None:
        return None

    session = ChatSession(
        id=row["id"],
        status=ChatSessionStatus(row["status"]),
        title=row["title"] or "",
        user_id=row.get("user_id"),
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
        feedback_success=row.get("feedback_success"),
        feedback_rating=row.get("feedback_rating"),
        feedback_comment=row.get("feedback_comment"),
    )
    _sessions[session_id] = session

    # Restore messages from DB
    if session_id not in _messages:
        raw_msgs = _db_get_messages(session_id)
        msgs: list[ChatMessage] = []
        for m in raw_msgs:
            try:
                msgs.append(ChatMessage(
                    id=m["id"],
                    session_id=m["session_id"],
                    role=MessageRole(m["role"]),
                    content=m["content"],
                    reasoning_trace=m.get("reasoning_trace") or [],
                    facts_used=m.get("facts_used") or [],
                    conjectures_made=m.get("conjectures_made") or [],
                    z3_validations=m.get("z3_validations") or [],
                    created_at=m["created_at"],
                ))
            except Exception:
                logger.warning("Could not restore message %s", m.get("id"))
        _messages[session_id] = msgs
        _session_facts[session_id] = []

    logger.info("Restored session %s from DB", session_id)
    return session


# ═══════════════════════════════════════════════════════════════════════════════
# Session Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions", summary="Create a new chat session")
async def create_session(body: CreateSessionRequest) -> CreateSessionResponse:
    """
    Create a new chat session for RAG-enabled conversation.
    
    The session will use the reasoning agent to:
    - Retrieve relevant facts from the knowledge graph
    - Perform Z3 deductions with RAG knowledge
    - Generate AI conjectures when information is insufficient
    - Validate conjectures for consistency with existing knowledge
    """
    session_id = str(uuid4())
    session = ChatSession(
        id=session_id,
        title=body.title or f"Chat Session {session_id[:8]}",
        user_id=body.user_id,
        status=ChatSessionStatus.ACTIVE,
    )
    
    _sessions[session_id] = session
    _messages[session_id] = []
    _session_facts[session_id] = []

    _db_persist_session(session)

    # Add system message with initial context if provided
    if body.initial_context:
        system_msg = ChatMessage(
            id=str(uuid4()),
            session_id=session_id,
            role=MessageRole.SYSTEM,
            content=f"Session initialized with context: {body.initial_context}",
        )
        _messages[session_id].append(system_msg)
        _db_persist_message(system_msg)
    
    logger.info("Created chat session %s", session_id)
    
    return CreateSessionResponse(
        session_id=session_id,
        status=session.status,
        created_at=session.started_at,
    )


@router.get("/sessions/{session_id}", summary="Get chat session details")
async def get_session(session_id: str) -> ChatSessionWithMessages:
    """Get a chat session with all its messages."""
    if session_id not in _sessions:
        if _restore_session(session_id) is None:
            raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    messages = _messages.get(session_id, [])
    
    return ChatSessionWithMessages(
        **session.model_dump(),
        messages=messages,
    )


@router.get("/sessions", summary="List all chat sessions")
async def list_sessions(
    status: ChatSessionStatus | None = None,
    user_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    """List chat sessions with optional filtering (DB-backed)."""
    rows, total = _db_list_sessions(
        status=status.value if status else None,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return {
        "sessions": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Message Handling
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions/{session_id}/messages", summary="Send a message in a chat session")
async def send_message(session_id: str, body: SendMessageRequest) -> SendMessageResponse:
    """
    Send a message and get a response from the reasoning agent.
    
    The agent will:
    1. Retrieve relevant facts from RAG
    2. Attempt Z3-guided deduction with RAG knowledge
    3. If information is insufficient and allow_conjectures=True:
       - Generate AI conjectures
       - Validate conjectures against existing knowledge using Z3
       - Only use validated conjectures in the deduction
    4. Track all facts used and conjectures made
    
    New facts discovered during reasoning are stored as pending facts
    awaiting admin verification before being added to the RAG.
    """
    if session_id not in _sessions:
        if _restore_session(session_id) is None:
            raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    if session.status != ChatSessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Session is not active")

    request_id = str(uuid4())
    log_event("chat.request.started", {
        "session_id": session_id,
        "request_id": request_id,
        "allow_conjectures": body.allow_conjectures,
        "message_preview": body.content[:300],
    })
    
    # Store user message
    user_msg = ChatMessage(
        id=str(uuid4()),
        session_id=session_id,
        role=MessageRole.USER,
        content=body.content,
    )
    _messages[session_id].append(user_msg)
    _db_persist_message(user_msg)
    
    # Fetch the UserStateAgent to update ephemeral conversational state
    from ..dependencies import get_chat_reasoning_agent, get_user_state_agent
    
    try:
        user_state_agent = get_user_state_agent()
        updated_state = await user_state_agent.update_state(
            message=body.content,
            current_state=session.user_state
        )
        session.user_state = updated_state
        _db_persist_session(session)
    except Exception as e:
        logger.warning("Failed to update user state, continuing with old state. Error: %s", e)
        updated_state = session.user_state

    # Create reasoning context
    # We still keep old history locally, but the UserState is the source of truth for identity
    reasoning_context = {
        "session_id": session_id,
        "allow_conjectures": body.allow_conjectures,
        "user_state": updated_state,
        "conversation_history": _messages.get(session_id, []),
        **(body.context or {}),
    }
    
    # Get reasoning agent and process
    try:
        agent = get_chat_reasoning_agent()
        result = await agent.process_chat_message(
            message=body.content,
            context=reasoning_context,
            allow_conjectures=body.allow_conjectures,
        )
    except Exception as e:
        logger.exception("Error processing message in session %s", session_id)
        log_event("chat.request.failed", {
            "session_id": session_id,
            "request_id": request_id,
            "error": str(e),
        })
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        ) from e
    
    # Store assistant response (content is natural language, reasoning is DSL)
    assistant_msg = ChatMessage(
        id=str(uuid4()),
        session_id=session_id,
        role=MessageRole.ASSISTANT,
        content=result.answer,  # Natural language for user
        dsl_conclusion=getattr(result, 'dsl_conclusion', ''),  # DSL conclusion
        reasoning_trace=result.proof_trace,  # DSL proof steps
        facts_used=result.facts_used,  # DSL facts
        conjectures_made=result.conjectures_made,  # DSL conjectures
        z3_validations=result.z3_validations,
    )
    _messages[session_id].append(assistant_msg)
    _db_persist_message(assistant_msg)
    # Store any new facts as pending (all in DSL format)
    new_facts_count = 0
    saved_dsl_sources: set[str] = set()
    for new_fact in result.new_facts:
        # DSL is the primary format - natural_language is optional/derived
        dsl_source = new_fact.get("dsl", "")
        if not dsl_source:
            logger.warning("Skipping fact without DSL: %s", new_fact)
            continue
            
        try:
            fact_type = PendingFactType(new_fact.get("type", "fact"))
        except ValueError:
            logger.warning("Unknown fact type '%s', defaulting to 'fact'", new_fact.get("type"))
            fact_type = PendingFactType.FACT
        try:
            origin = FactOrigin(new_fact.get("origin", "hybrid"))
        except ValueError:
            logger.warning("Unknown origin '%s', defaulting to 'hybrid'", new_fact.get("origin"))
            origin = FactOrigin.HYBRID

        pending = PendingFact(
            id=str(uuid4()),
            session_id=session_id,
            fact_type=fact_type,
            dsl_source=dsl_source,
            natural_language=new_fact.get("description", ""),  # Optional, can be derived later
            origin=origin,
            confidence=new_fact.get("confidence", 0.5),
            z3_validated=new_fact.get("z3_validated", False),
            z3_consistent_with_rag=new_fact.get("z3_consistent", False),
            z3_proof_trace=new_fact.get("z3_trace", []),
            depends_on_facts=new_fact.get("depends_on", []),
            derived_from_rag=new_fact.get("rag_sources", []),
        )
        _pending_facts[pending.id] = pending
        _session_facts[session_id].append(pending.id)
        _db_persist_pending_fact(pending)
        saved_dsl_sources.add(dsl_source.strip().rstrip("."))
        new_facts_count += 1

    # Fallback: convert conjectures not already saved as new_facts into pending facts
    for conjecture_str in result.conjectures_made:
        # Conjectures have format "DSL_STATEMENT // Reasoning: ..."
        dsl_part = conjecture_str.split("//")[0].strip()
        if not dsl_part:
            continue
        # Skip if we already saved this DSL from new_facts
        if dsl_part.rstrip(".") in saved_dsl_sources:
            continue
        pending = PendingFact(
            id=str(uuid4()),
            session_id=session_id,
            fact_type=PendingFactType.FACT,
            dsl_source=dsl_part,
            natural_language="",
            origin=FactOrigin.AI_CONJECTURE,
            confidence=0.5,
            z3_validated=False,
            z3_consistent_with_rag=False,
            z3_proof_trace=[],
            depends_on_facts=[],
            derived_from_rag=[],
        )
        _pending_facts[pending.id] = pending
        _session_facts[session_id].append(pending.id)
        _db_persist_pending_fact(pending)
        saved_dsl_sources.add(dsl_part.rstrip("."))
        new_facts_count += 1
        logger.info("Converted conjecture to pending fact: %s", dsl_part[:100])
    
    logger.info(
        "Processed message in session %s: %d facts used, %d conjectures, %d new facts",
        session_id,
        len(result.facts_used),
        len(result.conjectures_made),
        new_facts_count,
    )

    log_event("chat.request.completed", {
        "session_id": session_id,
        "request_id": request_id,
        "status": result.status,
        "is_conjecture": getattr(result, "is_conjecture", False),
        "facts_used_count": len(result.facts_used),
        "conjectures_count": len(result.conjectures_made),
        "z3_validations_count": len(result.z3_validations),
        "new_facts_count": new_facts_count,
        "rag_nodes_retrieved": len(getattr(result, "retrieved_rag_nodes", [])),
        "dsl_conclusion": result.dsl_conclusion[:300] if result.dsl_conclusion else "",
        "reasoning_trace_tail": result.proof_trace[-20:],
    })
    
    return SendMessageResponse(
        message_id=assistant_msg.id,
        role=MessageRole.ASSISTANT,
        content=assistant_msg.content,
        dsl_conclusion=getattr(result, 'dsl_conclusion', ''),
        proof_trace=result.proof_trace,
        facts_used=assistant_msg.facts_used,
        conjectures_made=assistant_msg.conjectures_made,
        z3_validations=assistant_msg.z3_validations,
        is_conjecture=getattr(result, "is_conjecture", False),
        new_facts_count=new_facts_count,
    )


@router.get("/sessions/{session_id}/messages", summary="Get messages in a session")
async def get_messages(
    session_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict:
    """Get messages from a chat session (in-memory or DB fallback)."""
    if session_id in _sessions:
        messages = _messages.get(session_id, [])
        total = len(messages)
        messages = messages[offset:offset + limit]
        return {
            "messages": [m.model_dump(mode="json") for m in messages],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    # Fallback: read from PostgreSQL for historical sessions
    db_msgs = _db_get_messages(session_id)
    if not db_msgs:
        raise HTTPException(status_code=404, detail="Session not found")
    total = len(db_msgs)
    db_msgs = db_msgs[offset:offset + limit]
    return {
        "messages": db_msgs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Session Completion
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/sessions/{session_id}/end", summary="End a chat session with feedback")
async def end_session(session_id: str, body: EndSessionRequest) -> EndSessionResponse:
    """
    End a chat session and generate a summary of new facts.
    
    When the session ends with positive feedback:
    1. Generate a summary of the conversation
    2. Compile all new facts discovered during the session
    3. Convert facts to DSL format for admin review
    4. Facts remain pending until admin approval
    
    Only facts that are:
    - Sound with each other (no internal contradictions)
    - Consistent with existing RAG knowledge
    - Validated by Z3
    
    will be included in the final compilation.
    """
    if session_id not in _sessions:
        if _restore_session(session_id) is None:
            raise HTTPException(status_code=404, detail="Session not found")

    session = _sessions[session_id]
    if session.status != ChatSessionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Session is not active")
    
    # Update session with feedback
    session.status = ChatSessionStatus.COMPLETED
    session.ended_at = datetime.utcnow()
    session.feedback_success = body.success
    session.feedback_rating = body.rating
    session.feedback_comment = body.comment
    
    # Get facts for this session
    fact_ids = _session_facts.get(session_id, [])
    facts = [_pending_facts[fid] for fid in fact_ids if fid in _pending_facts]
    
    # If successful, generate summary and finalize facts
    if body.success:
        summary, finalized_facts = await _finalize_session_facts(session_id, facts)
        session.summary = summary
        
        # Update fact counts
        facts_by_type = {}
        for f in finalized_facts:
            t = f.fact_type.value
            facts_by_type[t] = facts_by_type.get(t, 0) + 1
    else:
        # Mark facts as potentially unreliable
        for fact in facts:
            fact.confidence *= 0.5  # Reduce confidence
        facts_by_type = {}
    
    # Count pending facts
    pending_count = sum(
        1 for f in facts if f.status == PendingFactStatus.PENDING
    )
    
    _sessions[session_id] = session
    _db_persist_session(session)

    logger.info(
        "Ended session %s: success=%s, %d facts pending review",
        session_id,
        body.success,
        pending_count,
    )
    
    return EndSessionResponse(
        session_id=session_id,
        status=session.status,
        new_facts_count=len(facts),
        facts_by_type=facts_by_type,
        facts_pending_review=pending_count,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Pending Facts for Session
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/facts", summary="Get pending facts for a session")
async def get_session_facts(
    session_id: str,
    status: PendingFactStatus | None = None,
) -> dict:
    """Get all pending facts discovered in a session."""
    if session_id not in _sessions:
        if _restore_session(session_id) is None:
            raise HTTPException(status_code=404, detail="Session not found")

    fact_ids = _session_facts.get(session_id, [])
    facts = [_pending_facts[fid] for fid in fact_ids if fid in _pending_facts]
    
    if status:
        facts = [f for f in facts if f.status == status]
    
    # Calculate summary
    by_type = {}
    by_origin = {}
    by_status = {}
    total_confidence = 0.0
    
    for f in facts:
        by_type[f.fact_type.value] = by_type.get(f.fact_type.value, 0) + 1
        by_origin[f.origin.value] = by_origin.get(f.origin.value, 0) + 1
        by_status[f.status.value] = by_status.get(f.status.value, 0) + 1
        total_confidence += f.confidence
    
    summary = PendingFactSummary(
        session_id=session_id,
        total_facts=len(facts),
        by_type=by_type,
        by_origin=by_origin,
        by_status=by_status,
        avg_confidence=total_confidence / len(facts) if facts else 0.0,
    )
    
    return {
        "facts": [f.model_dump(mode="json") for f in facts],
        "summary": summary.model_dump(mode="json"),
    }


@router.get("/sessions/{session_id}/diagnostics/traces", summary="Get internal traces for a chat session")
async def get_chat_session_traces(
    session_id: str,
    limit: int = 200,
    event_type: str | None = None,
) -> dict:
    """Inspect internal telemetry for this chat session."""
    safe_limit = max(1, min(limit, 2000))
    events = get_recent_events(limit=safe_limit, event_type=event_type, session_id=session_id)

    return {
        "session_id": session_id,
        "count": len(events),
        "limit": safe_limit,
        "event_type": event_type,
        "events": events,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

def get_conversation_for_session(session_id: str) -> list[dict[str, Any]] | None:
    """
    Get the full conversation history for a session.
    Falls back to PostgreSQL for historical sessions.
    Returns None if session not found anywhere.
    """
    if session_id in _sessions:
        messages = _messages.get(session_id, [])
        return [
            {
                "id": m.id,
                "role": m.role.value,
                "content": m.content,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
                "dsl_conclusion": m.dsl_conclusion,
                "facts_used": m.facts_used,
                "conjectures_made": m.conjectures_made,
            }
            for m in messages
        ]

    # Fallback: PostgreSQL
    db_msgs = _db_get_messages(session_id)
    if db_msgs:
        return [
            {
                "id": m["id"],
                "role": m["role"],
                "content": m["content"],
                "timestamp": m.get("created_at"),
                "dsl_conclusion": None,
                "facts_used": m.get("facts_used", []),
                "conjectures_made": m.get("conjectures_made", []),
            }
            for m in db_msgs
        ]
    return None


def _build_conversation_context(messages: list[ChatMessage]) -> str:
    """Build a text representation of conversation for summarization."""
    lines = []
    for msg in messages[-10:]:  # Last 10 messages for summary
        if msg.role == MessageRole.USER:
            lines.append(f"User: {msg.content}")
        elif msg.role == MessageRole.ASSISTANT:
            lines.append(f"Assistant: {msg.content}")
    return "\n".join(lines)


async def _finalize_session_facts(
    session_id: str,
    facts: list[PendingFact],
) -> tuple[str, list[PendingFact]]:
    """
    Finalize session facts: run dedup/refinement, validate consistency,
    decompose into AST components, and generate summary.

    All facts with valid DSL are candidates — we no longer gate on
    z3_validated / z3_consistent_with_rag because those flags relied on
    a buggy call path that always left them False.

    Returns:
        (summary, finalized_facts)
    """
    from ..dependencies import get_z3_engine, get_llm

    z3_engine = get_z3_engine()
    llm = get_llm()

    # ── 1. Collect all facts that have parseable DSL ──────────────────────
    candidates = [f for f in facts if f.dsl_source and f.dsl_source.strip()]
    if not candidates:
        return "Session completed. No new facts discovered.", []

    # ── 2. Attempt Z3 validation for any fact that wasn't validated yet ───
    for fact in candidates:
        if not fact.z3_validated:
            try:
                from ...dsl import DSLParser
                parser = DSLParser()
                nodes = parser.parse(fact.dsl_source)
                all_ok = True
                for node in nodes:
                    z3_formula = z3_engine.translate_dsl_to_z3(node)
                    if z3_formula is not None:
                        result = z3_engine.check_consistency(
                            [("session_fact", z3_formula)]
                        )
                        if result.is_contradiction:
                            all_ok = False
                            break
                fact.z3_validated = all_ok
                fact.z3_consistent_with_rag = all_ok
            except Exception as exc:
                logger.debug("Z3 validation skipped for '%s': %s",
                             fact.dsl_source[:60], exc)
                # Leave z3_validated as-is — don't block on Z3 failures.

    # ── 3. Mutual consistency check ──────────────────────────────────────
    consistent_facts: list[PendingFact] = []
    for fact in candidates:
        is_consistent = await _check_fact_consistency(
            fact, consistent_facts, z3_engine
        )
        if is_consistent:
            consistent_facts.append(fact)
        else:
            fact.status = PendingFactStatus.REJECTED
            fact.rejection_reason = "Inconsistent with other discovered facts"

    # ── 4. Dedup / refinement round ──────────────────────────────────────
    try:
        from ..dependencies import get_property_graphs
        from ...pipeline.fact_refinement import FactRefiner

        graphs = get_property_graphs()
        refiner = FactRefiner(
            llm=llm,
            axioms_graph=graphs.get("axioms"),
            rules_graph=graphs.get("rules"),
            domain_graph=graphs.get("facts"),
            theorems_graph=graphs.get("theorems"),
        )
        report = await refiner.refine_facts(
            [{"dsl": f.dsl_source, "type": f.fact_type.value}
             for f in consistent_facts]
        )
        # Apply reuse/update decisions — update DSL where the refiner says so.
        for result in report.updated:
            if result.updated_dsl:
                for f in consistent_facts:
                    if f.dsl_source == result.candidate_dsl:
                        f.dsl_source = result.updated_dsl
                        break
        logger.info(
            "Dedup report: %d reused, %d updated, %d created, %d errors",
            len(report.reused), len(report.updated),
            len(report.created), len(report.errors),
        )
    except Exception as exc:
        logger.warning("Fact refinement failed (non-fatal): %s", exc)

    # ── 5. Decompose each fact into AST components for granular review ───
    for fact in consistent_facts:
        try:
            components = decompose_fact_to_ast(fact.dsl_source)
            fact.ast_components = components  # type: ignore[attr-defined]
        except Exception:
            pass  # Leave without AST decomposition — admin sees flat DSL.

    # Ensure all consistent facts stay PENDING for admin review
    for fact in consistent_facts:
        if fact.status not in (PendingFactStatus.REJECTED,):
            fact.status = PendingFactStatus.PENDING

    # ── Persist all facts (consistent + rejected) to DB ──────────────────
    for fact in candidates:
        _pending_facts[fact.id] = fact
        _db_persist_pending_fact(fact)

    # ── 6. Generate summary ──────────────────────────────────────────────
    if consistent_facts:
        facts_text = "\n".join(
            f"- {f.natural_language or f.dsl_source}"
            for f in consistent_facts
        )
        messages = _messages.get(session_id, [])
        conversation_text = _build_conversation_context(messages)

        prompt = (
            "Summarize this conversation and the new knowledge discovered.\n\n"
            f"Conversation:\n{conversation_text}\n\n"
            f"New Facts Discovered:\n{facts_text}\n\n"
            "Provide a brief summary (2-3 sentences) of what was learned."
        )
        try:
            response = await llm.acomplete(prompt)
            summary = str(response.text)
        except Exception as e:
            logger.warning("Failed to generate summary: %s", e)
            summary = (
                f"Session completed with {len(consistent_facts)} new facts "
                "pending admin review."
            )
    else:
        summary = "Session completed. No new facts survived consistency checks."

    return summary, consistent_facts


async def _check_fact_consistency(
    new_fact: PendingFact,
    existing_facts: list[PendingFact],
    z3_engine: Any,
) -> bool:
    """Check if a new fact is consistent with existing facts using Z3."""
    if not existing_facts:
        return True
    
    try:
        from ...dsl.guardrails import evaluate_statement_against_context

        existing_dsl = [f.dsl_source for f in existing_facts if f.dsl_source]
        guardrail = evaluate_statement_against_context(new_fact.dsl_source, existing_dsl)
        if not guardrail.get("ok"):
            return False

        # Translate all facts to Z3
        formulas: list[tuple[str, Any]] = []
        for idx, f in enumerate(existing_facts + [new_fact]):
            if f.dsl_source:
                # Parse DSL and translate to Z3
                from ...dsl import DSLParser
                parser = DSLParser()
                nodes = parser.parse(f.dsl_source)
                for node in nodes:
                    z3_formula = z3_engine.translate_dsl_to_z3(node)
                    if z3_formula is not None:
                        formulas.append((f"fact_{idx}", z3_formula))
        
        # Check satisfiability
        result = z3_engine.check_consistency(formulas)
        return result.is_valid
        
    except Exception as e:
        logger.warning("Error checking fact consistency: %s", e)
        return False  # Strict mode: if we can't verify, do not accept


# ═══════════════════════════════════════════════════════════════════════════════
# AST Decomposition for Granular Authorization
# ═══════════════════════════════════════════════════════════════════════════════

def decompose_fact_to_ast(dsl_source: str) -> list[dict[str, Any]]:
    """
    Decompose a DSL statement into an AST component tree for leaf-first
    granular authorization.

    Returns a list of AST component dicts, each with:
      - id: unique component id
      - kind: AST node type
      - dsl_fragment: the DSL source for this component
      - children: list of child component ids
      - parent: parent component id (None for root)
      - depth: depth in AST (0 = root)
      - is_leaf: whether this is a leaf node
      - status: "pending" (initially)
    """
    from ...dsl import DSLParser, DSLTranslator
    from ...dsl.parser import (
        AxiomNode, RuleNode, ProcedureNode, PredicateNode,
        BinaryOpNode, NotNode, QuantifiedNode, VarNode, LiteralNode,
        MetaLinkNode, ContextShiftNode, ContextEmbedNode, SubstNode,
        MatchNode,
    )

    parser = DSLParser()
    translator = DSLTranslator()
    nodes = parser.parse(dsl_source)

    components: list[dict[str, Any]] = []
    counter = [0]

    def _alloc_id() -> str:
        counter[0] += 1
        return f"ast_{counter[0]}"

    def _walk(node: Any, parent_id: str | None, depth: int) -> str:
        """Walk an AST node, return its component id."""
        comp_id = _alloc_id()
        try:
            fragment = translator.to_dsl(node)
        except Exception:
            fragment = repr(node)

        children_ids: list[str] = []

        if isinstance(node, AxiomNode):
            child_id = _walk(node.expr, comp_id, depth + 1)
            children_ids.append(child_id)
        elif isinstance(node, RuleNode):
            for p in node.premises:
                children_ids.append(_walk(p, comp_id, depth + 1))
            children_ids.append(_walk(node.conclusion, comp_id, depth + 1))
        elif isinstance(node, ProcedureNode):
            if node.precond:
                children_ids.append(_walk(node.precond, comp_id, depth + 1))
            for _, step_expr in node.steps:
                children_ids.append(_walk(step_expr, comp_id, depth + 1))
        elif isinstance(node, BinaryOpNode):
            children_ids.append(_walk(node.left, comp_id, depth + 1))
            children_ids.append(_walk(node.right, comp_id, depth + 1))
        elif isinstance(node, NotNode):
            children_ids.append(_walk(node.operand, comp_id, depth + 1))
        elif isinstance(node, QuantifiedNode):
            children_ids.append(_walk(node.body, comp_id, depth + 1))
        elif isinstance(node, PredicateNode):
            for arg in node.args:
                children_ids.append(_walk(arg, comp_id, depth + 1))
        elif isinstance(node, SubstNode):
            children_ids.append(_walk(node.expr, comp_id, depth + 1))
            children_ids.append(_walk(node.replacement, comp_id, depth + 1))
        elif isinstance(node, ContextEmbedNode):
            children_ids.append(_walk(node.expr, comp_id, depth + 1))
        elif isinstance(node, MatchNode):
            children_ids.append(_walk(node.subject, comp_id, depth + 1))
            for pattern, body in node.arms:
                children_ids.append(_walk(pattern, comp_id, depth + 1))
                children_ids.append(_walk(body, comp_id, depth + 1))

        kind = getattr(node, "kind", type(node).__name__)
        components.append({
            "id": comp_id,
            "kind": kind,
            "dsl_fragment": fragment,
            "children": children_ids,
            "parent": parent_id,
            "depth": depth,
            "is_leaf": len(children_ids) == 0,
            "status": "pending",
        })
        return comp_id

    for node in nodes:
        _walk(node, None, 0)

    return components


# ═══════════════════════════════════════════════════════════════════════════════
# Exports for use by dependencies
# ═══════════════════════════════════════════════════════════════════════════════

def get_pending_facts() -> dict[str, PendingFact]:
    """Get all pending facts — in-memory cache + DB fallback."""
    if _pending_facts:
        return _pending_facts
    # Cache is empty — hydrate from PostgreSQL
    try:
        rows, _total = _db_list_pending_facts(limit=5000)
        for row in rows:
            fact = _hydrate_pending_fact(row)
            _pending_facts[fact.id] = fact
    except Exception:
        logger.exception("Failed to hydrate pending facts from DB")
    return _pending_facts


def update_pending_fact(fact_id: str, fact: PendingFact) -> None:
    """Update a pending fact (in-memory + DB)."""
    _pending_facts[fact_id] = fact
    _db_update_pending_fact(fact)


def _hydrate_pending_fact(row: dict) -> PendingFact:
    """Convert a DB row dict into a PendingFact model."""
    try:
        fact_type = PendingFactType(row["fact_type"])
    except ValueError:
        fact_type = PendingFactType.FACT
    try:
        origin = FactOrigin(row["origin"])
    except ValueError:
        origin = FactOrigin.HYBRID
    try:
        status = PendingFactStatus(row.get("status", "pending"))
    except ValueError:
        status = PendingFactStatus.PENDING
    return PendingFact(
        id=row["id"],
        session_id=row["session_id"],
        fact_type=fact_type,
        dsl_source=row["dsl_source"],
        natural_language=row.get("natural_language", ""),
        origin=origin,
        confidence=row["confidence"],
        z3_validated=row.get("z3_validated", False),
        z3_consistent_with_rag=row.get("z3_consistent_with_rag", False),
        z3_proof_trace=row.get("z3_proof_trace") or [],
        depends_on_facts=row.get("depends_on_facts") or [],
        derived_from_rag=row.get("derived_from_rag") or [],
        ast_components=row.get("ast_components") or [],
        status=status,
        reviewed_by=row.get("reviewed_by"),
        reviewed_at=row.get("reviewed_at"),
        rejection_reason=row.get("rejection_reason"),
    )
