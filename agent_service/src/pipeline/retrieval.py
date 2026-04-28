"""
Retrieval result model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RetrievalResult:
    """A single retrieved node with its score and DSL representation."""
    node_id: str
    text: str
    score: float
    dsl_source: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
