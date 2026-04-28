"""
PostgreSQL persistence for chat sessions and messages.

Provides write-through persistence so that session/message data survives
server restarts.  Reads fall back to the DB when the in-memory cache is empty.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import psycopg2
import psycopg2.extras

from ..config import settings

logger = logging.getLogger(__name__)

# ── Connection helper ─────────────────────────────────────────────────────────

def _get_conn():
    """Return a fresh psycopg2 connection using app settings."""
    return psycopg2.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        dbname=settings.postgres_db,
        user=settings.postgres_user,
        password=settings.postgres_password,
    )


# ── Sessions ──────────────────────────────────────────────────────────────────

def persist_session(session) -> None:
    """INSERT or UPDATE a chat session row."""
    try:
        with _get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chat_sessions
                    (id, status, title, user_id, started_at, ended_at, user_state,
                     feedback_success, feedback_rating, feedback_comment, summary)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    status           = EXCLUDED.status,
                    title            = EXCLUDED.title,
                    ended_at         = EXCLUDED.ended_at,
                    user_state       = EXCLUDED.user_state,
                    feedback_success = EXCLUDED.feedback_success,
                    feedback_rating  = EXCLUDED.feedback_rating,
                    feedback_comment = EXCLUDED.feedback_comment,
                    summary          = EXCLUDED.summary
                """,
                (
                    session.id,
                    session.status.value if hasattr(session.status, "value") else session.status,
                    session.title,
                    session.user_id,
                    session.started_at,
                    getattr(session, "ended_at", None),
                    json.dumps(getattr(session, "user_state", {}) or {}),
                    getattr(session, "feedback_success", None),
                    getattr(session, "feedback_rating", None),
                    getattr(session, "feedback_comment", None),
                    getattr(session, "summary", None),
                ),
            )
    except Exception:
        logger.exception("Failed to persist session %s", session.id)


