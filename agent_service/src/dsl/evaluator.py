"""
DSL Evaluator
=============
Evaluates, simplifies, and applies deduction rules to DSL AST nodes.

Implements:
  - Expression simplification (tautology / contradiction elimination)
  - Modus ponens and modus tollens
  - Substitution rules
  - Pattern matching
  - Universal instantiation / existential generalisation
  - Context shifting
"""
from __future__ import annotations

import copy
import logging
from dataclasses import dataclass, field
from typing import Any

from .parser import (
    AxiomNode, RuleNode, ProcedureNode, MetaLinkNode,
    ContextShiftNode, ContextEmbedNode, SubstNode,
    QuantifiedNode, BinaryOpNode, NotNode,
    PredicateNode, VarNode, LiteralNode, MatchNode,
)

logger = logging.getLogger(__name__)


@dataclass
class EvaluationContext:
    """
    Holds the running state during DSL evaluation.

    - *axioms*     : named axioms (truth database)
    - *rules*      : named deduction rules
    - *procedures* : named AOP procedures
    - *meta_links* : meta-graph edges
    - *bindings*   : variable → expression bindings
    - *active_ctx* : name of the currently active graph context
    - *contexts*   : graph context stacks
    """
    axioms: dict[str, Any] = field(default_factory=dict)
    rules: dict[str, Any] = field(default_factory=dict)
    procedures: dict[str, Any] = field(default_factory=dict)
    meta_links: list[MetaLinkNode] = field(default_factory=list)
    bindings: dict[str, Any] = field(default_factory=dict)
    active_ctx: str = "default"
    contexts: dict[str, list[Any]] = field(default_factory=lambda: {"default": []})

    # Deduction step counter (guards against infinite loops)
    _steps: int = 0

    def bind(self, var_name: str, expr: Any) -> None:
        self.bindings[var_name] = expr

    def lookup(self, var_name: str) -> Any | None:
        return self.bindings.get(var_name)

    def add_to_context(self, expr: Any) -> None:
        self.contexts.setdefault(self.active_ctx, []).append(expr)

    def shift_context(self, name: str) -> None:
        self.active_ctx = name
        self.contexts.setdefault(name, [])

    def embed_context(self, name: str, expr: Any) -> None:
        self.contexts.setdefault(name, []).append(expr)


