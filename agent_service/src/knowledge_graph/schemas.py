"""
Knowledge graph data schemas (Pydantic models).
"""
from __future__ import annotations

from enum import Enum
from typing import Any
from datetime import datetime

from pydantic import BaseModel, Field


class GraphContextType(str, Enum):
    """Type of knowledge graph context (sub-graph)."""
    SYSTEM_ENTITIES = "system_entities"   # microservices, endpoints, users…
    PROCEDURES      = "procedures"        # AOP / DSL procedures
    THEOREMS        = "theorems"          # deduced theorems
    CONVERSATIONS   = "conversations"     # learned from chat
    JIRA            = "jira"              # bug / ticket history
    META            = "meta"              # meta-graph (graphs of graphs)
    CUSTOM          = "custom"


class NodeType(str, Enum):
    ENTITY      = "entity"        # system entity (microservice, endpoint, user)
    FACT        = "fact"          # standalone business fact
    AXIOM       = "axiom"         # DSL axiom
    RULE        = "rule"          # DSL deduction rule
    PROCEDURE   = "procedure"     # AOP procedure
    THEOREM     = "theorem"       # deduced result
    DOCUMENT    = "document"      # source document chunk
    CONVERSATION = "conversation" # conversation turn
    JIRA_TICKET = "jira_ticket"   # Jira issue
    CONTEXT     = "context"       # graph context node (for meta-graph)


class EdgeType(str, Enum):
    USES        = "uses"
    IMPLEMENTS  = "implements"
    DERIVED_FROM = "derived_from"
    RELATED_TO  = "related_to"
    CONTAINS    = "contains"
    RESOLVES    = "resolves"
    PART_OF     = "part_of"
    META_LINK   = "meta_link"
    CONTEXT_SHIFT = "context_shift"


class GraphNode(BaseModel):
    id: str = Field(..., description="Unique node identifier")
    type: NodeType
    context: str = "default"
    label: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)
    dsl_source: str | None = None     # raw DSL representation of this node
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GraphEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    source_id: str
    target_id: str
    type: EdgeType
    properties: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GraphContext(BaseModel):
    name: str
    type: GraphContextType
    description: str = ""
    parent_context: str | None = None  # for meta-graph nesting
    created_at: datetime = Field(default_factory=datetime.utcnow)
