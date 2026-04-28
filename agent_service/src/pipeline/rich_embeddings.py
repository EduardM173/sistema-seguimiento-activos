"""
Rich Embedding Text Generator
==============================
Generates semantically rich text for embedding Neo4j graph nodes.

Instead of embedding raw DSL, we construct a comprehensive text that encodes:
- Node type and role in the knowledge graph
- Statement template / evaluation semantics
- Entity properties and evaluation domain
- Formal evaluation procedures for predicates
- Dependencies and relationships

This ensures vector similarity captures meaningful semantic proximity
even across different DSL statement structures.
"""
from __future__ import annotations

import logging
from typing import Any

from ..dsl.parser import (
    DSLNode, AxiomNode, RuleNode, ProcedureNode, PredicateNode,
    BinaryOpNode, NotNode, QuantifiedNode, VarNode, LiteralNode,
    SubstNode, MatchNode, MetaLinkNode, ContextShiftNode, ContextEmbedNode,
)

logger = logging.getLogger(__name__)


def build_rich_embedding_text(
    dsl_source: str,
    node_type: str,
    label: str = "",
    properties: dict[str, Any] | None = None,
    ast_node: DSLNode | None = None,
) -> str:
    """
    Build a rich, semantically dense text for embedding a knowledge graph node.

    Args:
        dsl_source:  The raw DSL source text.
        node_type:   One of: axiom, deduction_rule, fact, theorem, entity,
                     procedure, predicate, conversation, etc.
        label:       Human-readable label for the node.
        properties:  Additional metadata properties.
        ast_node:    Pre-parsed AST node (avoids re-parsing).

    Returns:
        A text string optimised for embedding that compacts type, semantics,
        evaluation domain, and entity references.
    """
    props = properties or {}
    parts: list[str] = []

    # ── 1. Type header ────────────────────────────────────────────────────
    type_desc = _TYPE_DESCRIPTIONS.get(node_type, f"knowledge node ({node_type})")
    parts.append(f"[{node_type.upper()}] {type_desc}")

    if label:
        parts.append(f"Name: {label}")

    # ── 2. DSL source (always included) ───────────────────────────────────
    parts.append(f"DSL: {dsl_source}")

    # ── 3. AST-driven semantic expansion ──────────────────────────────────
    if ast_node is None and dsl_source:
        ast_node = _try_parse(dsl_source)

    if ast_node is not None:
        semantic = _expand_ast_semantics(ast_node, node_type)
        if semantic:
            parts.append(semantic)

    # ── 4. Properties & domain ────────────────────────────────────────────
    if props:
        prop_text = _format_properties(props, node_type)
        if prop_text:
            parts.append(prop_text)

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════════════
# Type descriptions
# ═══════════════════════════════════════════════════════════════════════════════

_TYPE_DESCRIPTIONS = {
    "axiom": "Immutable foundational truth. Cannot be modified or contradicted.",
    "deduction_rule": "Mutable inference rule (Hilbert-style). Transforms premises into conclusions.",
    "fact": "Asserted ground truth about a specific domain entity or relation.",
    "theorem": "Derived statement proven from axioms and rules. Has a proof trace.",
    "entity": "Domain object with typed properties (microservice, screen, button, workflow, etc.).",
    "procedure": "Ordered sequence of steps with preconditions and effects.",
    "predicate": "Boolean-valued function defining a property or relation over entities.",
    "conversation": "Learned procedure extracted from a resolved customer conversation.",
}


# ═══════════════════════════════════════════════════════════════════════════════
# AST helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _try_parse(dsl_source: str) -> DSLNode | None:
    try:
        from ..dsl import DSLParser
        parser = DSLParser()
        nodes = parser.parse(dsl_source)
        return nodes[0] if nodes else None
    except Exception:
        return None


def _expand_ast_semantics(node: DSLNode, node_type: str) -> str:
    """Recursively expand AST semantics into natural-language description."""
    parts: list[str] = []

    if isinstance(node, AxiomNode):
        parts.append(f"Axiom '{node.name}' asserts:")
        parts.append(_describe_expr(node.expr))
        entities = _collect_entities(node.expr)
        if entities:
            parts.append(f"Evaluation domain: {', '.join(sorted(entities))}")
        predicates = _collect_predicates(node.expr)
        if predicates:
            parts.append(f"Predicates used: {', '.join(sorted(predicates))}")

    elif isinstance(node, RuleNode):
        parts.append(f"Rule '{node.name}':")
        parts.append(f"  IF: {', '.join(_describe_expr(p) for p in node.premises)}")
        parts.append(f"  THEN: {_describe_expr(node.conclusion)}")
        predicates = set()
        for p in node.premises:
            predicates |= _collect_predicates(p)
        predicates |= _collect_predicates(node.conclusion)
        if predicates:
            parts.append(f"Predicates involved: {', '.join(sorted(predicates))}")

    elif isinstance(node, ProcedureNode):
        parts.append(f"Procedure '{node.name}':")
        if node.precond:
            parts.append(f"  Precondition: {_describe_expr(node.precond)}")
        for step_name, step_expr in node.steps:
            parts.append(f"  Step '{step_name}': {_describe_expr(step_expr)}")

    elif isinstance(node, PredicateNode):
        parts.append(_describe_predicate_deeply(node))

    elif isinstance(node, (BinaryOpNode, NotNode, QuantifiedNode)):
        parts.append(f"Compound statement: {_describe_expr(node)}")
        entities = _collect_entities(node)
        predicates = _collect_predicates(node)
        if entities:
            parts.append(f"Entities referenced: {', '.join(sorted(entities))}")
        if predicates:
            parts.append(f"Predicates referenced: {', '.join(sorted(predicates))}")

    return "\n".join(parts)