class DSLEvaluator:
    """
    Evaluates a sequence of DSL AST nodes produced by :class:`DSLParser`.

    Returns the final simplified expression (AOP) as an AST node.
    """

    def __init__(self, max_steps: int = 100) -> None:
        self._max_steps = max_steps

    # ── Public API ────────────────────────────────────────────────────────────

    def evaluate(self, nodes: list[Any], ctx: EvaluationContext | None = None) -> EvaluationContext:
        """Process *nodes* and return the (mutated) context."""
        if ctx is None:
            ctx = EvaluationContext()

        for node in nodes:
            ctx._steps = 0
            self._eval_statement(node, ctx)

        return ctx

    def simplify(self, expr: Any, ctx: EvaluationContext) -> Any:
        """Simplify a single expression, applying axioms and rules."""
        return self._simplify(expr, ctx, depth=0)

    def substitute(self, expr: Any, var_name: str, replacement: Any) -> Any:
        """Replace all occurrences of *var_name* in *expr* with *replacement*."""
        return self._substitute(expr, var_name, replacement)

    # ── Statement dispatch ────────────────────────────────────────────────────

    def _eval_statement(self, node: Any, ctx: EvaluationContext) -> None:
        if isinstance(node, AxiomNode):
            ctx.axioms[node.name] = node.expr
            ctx.add_to_context(node)

        elif isinstance(node, RuleNode):
            ctx.rules[node.name] = node
            ctx.add_to_context(node)

        elif isinstance(node, ProcedureNode):
            ctx.procedures[node.name] = node
            ctx.add_to_context(node)

        elif isinstance(node, MetaLinkNode):
            ctx.meta_links.append(node)

        elif isinstance(node, ContextShiftNode):
            ctx.shift_context(node.context_name)

        elif isinstance(node, ContextEmbedNode):
            simplified = self._simplify(node.expr, ctx, depth=0)
            ctx.embed_context(node.context_name, simplified)

        elif isinstance(node, SubstNode):
            result = self._substitute(node.expr, node.var, node.replacement)
            ctx.add_to_context(result)

        else:
            # Bare expression statement — simplify and store
            simplified = self._simplify(node, ctx, depth=0)
            ctx.add_to_context(simplified)

    # ── Simplification ────────────────────────────────────────────────────────

    def _simplify(self, expr: Any, ctx: EvaluationContext, depth: int) -> Any:
        if depth > self._max_steps:
            logger.warning("DSL simplification depth limit reached")
            return expr

        if isinstance(expr, LiteralNode):
            return expr

        if isinstance(expr, VarNode):
            bound = ctx.lookup(expr.name)
            return self._simplify(bound, ctx, depth + 1) if bound is not None else expr

        if isinstance(expr, NotNode):
            return self._simplify_not(expr, ctx, depth)

        if isinstance(expr, BinaryOpNode):
            return self._simplify_binop(expr, ctx, depth)

        if isinstance(expr, QuantifiedNode):
            body = self._simplify(expr.body, ctx, depth + 1)
            return QuantifiedNode(quantifier=expr.quantifier, variables=expr.variables, body=body)

        if isinstance(expr, PredicateNode):
            args = [self._simplify(a, ctx, depth + 1) for a in expr.args]
            return PredicateNode(name=expr.name, args=args)

        if isinstance(expr, MatchNode):
            return self._simplify_match(expr, ctx, depth)

        # Try rule application
        derived = self._apply_rules(expr, ctx, depth)
        if derived is not expr:
            return self._simplify(derived, ctx, depth + 1)

        return expr

    def _simplify_not(self, node: NotNode, ctx: EvaluationContext, depth: int) -> Any:
        operand = self._simplify(node.operand, ctx, depth + 1)
        # NOT NOT X  →  X
        if isinstance(operand, NotNode):
            return self._simplify(operand.operand, ctx, depth + 1)
        # NOT true  →  false
        if isinstance(operand, LiteralNode) and operand.value is True:
            return LiteralNode(value=False)
        # NOT false  →  true
        if isinstance(operand, LiteralNode) and operand.value is False:
            return LiteralNode(value=True)
        return NotNode(operand=operand)

    def _simplify_binop(self, node: BinaryOpNode, ctx: EvaluationContext, depth: int) -> Any:
        left = self._simplify(node.left, ctx, depth + 1)
        right = self._simplify(node.right, ctx, depth + 1)
        op = node.op

        # Short-circuit with literals
        if op == "AND":
            if _is_false(left) or _is_false(right): return LiteralNode(value=False)
            if _is_true(left):  return right
            if _is_true(right): return left

        elif op == "OR":
            if _is_true(left) or _is_true(right): return LiteralNode(value=True)
            if _is_false(left):  return right
            if _is_false(right): return left

        elif op == "IMPLIES":
            if _is_false(left): return LiteralNode(value=True)   # ex falso
            if _is_true(left):  return right
            if _is_true(right): return LiteralNode(value=True)

        elif op == "IFF":
            if _is_true(left) and _is_true(right):   return LiteralNode(value=True)
            if _is_false(left) and _is_false(right):  return LiteralNode(value=True)
            if _is_true(left):  return right
            if _is_true(right): return left

        elif op == "XOR":
            if _is_false(left): return right
            if _is_false(right): return left
            if _is_true(left) and _is_true(right):  return LiteralNode(value=False)

        return BinaryOpNode(op=op, left=left, right=right)

    def _simplify_match(self, node: MatchNode, ctx: EvaluationContext, depth: int) -> Any:
        subject = self._simplify(node.subject, ctx, depth + 1)
        for pattern, result in node.arms:
            bindings = _match_pattern(pattern, subject)
            if bindings is not None:
                local_ctx = copy.deepcopy(ctx)
                for var_name, val in bindings.items():
                    local_ctx.bind(var_name, val)
                return self._simplify(result, local_ctx, depth + 1)
        return node  # no arm matched

    # ── Rule application (modus ponens) ──────────────────────────────────────

    def _apply_rules(self, expr: Any, ctx: EvaluationContext, depth: int) -> Any:
        for rule in ctx.rules.values():
            derived = self._try_modus_ponens(rule, expr, ctx, depth)
            if derived is not None:
                return derived
        return expr

    def _try_modus_ponens(self, rule: RuleNode, expr: Any, ctx: EvaluationContext, depth: int) -> Any | None:
        """Return derived expression if modus ponens fires, else None."""
        bindings: dict[str, Any] = {}
        # Check each premise against the expression
        for premise in rule.premises:
            b = _match_pattern(premise, expr)
            if b is None:
                return None
            bindings.update(b)
        # All premises matched — apply bindings to conclusion
        conclusion = copy.deepcopy(rule.conclusion)
        for var_name, val in bindings.items():
            conclusion = self._substitute(conclusion, var_name, val)
        return conclusion

    # ── Substitution ─────────────────────────────────────────────────────────

    def _substitute(self, expr: Any, var_name: str, replacement: Any) -> Any:
        if isinstance(expr, VarNode):
            return copy.deepcopy(replacement) if expr.name == var_name else expr
        if isinstance(expr, NotNode):
            return NotNode(operand=self._substitute(expr.operand, var_name, replacement))
        if isinstance(expr, BinaryOpNode):
            return BinaryOpNode(
                op=expr.op,
                left=self._substitute(expr.left, var_name, replacement),
                right=self._substitute(expr.right, var_name, replacement),
            )
        if isinstance(expr, QuantifiedNode):
            if var_name in expr.variables:
                return expr   # variable is bound by quantifier — no free occurrence
            return QuantifiedNode(
                quantifier=expr.quantifier,
                variables=expr.variables,
                body=self._substitute(expr.body, var_name, replacement),
            )
        if isinstance(expr, PredicateNode):
            return PredicateNode(
                name=expr.name,
                args=[self._substitute(a, var_name, replacement) for a in expr.args],
            )
        if isinstance(expr, MatchNode):
            return MatchNode(
                subject=self._substitute(expr.subject, var_name, replacement),
                arms=[(p, self._substitute(r, var_name, replacement)) for p, r in expr.arms],
            )
        return expr  # LiteralNode, str, etc. — no substitution needed


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_true(expr: Any) -> bool:
    return isinstance(expr, LiteralNode) and expr.value is True


def _is_false(expr: Any) -> bool:
    return isinstance(expr, LiteralNode) and expr.value is False


def _match_pattern(pattern: Any, subject: Any) -> dict[str, Any] | None:
    """
    Attempt to match *subject* against *pattern*.

    Returns a dict of variable bindings on success, or None on failure.
    """
    if isinstance(pattern, str) and pattern == "_":
        return {}   # wildcard — always matches, no bindings

    if isinstance(pattern, VarNode):
        return {pattern.name: subject}   # variable — binds to subject

    if isinstance(pattern, PredicateNode) and isinstance(subject, PredicateNode):
        if pattern.name != subject.name or len(pattern.args) != len(subject.args):
            return None
        bindings: dict[str, Any] = {}
        for p_arg, s_arg in zip(pattern.args, subject.args):
            sub = _match_pattern(p_arg, s_arg)
            if sub is None:
                return None
            bindings.update(sub)
        return bindings

    if isinstance(pattern, LiteralNode) and isinstance(subject, LiteralNode):
        return {} if pattern.value == subject.value else None

    return None