def list_sessions_from_db(
    *,
    status: str | None = None,
    user_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Return (rows, total) from chat_sessions ordered by started_at DESC."""
    try:
        with _get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_clauses: list[str] = []
            params: list[Any] = []
            if status:
                where_clauses.append("status = %s")
                params.append(status)
            if user_id:
                where_clauses.append("user_id = %s")
                params.append(user_id)

            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            cur.execute(f"SELECT count(*) AS cnt FROM chat_sessions{where_sql}", params)
            row = cur.fetchone()
            total = row["cnt"] if row else 0

            cur.execute(
                f"""
                SELECT id, status, title, user_id, started_at, ended_at, user_state,
                       feedback_success, feedback_rating, feedback_comment, summary
                FROM chat_sessions{where_sql}
                ORDER BY started_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = [dict(r) for r in cur.fetchall()]
            # Ensure datetime fields are ISO strings for JSON serialisation
            for row in rows:
                for dt_field in ("started_at", "ended_at"):
                    val = row.get(dt_field)
                    if isinstance(val, datetime):
                        row[dt_field] = val.isoformat()
            return rows, total
    except Exception:
        logger.exception("Failed to list sessions from DB")
        return [], 0


def get_session_from_db(session_id: str) -> dict[str, Any] | None:
    """Return a single session row as a dict, or None if not found."""
    try:
        with _get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, status, title, user_id, started_at, ended_at, user_state,
                       feedback_success, feedback_rating, feedback_comment, summary
                FROM chat_sessions
                WHERE id = %s
                """,
                (session_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            row = dict(row)
            for dt_field in ("started_at", "ended_at"):
                val = row.get(dt_field)
                if isinstance(val, datetime):
                    row[dt_field] = val.isoformat()
            return row
    except Exception:
        logger.exception("Failed to get session %s from DB", session_id)
        return None


# ── Messages ──────────────────────────────────────────────────────────────────

def persist_message(msg) -> None:
    """INSERT a chat message row."""
    try:
        with _get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO chat_messages
                    (id, session_id, role, content,
                     reasoning_trace, facts_used, conjectures_made, z3_validations,
                     created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    msg.id,
                    msg.session_id,
                    msg.role.value if hasattr(msg.role, "value") else msg.role,
                    msg.content,
                    json.dumps(getattr(msg, "reasoning_trace", []) or []),
                    json.dumps(getattr(msg, "facts_used", []) or []),
                    json.dumps(getattr(msg, "conjectures_made", []) or []),
                    json.dumps(getattr(msg, "z3_validations", []) or []),
                    getattr(msg, "created_at", None) or datetime.utcnow(),
                ),
            )
    except Exception:
        logger.exception("Failed to persist message %s", msg.id)


def get_messages_from_db(session_id: str) -> list[dict[str, Any]]:
    """Return all messages for a session, ordered by created_at."""
    try:
        with _get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, session_id, role, content,
                       reasoning_trace, facts_used, conjectures_made, z3_validations,
                       created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at
                """,
                (session_id,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            for row in rows:
                if isinstance(row.get("created_at"), datetime):
                    row["created_at"] = row["created_at"].isoformat()
            return rows
    except Exception:
        logger.exception("Failed to get messages from DB for session %s", session_id)
        return []


# ── Pending Facts ─────────────────────────────────────────────────────────────

def persist_pending_fact(fact) -> None:
    """INSERT or UPDATE a pending fact row."""
    try:
        with _get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pending_facts
                    (id, session_id, fact_type, dsl_source, natural_language,
                     origin, confidence, z3_validated, z3_consistent_with_rag,
                     z3_proof_trace, depends_on_facts, derived_from_rag,
                     ast_components, status, reviewed_by, reviewed_at,
                     rejection_reason, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET
                    dsl_source             = EXCLUDED.dsl_source,
                    natural_language       = EXCLUDED.natural_language,
                    confidence             = EXCLUDED.confidence,
                    z3_validated           = EXCLUDED.z3_validated,
                    z3_consistent_with_rag = EXCLUDED.z3_consistent_with_rag,
                    z3_proof_trace         = EXCLUDED.z3_proof_trace,
                    depends_on_facts       = EXCLUDED.depends_on_facts,
                    derived_from_rag       = EXCLUDED.derived_from_rag,
                    ast_components         = EXCLUDED.ast_components,
                    status                 = EXCLUDED.status,
                    reviewed_by            = EXCLUDED.reviewed_by,
                    reviewed_at            = EXCLUDED.reviewed_at,
                    rejection_reason       = EXCLUDED.rejection_reason
                """,
                (
                    fact.id,
                    fact.session_id,
                    fact.fact_type.value if hasattr(fact.fact_type, "value") else fact.fact_type,
                    fact.dsl_source,
                    fact.natural_language or "",
                    fact.origin.value if hasattr(fact.origin, "value") else fact.origin,
                    fact.confidence,
                    fact.z3_validated,
                    fact.z3_consistent_with_rag,
                    json.dumps(fact.z3_proof_trace or []),
                    json.dumps(fact.depends_on_facts or []),
                    json.dumps(fact.derived_from_rag or []),
                    json.dumps(getattr(fact, "ast_components", None) or []),
                    fact.status.value if hasattr(fact.status, "value") else fact.status,
                    getattr(fact, "reviewed_by", None),
                    getattr(fact, "reviewed_at", None),
                    getattr(fact, "rejection_reason", None),
                    getattr(fact, "created_at", None) or datetime.utcnow(),
                ),
            )
    except Exception:
        logger.exception("Failed to persist pending fact %s", fact.id)


def update_pending_fact_in_db(fact) -> None:
    """Convenience alias — same upsert logic."""
    persist_pending_fact(fact)


def list_pending_facts_from_db(
    *,
    status: str | None = None,
    fact_type: str | None = None,
    session_id: str | None = None,
    min_confidence: float | None = None,
    z3_validated_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """Return (rows, total) from pending_facts ordered by created_at DESC."""
    try:
        with _get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            where_clauses: list[str] = []
            params: list[Any] = []
            if status:
                where_clauses.append("status = %s")
                params.append(status)
            if fact_type:
                where_clauses.append("fact_type = %s")
                params.append(fact_type)
            if session_id:
                where_clauses.append("session_id = %s")
                params.append(session_id)
            if min_confidence is not None:
                where_clauses.append("confidence >= %s")
                params.append(min_confidence)
            if z3_validated_only:
                where_clauses.append("z3_validated = TRUE")

            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            cur.execute(f"SELECT count(*) AS cnt FROM pending_facts{where_sql}", params)
            row = cur.fetchone()
            total = row["cnt"] if row else 0

            cur.execute(
                f"""
                SELECT id, session_id, fact_type, dsl_source, natural_language,
                       origin, confidence, z3_validated, z3_consistent_with_rag,
                       z3_proof_trace, depends_on_facts, derived_from_rag,
                       ast_components, status, reviewed_by, reviewed_at,
                       rejection_reason, created_at
                FROM pending_facts{where_sql}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = [dict(r) for r in cur.fetchall()]
            for row in rows:
                for dt_field in ("created_at", "reviewed_at"):
                    val = row.get(dt_field)
                    if isinstance(val, datetime):
                        row[dt_field] = val.isoformat()
            return rows, total
    except Exception:
        logger.exception("Failed to list pending facts from DB")
        return [], 0


def get_pending_fact_from_db(fact_id: str) -> dict[str, Any] | None:
    """Return a single pending fact row or None."""
    try:
        with _get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, session_id, fact_type, dsl_source, natural_language,
                       origin, confidence, z3_validated, z3_consistent_with_rag,
                       z3_proof_trace, depends_on_facts, derived_from_rag,
                       ast_components, status, reviewed_by, reviewed_at,
                       rejection_reason, created_at
                FROM pending_facts
                WHERE id = %s
                """,
                (fact_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            row = dict(row)
            for dt_field in ("created_at", "reviewed_at"):
                val = row.get(dt_field)
                if isinstance(val, datetime):
                    row[dt_field] = val.isoformat()
            return row
    except Exception:
        logger.exception("Failed to get pending fact %s from DB", fact_id)
        return None


def delete_pending_fact_from_db(fact_id: str) -> bool:
    """Delete a pending fact row. Returns True if deleted."""
    try:
        with _get_conn() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM pending_facts WHERE id = %s", (fact_id,))
            return cur.rowcount > 0
    except Exception:
        logger.exception("Failed to delete pending fact %s from DB", fact_id)
        return False
