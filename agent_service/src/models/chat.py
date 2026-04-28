"""
Chat Session Models
====================
Pydantic models for chat sessions, messages, and pending facts.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ChatSessionStatus(str, Enum):
    """Status of a chat session."""
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    """Role of a chat message sender."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class PendingFactStatus(str, Enum):
    """Status of a pending fact awaiting verification."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PendingFactType(str, Enum):
    """Type of pending fact."""
    AXIOM = "axiom"
    FACT = "fact"
    THEOREM = "theorem"
    RULE = "rule"
    PROCEDURE = "procedure"


class FactOrigin(str, Enum):
    """How the fact was derived."""
    RAG_DERIVED = "rag_derived"       # Derived purely from RAG knowledge
    AI_CONJECTURE = "ai_conjecture"   # AI guessed/conjectured
    HYBRID = "hybrid"                 # Combination of RAG + AI reasoning
    USER_PROVIDED = "user_provided"   # Explicitly provided by user


# ═══════════════════════════════════════════════════════════════════════════════
# Chat Message
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    """A single message in a chat session.
    
    For assistant messages, all reasoning is in DSL format.
    content is the natural language version for the user.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str
    role: MessageRole
    content: str  # Natural language for user
    
    # DSL reasoning metadata (for assistant messages)
    dsl_conclusion: str = ""  # Final DSL conclusion
    reasoning_trace: list[str] = Field(default_factory=list)  # DSL proof steps
    facts_used: list[str] = Field(default_factory=list)  # DSL facts from RAG
    conjectures_made: list[str] = Field(default_factory=list)  # DSL conjectures
    z3_validations: list[dict[str, Any]] = Field(default_factory=list)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════════
# Chat Session
# ═══════════════════════════════════════════════════════════════════════════════

class ChatSession(BaseModel):
    """A chat session with the reasoning agent."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: ChatSessionStatus = ChatSessionStatus.ACTIVE
    
    # Session metadata
    title: str = ""
    user_id: str | None = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: datetime | None = None
    user_state: dict[str, Any] = Field(default_factory=dict)

    
    # Feedback (set when session ends)
    feedback_success: bool | None = None
    feedback_rating: int | None = None  # 1-5
    feedback_comment: str | None = None
    
    # Summary (generated when session ends)
    summary: str | None = None
    
    class Config:
        from_attributes = True


class ChatSessionWithMessages(ChatSession):
    """Chat session with its messages."""
    messages: list[ChatMessage] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Pending Fact
# ═══════════════════════════════════════════════════════════════════════════════

class PendingFact(BaseModel):
    """A new fact discovered during chat, awaiting admin verification.
    
    NOTE: DSL is the primary format. All reasoning happens in DSL.
    natural_language is optional and used only for admin readability.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str
    
    # Fact content - DSL is PRIMARY, natural_language is optional
    fact_type: PendingFactType
    dsl_source: str = Field(..., description="The fact in DSL format (required)")
    natural_language: str = Field(default="", description="Optional human-readable description")
    
    # Derivation info
    origin: FactOrigin
    confidence: float = Field(ge=0.0, le=1.0)
    
    # Z3 validation results
    z3_validated: bool = False
    z3_consistent_with_rag: bool = False
    z3_proof_trace: list[str] = Field(default_factory=list)
    
    # Dependencies
    depends_on_facts: list[str] = Field(default_factory=list)  # fact IDs
    derived_from_rag: list[str] = Field(default_factory=list)  # node IDs
    
    # AST decomposition for granular review
    ast_components: list[dict[str, Any]] = Field(
        default_factory=list,
        description="AST breakdown of this fact for leaf-first authorization",
    )
    
    # Admin review
    status: PendingFactStatus = PendingFactStatus.PENDING
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        from_attributes = True


class PendingFactSummary(BaseModel):
    """Summary of pending facts for a session."""
    session_id: str
    total_facts: int
    by_type: dict[str, int]
    by_origin: dict[str, int]
    by_status: dict[str, int]
    avg_confidence: float


# ═══════════════════════════════════════════════════════════════════════════════
# API Request/Response Models
# ═══════════════════════════════════════════════════════════════════════════════

class CreateSessionRequest(BaseModel):
    """Request to create a new chat session."""
    title: str | None = None
    user_id: str | None = None
    initial_context: dict[str, Any] | None = None


class CreateSessionResponse(BaseModel):
    """Response after creating a chat session."""
    session_id: str
    status: ChatSessionStatus
    created_at: datetime


class SendMessageRequest(BaseModel):
    """Request to send a message in a chat session."""
    content: str
    
    # Optional: provide additional context for this message
    context: dict[str, Any] | None = None
    
    # Optional: allow AI conjectures when RAG is insufficient
    allow_conjectures: bool = True


