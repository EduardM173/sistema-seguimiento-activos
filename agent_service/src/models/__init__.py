"""Shared Pydantic request/response models for the API."""
from __future__ import annotations

from pydantic import BaseModel

from .chat import (
    ChatSession,
    ChatSessionStatus,
    ChatMessage,
    MessageRole,
    PendingFact,
    PendingFactType,
    PendingFactStatus,
    FactOrigin,
    ChatSessionWithMessages,
    PendingFactSummary,
    CreateSessionRequest,
    CreateSessionResponse,
    SendMessageRequest,
    SendMessageResponse,
    EndSessionRequest,
    EndSessionResponse,
    AdminFactReviewRequest,
    AdminBulkReviewRequest,
    AdminBulkReviewResponse,
    # Knowledge Management
    KnowledgeItemType,
    KnowledgeItemStatus,
    AddKnowledgeRequest,
    AddKnowledgeResponse,
    SearchKnowledgeRequest,
    SearchKnowledgeResult,
    SearchKnowledgeResponse,
    ArchiveKnowledgeRequest,
    DeleteKnowledgeRequest,
)


class HealthResponse(BaseModel):
    status: str


__all__ = [
    # Health
    "HealthResponse",
    # Chat
    "ChatSession",
    "ChatSessionStatus",
    "ChatMessage",
    "MessageRole",
    "PendingFact",
    "PendingFactType",
    "PendingFactStatus",
    "FactOrigin",
    "ChatSessionWithMessages",
    "PendingFactSummary",
    "CreateSessionRequest",
    "CreateSessionResponse",
    "SendMessageRequest",
    "SendMessageResponse",
    "EndSessionRequest",
    "EndSessionResponse",
    "AdminFactReviewRequest",
    "AdminBulkReviewRequest",
    "AdminBulkReviewResponse",
    # Knowledge Management
    "KnowledgeItemType",
    "KnowledgeItemStatus",
    "AddKnowledgeRequest",
    "AddKnowledgeResponse",
    "SearchKnowledgeRequest",
    "SearchKnowledgeResult",
    "SearchKnowledgeResponse",
    "ArchiveKnowledgeRequest",
    "DeleteKnowledgeRequest",
]
