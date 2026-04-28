"""Reusable DSL consistency guardrails for duplicate and direct contradiction checks."""
from __future__ import annotations

from typing import Any

from .parser import DSLParser, NotNode
from .translator import DSLTranslator


def canonicalize_single_statement_dsl(dsl_source: str) -> str | None:
    """Return canonical DSL for a single statement, normalized with trailing dot."""
    parser = DSLParser()
    translator = DSLTranslator()

    try:
        nodes = parser.parse(dsl_source)
        if len(nodes) != 1:
            return None
        canonical = translator.to_dsl(nodes[0]).strip()
        if not canonical.endswith("."):
            canonical = f"{canonical}."
        return canonical
    except Exception:
        return None


def is_direct_negation_pair(dsl_a: str, dsl_b: str) -> bool:
    """True if statements are direct negations of each other: P <-> NOT P."""
    parser = DSLParser()
    translator = DSLTranslator()

    def split_not(src: str) -> tuple[bool, str] | None:
        try:
            nodes = parser.parse(src)
            if len(nodes) != 1:
                return None
            node = nodes[0]
            is_not = isinstance(node, NotNode)
            core = node.operand if is_not else node
            core_dsl = translator.to_dsl(core).strip()
            if not core_dsl.endswith("."):
                core_dsl = f"{core_dsl}."
            return is_not, core_dsl
        except Exception:
            return None

    a = split_not(dsl_a)
    b = split_not(dsl_b)
    if a is None or b is None:
        return False

    return a[1] == b[1] and a[0] != b[0]


def evaluate_statement_against_context(
    new_statement: str,
    existing_statements: list[str],
) -> dict[str, Any]:
    """Check canonical duplicate and direct negation conflict against existing statements."""
    canonical_new = canonicalize_single_statement_dsl(new_statement)
    if canonical_new is None:
        return {
            "ok": False,
            "reason": "new-not-canonicalizable",
            "canonical_new": None,
            "conflict_with": None,
        }

    for existing in existing_statements:
        canonical_existing = canonicalize_single_statement_dsl(existing)
        if canonical_existing is None:
            continue

        if canonical_existing == canonical_new:
            return {
                "ok": False,
                "reason": "duplicate",
                "canonical_new": canonical_new,
                "conflict_with": canonical_existing,
            }

        if is_direct_negation_pair(canonical_existing, canonical_new):
            return {
                "ok": False,
                "reason": "direct-contradiction",
                "canonical_new": canonical_new,
                "conflict_with": canonical_existing,
            }

    return {
        "ok": True,
        "reason": None,
        "canonical_new": canonical_new,
        "conflict_with": None,
    }