class SendMessageResponse(BaseModel):
    """Response after sending a message."""
    message_id: str
    role: MessageRole
    content: str  # Natural language answer for user
    
    # DSL reasoning results
    dsl_conclusion: str = ""  # The final DSL conclusion
    proof_trace: list[str] = Field(default_factory=list)  # DSL proof steps
    
    # Reasoning metadata (all in DSL format)
    facts_used: list[str]  # DSL facts from RAG
    conjectures_made: list[str]  # DSL conjectures
    z3_validations: list[dict[str, Any]]
    
    # Conjecture flag
    is_conjecture: bool = False  # True when answer is an unverified conjecture
    
    # New facts discovered in this turn
    new_facts_count: int


class EndSessionRequest(BaseModel):
    """Request to end a chat session with feedback."""
    success: bool
    rating: int | None = Field(None, ge=1, le=5)
    comment: str | None = None


class EndSessionResponse(BaseModel):
    """Response after ending a session."""
    session_id: str
    status: ChatSessionStatus
    
    # Summary of new facts generated
    new_facts_count: int
    facts_by_type: dict[str, int]
    facts_pending_review: int


class AdminFactReviewRequest(BaseModel):
    """Request to review a pending fact."""
    approved: bool
    reason: str | None = None
    reviewer_id: str | None = None


class AdminBulkReviewRequest(BaseModel):
    """Request to bulk review pending facts."""
    fact_ids: list[str]
    approved: bool
    reason: str | None = None
    reviewer_id: str | None = None


class AdminBulkReviewResponse(BaseModel):
    """Response after bulk review."""
    processed: int
    approved: int
    rejected: int
    errors: list[dict[str, str]]


# ═══════════════════════════════════════════════════════════════════════════════
# Admin Knowledge Management Models
# ═══════════════════════════════════════════════════════════════════════════════

class KnowledgeItemType(str, Enum):
    """Types of knowledge items in the system."""
    AXIOM = "axiom"
    RULE = "rule"
    FACT = "fact"
    THEOREM = "theorem"
    PROCEDURE = "procedure"


class KnowledgeItemStatus(str, Enum):
    """Status of a knowledge item."""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class AddKnowledgeRequest(BaseModel):
    """Request to manually add a knowledge item."""
    # Input can be DSL or natural language
    content: str = Field(..., description="DSL statement or natural language description")
    is_dsl: bool = Field(True, description="If True, content is DSL. If False, will be translated.")
    
    # Item metadata
    item_type: KnowledgeItemType = Field(KnowledgeItemType.FACT, description="Type of knowledge item")
    name: str | None = Field(None, description="Optional name/label for the item")
    
    # Additional context
    description: str = Field("", description="Human-readable description")
    source: str = Field("admin_manual", description="Source of this knowledge")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Confidence score")
    
    # Soundness options
    skip_soundness_check: bool = Field(False, description="Skip Z3 soundness validation")
    force_add: bool = Field(False, description="Add even if weak contradiction detected")


class AddKnowledgeResponse(BaseModel):
    """Response after adding knowledge."""
    success: bool
    item_id: str | None = None
    item_type: KnowledgeItemType
    dsl_source: str  # The final DSL representation
    
    # Soundness results
    soundness_checked: bool
    is_sound: bool
    contradiction_details: str | None = None
    
    message: str


class SearchKnowledgeRequest(BaseModel):
    """Request to search knowledge base using natural language."""
    query: str = Field(..., description="Natural language search query")
    
    # Filters
    item_types: list[KnowledgeItemType] | None = Field(
        None, 
        description="Filter by item types. None means search all."
    )
    include_archived: bool = Field(False, description="Include archived items in results")
    
    # Search parameters
    top_k: int = Field(10, ge=1, le=100, description="Maximum results to return")
    min_similarity: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold")


class SearchKnowledgeResult(BaseModel):
    """A single search result."""
    id: str
    item_type: KnowledgeItemType
    dsl_source: str
    natural_description: str | None = None
    similarity_score: float
    
    # Metadata
    created_at: datetime | None = None
    source: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class SearchKnowledgeResponse(BaseModel):
    """Response from knowledge search."""
    query: str
    dsl_query: str  # The DSL translation of the natural language query
    
    results: list[SearchKnowledgeResult]
    total_found: int
    
    # Search metadata
    item_types_searched: list[str]
    search_time_ms: float


class ArchiveKnowledgeRequest(BaseModel):
    """Request to archive a knowledge item."""
    reason: str | None = Field(None, description="Reason for archiving")
    archived_by: str | None = Field(None, description="ID of admin performing action")


class DeleteKnowledgeRequest(BaseModel):
    """Request to delete a knowledge item."""
    reason: str | None = Field(None, description="Reason for deletion")
    deleted_by: str | None = Field(None, description="ID of admin performing action")
    cascade: bool = Field(False, description="Also delete dependent items")
