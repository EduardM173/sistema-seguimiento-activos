-- GraphRAG PostgreSQL Initialisation Script
-- Run once on a fresh database: psql -f migrations/init.sql

-- Enable pgvector extension (required for LlamaIndex PGVectorStore)
CREATE EXTENSION IF NOT EXISTS vector;

-- NOTE: Graph data (contexts, nodes, edges) is stored in Neo4j, NOT PostgreSQL.
-- This file only contains tables for:
-- - Document embeddings (vector store)
-- - Chat sessions and messages
-- - Pending facts for admin verification

-- ── LlamaIndex PGVectorStore table ──────────────────────────────────────────
-- Created automatically by llama-index-vector-stores-postgres on first use,
-- but we pre-create it here so the schema is visible.

CREATE TABLE IF NOT EXISTS document_embeddings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT        NOT NULL,
    metadata_   JSONB       NOT NULL DEFAULT '{}',
    node_id     TEXT,
    embedding   vector(768),   -- text-embedding-004 dimensionality
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_embeddings_hnsw
    ON document_embeddings
    USING hnsw (embedding vector_cosine_ops);


-- ═══════════════════════════════════════════════════════════════════════════════
-- Chat Session Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id              TEXT        PRIMARY KEY,
    status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    title           TEXT        NOT NULL DEFAULT '',
    user_id         TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    user_state      JSONB       NOT NULL DEFAULT '{}',
    
    -- Feedback (set when session ends)
    feedback_success    BOOLEAN,
    feedback_rating     INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
    feedback_comment    TEXT,
    
    -- Summary (generated when session ends)
    summary         TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started ON chat_sessions(started_at DESC);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT        PRIMARY KEY,
    session_id      TEXT        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT        NOT NULL,
    
    -- Reasoning metadata (for assistant messages)
    reasoning_trace JSONB       NOT NULL DEFAULT '[]',
    facts_used      JSONB       NOT NULL DEFAULT '[]',
    conjectures_made JSONB      NOT NULL DEFAULT '[]',
    z3_validations  JSONB       NOT NULL DEFAULT '[]',
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);


-- ═══════════════════════════════════════════════════════════════════════════════
-- Pending Facts Tables (for admin verification)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Pending facts awaiting admin verification
CREATE TABLE IF NOT EXISTS pending_facts (
    id              TEXT        PRIMARY KEY,
    session_id      TEXT        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    -- Fact content
    fact_type       TEXT        NOT NULL CHECK (fact_type IN ('axiom', 'fact', 'theorem', 'rule', 'procedure')),
    dsl_source      TEXT        NOT NULL,
    natural_language TEXT       NOT NULL,
    
    -- Derivation info
    origin          TEXT        NOT NULL CHECK (origin IN ('rag_derived', 'ai_conjecture', 'hybrid', 'user_provided')),
    confidence      REAL        NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Z3 validation results
    z3_validated    BOOLEAN     NOT NULL DEFAULT FALSE,
    z3_consistent_with_rag BOOLEAN NOT NULL DEFAULT FALSE,
    z3_proof_trace  JSONB       NOT NULL DEFAULT '[]',
    
    -- Dependencies
    depends_on_facts JSONB      NOT NULL DEFAULT '[]',
    derived_from_rag JSONB      NOT NULL DEFAULT '[]',
    
    -- AST decomposition for granular review
    ast_components  JSONB       NOT NULL DEFAULT '[]',
    
    -- Admin review
    status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_facts_session ON pending_facts(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_facts_status ON pending_facts(status);
CREATE INDEX IF NOT EXISTS idx_pending_facts_type ON pending_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_pending_facts_confidence ON pending_facts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_pending_facts_created ON pending_facts(created_at DESC);
