"""
Rich Embedding Text Generator
==============================
Builds a human-readable text from a graph node's metadata for embedding.
"""
from __future__ import annotations

from typing import Any


def build_rich_embedding_text(
    dsl_source: str,
    node_type: str,
    label: str,
    properties: dict[str, Any] | None = None,
) -> str:
    """Build a plain-text embedding from node attributes."""
    props = properties or {}
    predicate = props.get("predicate", "")
    obj = props.get("object", "")

    parts: list[str] = []
    if label:
        parts.append(label)
    if predicate and obj:
        parts.append(f"{predicate}: {obj}")
    elif dsl_source:
        parts.append(dsl_source)

    entity_type = props.get("entity_type", node_type)
    if entity_type:
        parts.append(f"[{entity_type}]")

    return ". ".join(p for p in parts if p)