def _describe_expr(node: Any, depth: int = 0) -> str:
    """Convert an AST expression to a readable description."""
    if node is None:
        return "(empty)"
    if isinstance(node, AxiomNode):
        return f"AXIOM {node.name}: {_describe_expr(node.expr, depth + 1)}"
    if isinstance(node, RuleNode):
        prems = " AND ".join(_describe_expr(p, depth + 1) for p in node.premises)
        return f"RULE {node.name}: IF {prems} THEN {_describe_expr(node.conclusion, depth + 1)}"
    if isinstance(node, PredicateNode):
        args = ", ".join(_describe_expr(a, depth + 1) for a in node.args)
        return f"{node.name}({args})"
    if isinstance(node, BinaryOpNode):
        left = _describe_expr(node.left, depth + 1)
        right = _describe_expr(node.right, depth + 1)
        return f"({left} {node.op} {right})"
    if isinstance(node, NotNode):
        return f"NOT {_describe_expr(node.operand, depth + 1)}"
    if isinstance(node, QuantifiedNode):
        vars_ = ", ".join(node.variables)
        body = _describe_expr(node.body, depth + 1)
        return f"{node.quantifier} {vars_}. {body}"
    if isinstance(node, VarNode):
        return node.name
    if isinstance(node, LiteralNode):
        return repr(node.value)
    if isinstance(node, SubstNode):
        return f"SUBST({_describe_expr(node.expr, depth + 1)}, {node.var} := {_describe_expr(node.replacement, depth + 1)})"
    if isinstance(node, MatchNode):
        return f"MATCH on {_describe_expr(node.subject, depth + 1)}"
    return str(node)


def _describe_predicate_deeply(node: PredicateNode) -> str:
    """Describe a predicate with its evaluation semantics."""
    args = ", ".join(_describe_expr(a) for a in node.args)
    lines = [f"Predicate {node.name}({args})"]
    lines.append(f"  Evaluates: whether {node.name} holds for ({args})")

    # Describe the argument domain
    for i, arg in enumerate(node.args):
        if isinstance(arg, LiteralNode):
            lines.append(f"  Arg {i}: literal value {repr(arg.value)}")
        elif isinstance(arg, VarNode):
            lines.append(f"  Arg {i}: variable {arg.name} (universally/existentially bound)")
    return "\n".join(lines)


def _collect_predicates(node: Any) -> set[str]:
    """Collect all predicate names referenced in an expression."""
    preds: set[str] = set()
    if isinstance(node, PredicateNode):
        preds.add(node.name)
        for a in node.args:
            preds |= _collect_predicates(a)
    elif isinstance(node, BinaryOpNode):
        preds |= _collect_predicates(node.left)
        preds |= _collect_predicates(node.right)
    elif isinstance(node, NotNode):
        preds |= _collect_predicates(node.operand)
    elif isinstance(node, QuantifiedNode):
        preds |= _collect_predicates(node.body)
    elif isinstance(node, AxiomNode):
        preds |= _collect_predicates(node.expr)
    elif isinstance(node, RuleNode):
        for p in node.premises:
            preds |= _collect_predicates(p)
        preds |= _collect_predicates(node.conclusion)
    elif isinstance(node, ProcedureNode):
        if node.precond:
            preds |= _collect_predicates(node.precond)
        for _, step_expr in node.steps:
            preds |= _collect_predicates(step_expr)
    return preds


def _collect_entities(node: Any) -> set[str]:
    """Collect all literal entity references in an expression."""
    entities: set[str] = set()
    if isinstance(node, LiteralNode):
        if isinstance(node.value, str):
            entities.add(node.value)
    elif isinstance(node, PredicateNode):
        for a in node.args:
            entities |= _collect_entities(a)
    elif isinstance(node, BinaryOpNode):
        entities |= _collect_entities(node.left)
        entities |= _collect_entities(node.right)
    elif isinstance(node, NotNode):
        entities |= _collect_entities(node.operand)
    elif isinstance(node, QuantifiedNode):
        entities |= _collect_entities(node.body)
    elif isinstance(node, AxiomNode):
        entities |= _collect_entities(node.expr)
    elif isinstance(node, RuleNode):
        for p in node.premises:
            entities |= _collect_entities(p)
        entities |= _collect_entities(node.conclusion)
    elif isinstance(node, ProcedureNode):
        if node.precond:
            entities |= _collect_entities(node.precond)
        for _, step_expr in node.steps:
            entities |= _collect_entities(step_expr)
    return entities


# ═══════════════════════════════════════════════════════════════════════════════
# Property formatting
# ═══════════════════════════════════════════════════════════════════════════════

_SKIP_PROPS = {"dsl_source", "embedding", "embedding_text"}


def _format_properties(props: dict[str, Any], node_type: str) -> str:
    filtered = {k: v for k, v in props.items() if k not in _SKIP_PROPS and v}
    if not filtered:
        return ""
    lines = ["Properties:"]
    for k, v in filtered.items():
        lines.append(f"  {k}: {v}")
    return "\n".join(lines)
