"""
AOP Symbolic Simplifier
=======================
A term-rewriting engine that performs algebraic simplification and
transformation on DSL AST nodes. This is more reliable and faster
than LLM-based transformation since it operates directly on the AST.

The simplifier implements the foundational deduction rules:
- Logical simplification (double negation, De Morgan, etc.)
- AOP combination (AND/OR simplification)
- Implication transformations
- Connection deduction
- Quantifier manipulation

Usage::

    from src.dsl import DSLParser
    from src.agents.aop_simplifier import AOPSimplifier

    parser = DSLParser()
    simplifier = AOPSimplifier()

    nodes = parser.parse("NOT(NOT(A(?x)))")
    simplified = simplifier.simplify(nodes[0])
    dsl_text = simplifier.to_dsl(simplified)  # "A(?x)"
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable
from copy import deepcopy

from ..dsl.parser import (
    DSLNode,
    AxiomNode,
    RuleNode,
    ProcedureNode,
    BinaryOpNode,
    NotNode,
    PredicateNode,
    VarNode,
    LiteralNode,
    QuantifiedNode,
    SubstNode,
    MatchNode,
    ContextEmbedNode,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Rewrite Rule Definitions
# ═══════════════════════════════════════════════════════════════════════════════

class RuleCategory(str, Enum):
    """Categories of rewrite rules."""
    LOGICAL = "logical"
    AOP_COMBINE = "aop_combine"
    IMPLICATION = "implication"
    QUANTIFIER = "quantifier"
    IDENTITY = "identity"
    ABSORPTION = "absorption"


@dataclass
class RewriteRule:
    """A single rewrite rule with pattern matcher and transformer."""
    name: str
    category: RuleCategory
    description: str
    matcher: Callable[[Any], bool]
    transformer: Callable[[Any], Any]
    priority: int = 0  # Higher priority rules applied first


# ═══════════════════════════════════════════════════════════════════════════════
# AST Utilities
# ═══════════════════════════════════════════════════════════════════════════════

def ast_equal(a: Any, b: Any) -> bool:
    """Check if two AST nodes are structurally equal."""
    if type(a) != type(b):
        return False
    
    if isinstance(a, (LiteralNode, VarNode)):
        return a.value == b.value if isinstance(a, LiteralNode) else a.name == b.name
    
    if isinstance(a, PredicateNode):
        if a.name != b.name or len(a.args) != len(b.args):
            return False
        return all(ast_equal(x, y) for x, y in zip(a.args, b.args))
    
    if isinstance(a, BinaryOpNode):
        return a.op == b.op and ast_equal(a.left, b.left) and ast_equal(a.right, b.right)
    
    if isinstance(a, NotNode):
        return ast_equal(a.operand, b.operand)
    
    if isinstance(a, QuantifiedNode):
        return (a.quantifier == b.quantifier and 
                a.variables == b.variables and 
                ast_equal(a.body, b.body))
    
    # Fallback: compare string representations
    return str(a) == str(b)


def contains_node(tree: Any, target: Any) -> bool:
    """Check if tree contains target as a subtree."""
    if ast_equal(tree, target):
        return True
    
    if isinstance(tree, BinaryOpNode):
        return contains_node(tree.left, target) or contains_node(tree.right, target)
    
    if isinstance(tree, NotNode):
        return contains_node(tree.operand, target)
    
    if isinstance(tree, QuantifiedNode):
        return contains_node(tree.body, target)
    
    if isinstance(tree, PredicateNode):
        return any(contains_node(arg, target) for arg in tree.args)
    
    return False


def collect_operands(node: Any, op: str) -> list[Any]:
    """Collect all operands of an associative operator (AND/OR)."""
    if isinstance(node, BinaryOpNode) and node.op == op:
        return collect_operands(node.left, op) + collect_operands(node.right, op)
    return [node]


def build_binary_tree(operands: list[Any], op: str) -> Any:
    """Build a left-associative binary tree from operands."""
    if not operands:
        return None
    if len(operands) == 1:
        return operands[0]
    result = operands[0]
    for operand in operands[1:]:
        result = BinaryOpNode(op=op, left=result, right=operand)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Pattern Matchers
# ═══════════════════════════════════════════════════════════════════════════════

def is_double_negation(node: Any) -> bool:
    """Match NOT(NOT(X))"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, NotNode))


def is_not_and(node: Any) -> bool:
    """Match NOT(A AND B) for De Morgan"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, BinaryOpNode) and 
            node.operand.op == "AND")


def is_not_or(node: Any) -> bool:
    """Match NOT(A OR B) for De Morgan"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, BinaryOpNode) and 
            node.operand.op == "OR")


def is_and_identity_true(node: Any) -> bool:
    """Match A AND TRUE"""
    if isinstance(node, BinaryOpNode) and node.op == "AND":
        return (_is_true_literal(node.left) or _is_true_literal(node.right))
    return False


def is_and_identity_false(node: Any) -> bool:
    """Match A AND FALSE"""
    if isinstance(node, BinaryOpNode) and node.op == "AND":
        return (_is_false_literal(node.left) or _is_false_literal(node.right))
    return False


def is_or_identity_true(node: Any) -> bool:
    """Match A OR TRUE"""
    if isinstance(node, BinaryOpNode) and node.op == "OR":
        return (_is_true_literal(node.left) or _is_true_literal(node.right))
    return False


def is_or_identity_false(node: Any) -> bool:
    """Match A OR FALSE"""
    if isinstance(node, BinaryOpNode) and node.op == "OR":
        return (_is_false_literal(node.left) or _is_false_literal(node.right))
    return False


def is_idempotent_and(node: Any) -> bool:
    """Match A AND A"""
    if isinstance(node, BinaryOpNode) and node.op == "AND":
        return ast_equal(node.left, node.right)
    return False


def is_idempotent_or(node: Any) -> bool:
    """Match A OR A"""
    if isinstance(node, BinaryOpNode) and node.op == "OR":
        return ast_equal(node.left, node.right)
    return False


def is_complement_and(node: Any) -> bool:
    """Match A AND NOT(A)"""
    if isinstance(node, BinaryOpNode) and node.op == "AND":
        if isinstance(node.right, NotNode) and ast_equal(node.left, node.right.operand):
            return True
        if isinstance(node.left, NotNode) and ast_equal(node.right, node.left.operand):
            return True
    return False


def is_complement_or(node: Any) -> bool:
    """Match A OR NOT(A)"""
    if isinstance(node, BinaryOpNode) and node.op == "OR":
        if isinstance(node.right, NotNode) and ast_equal(node.left, node.right.operand):
            return True
        if isinstance(node.left, NotNode) and ast_equal(node.right, node.left.operand):
            return True
    return False


def is_absorption_and_or(node: Any) -> bool:
    """Match A AND (A OR B) => A"""
    if isinstance(node, BinaryOpNode) and node.op == "AND":
        if isinstance(node.right, BinaryOpNode) and node.right.op == "OR":
            if ast_equal(node.left, node.right.left) or ast_equal(node.left, node.right.right):
                return True
        if isinstance(node.left, BinaryOpNode) and node.left.op == "OR":
            if ast_equal(node.right, node.left.left) or ast_equal(node.right, node.left.right):
                return True
    return False


def is_absorption_or_and(node: Any) -> bool:
    """Match A OR (A AND B) => A"""
    if isinstance(node, BinaryOpNode) and node.op == "OR":
        if isinstance(node.right, BinaryOpNode) and node.right.op == "AND":
            if ast_equal(node.left, node.right.left) or ast_equal(node.left, node.right.right):
                return True
        if isinstance(node.left, BinaryOpNode) and node.left.op == "AND":
            if ast_equal(node.right, node.left.left) or ast_equal(node.right, node.left.right):
                return True
    return False


def is_implication(node: Any) -> bool:
    """Match A IMPLIES B"""
    return isinstance(node, BinaryOpNode) and node.op == "IMPLIES"


def is_not_implies(node: Any) -> bool:
    """Match NOT(A IMPLIES B) => A AND NOT(B)"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, BinaryOpNode) and 
            node.operand.op == "IMPLIES")


def is_contrapositive_pattern(node: Any) -> bool:
    """Match A IMPLIES B where we can derive NOT(B) IMPLIES NOT(A)"""
    return isinstance(node, BinaryOpNode) and node.op == "IMPLIES"


def is_duplicate_in_chain(node: Any) -> bool:
    """Check if an AND/OR chain has duplicate operands."""
    if isinstance(node, BinaryOpNode) and node.op in ("AND", "OR"):
        operands = collect_operands(node, node.op)
        seen = []
        for op in operands:
            for s in seen:
                if ast_equal(op, s):
                    return True
            seen.append(op)
    return False


def is_not_forall(node: Any) -> bool:
    """Match NOT(FORALL ?x: P(?x)) => EXISTS ?x: NOT(P(?x))"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, QuantifiedNode) and 
            node.operand.quantifier == "FORALL")


def is_not_exists(node: Any) -> bool:
    """Match NOT(EXISTS ?x: P(?x)) => FORALL ?x: NOT(P(?x))"""
    return (isinstance(node, NotNode) and 
            isinstance(node.operand, QuantifiedNode) and 
            node.operand.quantifier == "EXISTS")


def is_forall_and(node: Any) -> bool:
    """Match FORALL ?x: (A(?x) AND B(?x)) => (FORALL ?x: A(?x)) AND (FORALL ?x: B(?x))"""
    return (isinstance(node, QuantifiedNode) and 
            node.quantifier == "FORALL" and 
            isinstance(node.body, BinaryOpNode) and 
            node.body.op == "AND")


def is_exists_or(node: Any) -> bool:
    """Match EXISTS ?x: (A(?x) OR B(?x)) => (EXISTS ?x: A(?x)) OR (EXISTS ?x: B(?x))"""
    return (isinstance(node, QuantifiedNode) and 
            node.quantifier == "EXISTS" and 
            isinstance(node.body, BinaryOpNode) and 
            node.body.op == "OR")


def _is_true_literal(node: Any) -> bool:
    return isinstance(node, LiteralNode) and node.value is True


def _is_false_literal(node: Any) -> bool:
    return isinstance(node, LiteralNode) and node.value is False


# ═══════════════════════════════════════════════════════════════════════════════
# Transformers
# ═══════════════════════════════════════════════════════════════════════════════

def transform_double_negation(node: NotNode) -> Any:
    """NOT(NOT(X)) => X"""
    return deepcopy(node.operand.operand)


def transform_de_morgan_and(node: NotNode) -> BinaryOpNode:
    """NOT(A AND B) => NOT(A) OR NOT(B)"""
    inner = node.operand
    return BinaryOpNode(
        op="OR",
        left=NotNode(operand=deepcopy(inner.left)),
        right=NotNode(operand=deepcopy(inner.right))
    )


def transform_de_morgan_or(node: NotNode) -> BinaryOpNode:
    """NOT(A OR B) => NOT(A) AND NOT(B)"""
    inner = node.operand
    return BinaryOpNode(
        op="AND",
        left=NotNode(operand=deepcopy(inner.left)),
        right=NotNode(operand=deepcopy(inner.right))
    )


def transform_and_true(node: BinaryOpNode) -> Any:
    """A AND TRUE => A"""
    if _is_true_literal(node.left):
        return deepcopy(node.right)
    return deepcopy(node.left)


def transform_and_false(node: BinaryOpNode) -> LiteralNode:
    """A AND FALSE => FALSE"""
    return LiteralNode(value=False)


def transform_or_true(node: BinaryOpNode) -> LiteralNode:
    """A OR TRUE => TRUE"""
    return LiteralNode(value=True)


def transform_or_false(node: BinaryOpNode) -> Any:
    """A OR FALSE => A"""
    if _is_false_literal(node.left):
        return deepcopy(node.right)
    return deepcopy(node.left)


def transform_idempotent(node: BinaryOpNode) -> Any:
    """A AND A => A, A OR A => A"""
    return deepcopy(node.left)


def transform_complement_and(node: BinaryOpNode) -> LiteralNode:
    """A AND NOT(A) => FALSE"""
    return LiteralNode(value=False)


def transform_complement_or(node: BinaryOpNode) -> LiteralNode:
    """A OR NOT(A) => TRUE"""
    return LiteralNode(value=True)


def transform_absorption_and_or(node: BinaryOpNode) -> Any:
    """A AND (A OR B) => A"""
    if isinstance(node.right, BinaryOpNode) and node.right.op == "OR":
        if ast_equal(node.left, node.right.left) or ast_equal(node.left, node.right.right):
            return deepcopy(node.left)
    if isinstance(node.left, BinaryOpNode) and node.left.op == "OR":
        if ast_equal(node.right, node.left.left) or ast_equal(node.right, node.left.right):
            return deepcopy(node.right)
    return node


def transform_absorption_or_and(node: BinaryOpNode) -> Any:
    """A OR (A AND B) => A"""
    if isinstance(node.right, BinaryOpNode) and node.right.op == "AND":
        if ast_equal(node.left, node.right.left) or ast_equal(node.left, node.right.right):
            return deepcopy(node.left)
    if isinstance(node.left, BinaryOpNode) and node.left.op == "AND":
        if ast_equal(node.right, node.left.left) or ast_equal(node.right, node.left.right):
            return deepcopy(node.right)
    return node


def transform_implication_to_disjunction(node: BinaryOpNode) -> BinaryOpNode:
    """A IMPLIES B => NOT(A) OR B"""
    return BinaryOpNode(
        op="OR",
        left=NotNode(operand=deepcopy(node.left)),
        right=deepcopy(node.right)
    )


def transform_not_implies(node: NotNode) -> BinaryOpNode:
    """NOT(A IMPLIES B) => A AND NOT(B)"""
    inner = node.operand
    return BinaryOpNode(
        op="AND",
        left=deepcopy(inner.left),
        right=NotNode(operand=deepcopy(inner.right))
    )


def transform_remove_duplicates(node: BinaryOpNode) -> Any:
    """Remove duplicate operands from AND/OR chains."""
    operands = collect_operands(node, node.op)
    unique = []
    for op in operands:
        is_dup = False
        for u in unique:
            if ast_equal(op, u):
                is_dup = True
                break
        if not is_dup:
            unique.append(op)
    return build_binary_tree(unique, node.op)


def transform_not_forall(node: NotNode) -> QuantifiedNode:
    """NOT(FORALL ?x: P(?x)) => EXISTS ?x: NOT(P(?x))"""
    inner = node.operand
    return QuantifiedNode(
        quantifier="EXISTS",
        variables=list(inner.variables),
        body=NotNode(operand=deepcopy(inner.body))
    )


def transform_not_exists(node: NotNode) -> QuantifiedNode:
    """NOT(EXISTS ?x: P(?x)) => FORALL ?x: NOT(P(?x))"""
    inner = node.operand
    return QuantifiedNode(
        quantifier="FORALL",
        variables=list(inner.variables),
        body=NotNode(operand=deepcopy(inner.body))
    )


def transform_forall_and(node: QuantifiedNode) -> BinaryOpNode:
    """FORALL ?x: (A AND B) => (FORALL ?x: A) AND (FORALL ?x: B)"""
    return BinaryOpNode(
        op="AND",
        left=QuantifiedNode(
            quantifier="FORALL",
            variables=list(node.variables),
            body=deepcopy(node.body.left)
        ),
        right=QuantifiedNode(
            quantifier="FORALL",
            variables=list(node.variables),
            body=deepcopy(node.body.right)
        )
    )


def transform_exists_or(node: QuantifiedNode) -> BinaryOpNode:
    """EXISTS ?x: (A OR B) => (EXISTS ?x: A) OR (EXISTS ?x: B)"""
    return BinaryOpNode(
        op="OR",
        left=QuantifiedNode(
            quantifier="EXISTS",
            variables=list(node.variables),
            body=deepcopy(node.body.left)
        ),
        right=QuantifiedNode(
            quantifier="EXISTS",
            variables=list(node.variables),
            body=deepcopy(node.body.right)
        )
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Built-in Rewrite Rules
# ═══════════════════════════════════════════════════════════════════════════════

BUILTIN_RULES: list[RewriteRule] = [
    # Logical simplification (high priority)
    RewriteRule(
        name="double_negation",
        category=RuleCategory.LOGICAL,
        description="NOT(NOT(X)) => X",
        matcher=is_double_negation,
        transformer=transform_double_negation,
        priority=100,
    ),
    RewriteRule(
        name="complement_and",
        category=RuleCategory.LOGICAL,
        description="A AND NOT(A) => FALSE",
        matcher=is_complement_and,
        transformer=transform_complement_and,
        priority=95,
    ),
    RewriteRule(
        name="complement_or",
        category=RuleCategory.LOGICAL,
        description="A OR NOT(A) => TRUE",
        matcher=is_complement_or,
        transformer=transform_complement_or,
        priority=95,
    ),
    
    # Identity rules (high priority)
    RewriteRule(
        name="and_false",
        category=RuleCategory.IDENTITY,
        description="A AND FALSE => FALSE",
        matcher=is_and_identity_false,
        transformer=transform_and_false,
        priority=90,
    ),
    RewriteRule(
        name="or_true",
        category=RuleCategory.IDENTITY,
        description="A OR TRUE => TRUE",
        matcher=is_or_identity_true,
        transformer=transform_or_true,
        priority=90,
    ),
    RewriteRule(
        name="and_true",
        category=RuleCategory.IDENTITY,
        description="A AND TRUE => A",
        matcher=is_and_identity_true,
        transformer=transform_and_true,
        priority=85,
    ),
    RewriteRule(
        name="or_false",
        category=RuleCategory.IDENTITY,
        description="A OR FALSE => A",
        matcher=is_or_identity_false,
        transformer=transform_or_false,
        priority=85,
    ),
    
    # Idempotent rules
    RewriteRule(
        name="idempotent_and",
        category=RuleCategory.AOP_COMBINE,
        description="A AND A => A",
        matcher=is_idempotent_and,
        transformer=transform_idempotent,
        priority=80,
    ),
    RewriteRule(
        name="idempotent_or",
        category=RuleCategory.AOP_COMBINE,
        description="A OR A => A",
        matcher=is_idempotent_or,
        transformer=transform_idempotent,
        priority=80,
    ),
    
    # Absorption rules
    RewriteRule(
        name="absorption_and_or",
        category=RuleCategory.ABSORPTION,
        description="A AND (A OR B) => A",
        matcher=is_absorption_and_or,
        transformer=transform_absorption_and_or,
        priority=75,
    ),
    RewriteRule(
        name="absorption_or_and",
        category=RuleCategory.ABSORPTION,
        description="A OR (A AND B) => A",
        matcher=is_absorption_or_and,
        transformer=transform_absorption_or_and,
        priority=75,
    ),
    
    # De Morgan's laws (lower priority - expansion)
    RewriteRule(
        name="de_morgan_and",
        category=RuleCategory.LOGICAL,
        description="NOT(A AND B) => NOT(A) OR NOT(B)",
        matcher=is_not_and,
        transformer=transform_de_morgan_and,
        priority=50,
    ),
    RewriteRule(
        name="de_morgan_or",
        category=RuleCategory.LOGICAL,
        description="NOT(A OR B) => NOT(A) AND NOT(B)",
        matcher=is_not_or,
        transformer=transform_de_morgan_or,
        priority=50,
    ),
    
    # Duplicate removal
    RewriteRule(
        name="remove_duplicates",
        category=RuleCategory.AOP_COMBINE,
        description="Remove duplicate operands from AND/OR chains",
        matcher=is_duplicate_in_chain,
        transformer=transform_remove_duplicates,
        priority=70,
    ),
    
    # Implication rules (low priority - transformation, not simplification)
    RewriteRule(
        name="not_implies",
        category=RuleCategory.IMPLICATION,
        description="NOT(A IMPLIES B) => A AND NOT(B)",
        matcher=is_not_implies,
        transformer=transform_not_implies,
        priority=40,
    ),
    
    # Quantifier rules
    RewriteRule(
        name="not_forall",
        category=RuleCategory.QUANTIFIER,
        description="NOT(FORALL ?x: P) => EXISTS ?x: NOT(P)",
        matcher=is_not_forall,
        transformer=transform_not_forall,
        priority=60,
    ),
    RewriteRule(
        name="not_exists",
        category=RuleCategory.QUANTIFIER,
        description="NOT(EXISTS ?x: P) => FORALL ?x: NOT(P)",
        matcher=is_not_exists,
        transformer=transform_not_exists,
        priority=60,
    ),
]


# ═══════════════════════════════════════════════════════════════════════════════
# AST to DSL Serializer
# ═══════════════════════════════════════════════════════════════════════════════

def ast_to_dsl(node: Any) -> str:
    """Convert an AST node back to DSL source text."""
    if node is None:
        return ""
    
    if isinstance(node, LiteralNode):
        if isinstance(node.value, bool):
            return "true" if node.value else "false"
        if isinstance(node.value, str):
            return f'"{node.value}"'
        return str(node.value)
    
    if isinstance(node, VarNode):
        return node.name
    
    if isinstance(node, PredicateNode):
        args = ", ".join(ast_to_dsl(arg) for arg in node.args)
        return f"{node.name}({args})" if args else f"{node.name}()"
    
    if isinstance(node, NotNode):
        operand = ast_to_dsl(node.operand)
        # Use NOT keyword for readability
        if isinstance(node.operand, BinaryOpNode):
            return f"NOT({operand})"
        return f"NOT({operand})"
    
    if isinstance(node, BinaryOpNode):
        left = ast_to_dsl(node.left)
        right = ast_to_dsl(node.right)
        # Parenthesize sub-expressions for clarity
        if isinstance(node.left, BinaryOpNode) and node.left.op != node.op:
            left = f"({left})"
        if isinstance(node.right, BinaryOpNode) and node.right.op != node.op:
            right = f"({right})"
        return f"{left} {node.op} {right}"
    
    if isinstance(node, QuantifiedNode):
        vars_str = ", ".join(node.variables)
        body = ast_to_dsl(node.body)
        return f"{node.quantifier} {vars_str}: {body}"
    
    if isinstance(node, AxiomNode):
        expr = ast_to_dsl(node.expr)
        return f"AXIOM {node.name}: {expr}."
    
    if isinstance(node, RuleNode):
        premises = "; ".join(f"IF {ast_to_dsl(p)}" for p in node.premises)
        conclusion = ast_to_dsl(node.conclusion)
        return f"RULE {node.name}: {premises}; THEN {conclusion}."
    
    if isinstance(node, ProcedureNode):
        parts = [f"PROCEDURE {node.name}"]
        if node.precond:
            parts.append(f"PRECOND {ast_to_dsl(node.precond)}")
        for step_name, step_expr in node.steps:
            parts.append(f"STEP {step_name}: {ast_to_dsl(step_expr)}")
        return " ".join(parts) + " END."
    
    if isinstance(node, SubstNode):
        return f"SUBST({ast_to_dsl(node.expr)}, {node.var}, {ast_to_dsl(node.replacement)})"
    
    # Fallback
    return str(node)


# ═══════════════════════════════════════════════════════════════════════════════
# The Simplifier Engine
# ═══════════════════════════════════════════════════════════════════════════════

class AOPSimplifier:
    """
    A term-rewriting engine for DSL AST simplification.
    
    Applies rewrite rules repeatedly until a fixed point is reached
    (no more rules apply) or a maximum iteration limit is hit.
    """
    
    def __init__(
        self,
        max_iterations: int = 100,
        rules: list[RewriteRule] | None = None,
        enable_de_morgan: bool = False,
        enable_implication_expansion: bool = False,
        enable_quantifier_distribution: bool = False,
    ) -> None:
        """
        Initialize the simplifier.
        
        Args:
            max_iterations: Maximum rewrite iterations before stopping
            rules: Custom rules (uses BUILTIN_RULES if None)
            enable_de_morgan: Enable De Morgan expansion rules
            enable_implication_expansion: Enable A IMPLIES B => NOT(A) OR B
            enable_quantifier_distribution: Enable FORALL/EXISTS distribution
        """
        self.max_iterations = max_iterations
        self._rules = list(rules) if rules else list(BUILTIN_RULES)
        
        # Filter rules based on configuration
        if not enable_de_morgan:
            self._rules = [r for r in self._rules 
                          if r.name not in ("de_morgan_and", "de_morgan_or")]
        
        if not enable_implication_expansion:
            self._rules = [r for r in self._rules 
                          if r.name != "implication_to_disjunction"]
        
        if not enable_quantifier_distribution:
            self._rules = [r for r in self._rules 
                          if r.name not in ("forall_and", "exists_or")]
        
        # Sort by priority (highest first)
        self._rules.sort(key=lambda r: r.priority, reverse=True)
        
        # Track applied rules for logging
        self._applied_rules: list[str] = []
    
    def add_rule(self, rule: RewriteRule) -> None:
        """Add a custom rewrite rule."""
        self._rules.append(rule)
        self._rules.sort(key=lambda r: r.priority, reverse=True)
    
    def simplify(self, node: Any) -> Any:
        """
        Simplify an AST node by repeatedly applying rewrite rules.
        
        Returns the simplified AST node.
        """
        self._applied_rules = []
        current = deepcopy(node)
        
        for iteration in range(self.max_iterations):
            changed = False
            new_node, did_change = self._apply_rules_recursive(current)
            
            if did_change:
                current = new_node
                changed = True
            
            if not changed:
                break
        else:
            logger.warning(
                "Simplifier reached max iterations (%d) - may not be fully simplified",
                self.max_iterations
            )
        
        return current
    
    def simplify_dsl(self, dsl_source: str) -> str:
        """
        Parse DSL source, simplify, and return DSL text.
        
        Convenience method for end-to-end simplification.
        """
        from ..dsl import DSLParser
        parser = DSLParser()
        nodes = parser.parse(dsl_source)
        
        if not nodes:
            return dsl_source
        
        simplified_nodes = [self.simplify(node) for node in nodes]
        return "\n".join(ast_to_dsl(node) for node in simplified_nodes)
    
    def get_applied_rules(self) -> list[str]:
        """Return list of rules applied in the last simplification."""
        return list(self._applied_rules)
    
    def _apply_rules_recursive(self, node: Any) -> tuple[Any, bool]:
        """
        Apply rules to a node and recursively to its children.
        
        Returns (new_node, changed).
        """
        changed = False
        
        # First, try to apply rules to this node
        for rule in self._rules:
            if rule.matcher(node):
                new_node = rule.transformer(node)
                self._applied_rules.append(rule.name)
                logger.debug("Applied rule %s: %s", rule.name, rule.description)
                return new_node, True
        
        # If no rule matched, recurse into children
        if isinstance(node, BinaryOpNode):
            new_left, left_changed = self._apply_rules_recursive(node.left)
            new_right, right_changed = self._apply_rules_recursive(node.right)
            if left_changed or right_changed:
                return BinaryOpNode(op=node.op, left=new_left, right=new_right), True
        
        elif isinstance(node, NotNode):
            new_operand, op_changed = self._apply_rules_recursive(node.operand)
            if op_changed:
                return NotNode(operand=new_operand), True
        
        elif isinstance(node, QuantifiedNode):
            new_body, body_changed = self._apply_rules_recursive(node.body)
            if body_changed:
                return QuantifiedNode(
                    quantifier=node.quantifier,
                    variables=list(node.variables),
                    body=new_body
                ), True
        
        elif isinstance(node, PredicateNode):
            new_args = []
            args_changed = False
            for arg in node.args:
                new_arg, arg_changed = self._apply_rules_recursive(arg)
                new_args.append(new_arg)
                if arg_changed:
                    args_changed = True
            if args_changed:
                return PredicateNode(name=node.name, args=new_args), True
        
        elif isinstance(node, AxiomNode):
            new_expr, expr_changed = self._apply_rules_recursive(node.expr)
            if expr_changed:
                return AxiomNode(name=node.name, expr=new_expr), True
        
        elif isinstance(node, RuleNode):
            new_premises = []
            premises_changed = False
            for p in node.premises:
                new_p, p_changed = self._apply_rules_recursive(p)
                new_premises.append(new_p)
                if p_changed:
                    premises_changed = True
            
            new_conclusion, conc_changed = self._apply_rules_recursive(node.conclusion)
            
            if premises_changed or conc_changed:
                return RuleNode(
                    name=node.name,
                    premises=new_premises,
                    conclusion=new_conclusion
                ), True
        
        return node, False
    
    def to_dsl(self, node: Any) -> str:
        """Convert an AST node to DSL source text."""
        return ast_to_dsl(node)


# ═══════════════════════════════════════════════════════════════════════════════
# Advanced Operations
# ═══════════════════════════════════════════════════════════════════════════════

class AOPOperations:
    """
    Higher-level AOP manipulation operations built on the simplifier.
    
    These can be exposed as tools for agents.
    """
    
    def __init__(self, simplifier: AOPSimplifier | None = None) -> None:
        self.simplifier = simplifier or AOPSimplifier()
    
    def combine_with_and(self, nodes: list[Any]) -> Any:
        """Combine multiple expressions with AND and simplify."""
        if not nodes:
            return LiteralNode(value=True)
        if len(nodes) == 1:
            return self.simplifier.simplify(nodes[0])
        
        combined = build_binary_tree(nodes, "AND")
        return self.simplifier.simplify(combined)
    
    def combine_with_or(self, nodes: list[Any]) -> Any:
        """Combine multiple expressions with OR and simplify."""
        if not nodes:
            return LiteralNode(value=False)
        if len(nodes) == 1:
            return self.simplifier.simplify(nodes[0])
        
        combined = build_binary_tree(nodes, "OR")
        return self.simplifier.simplify(combined)
    
    def negate(self, node: Any) -> Any:
        """Negate an expression and simplify (handles double negation)."""
        negated = NotNode(operand=deepcopy(node))
        return self.simplifier.simplify(negated)
    
    def extract_implications(self, node: Any) -> list[tuple[Any, Any]]:
        """
        Extract all A IMPLIES B patterns from an expression.
        
        Returns list of (antecedent, consequent) tuples.
        """
        implications = []
        self._collect_implications(node, implications)
        return implications
    
    def _collect_implications(self, node: Any, result: list) -> None:
        if isinstance(node, BinaryOpNode):
            if node.op == "IMPLIES":
                result.append((node.left, node.right))
            self._collect_implications(node.left, result)
            self._collect_implications(node.right, result)
        elif isinstance(node, NotNode):
            self._collect_implications(node.operand, result)
        elif isinstance(node, QuantifiedNode):
            self._collect_implications(node.body, result)
    
    def substitute(self, node: Any, var_name: str, replacement: Any) -> Any:
        """
        Substitute all occurrences of a variable with a replacement.
        
        Args:
            node: The AST node to transform
            var_name: Variable name including '?' prefix (e.g., "?x")
            replacement: The AST node to substitute in
        
        Returns simplified result.
        """
        result = self._do_substitute(deepcopy(node), var_name, replacement)
        return self.simplifier.simplify(result)
    
    def _do_substitute(self, node: Any, var_name: str, replacement: Any) -> Any:
        if isinstance(node, VarNode):
            if node.name == var_name:
                return deepcopy(replacement)
            return node
        
        if isinstance(node, PredicateNode):
            new_args = [self._do_substitute(arg, var_name, replacement) for arg in node.args]
            return PredicateNode(name=node.name, args=new_args)
        
        if isinstance(node, BinaryOpNode):
            return BinaryOpNode(
                op=node.op,
                left=self._do_substitute(node.left, var_name, replacement),
                right=self._do_substitute(node.right, var_name, replacement)
            )
        
        if isinstance(node, NotNode):
            return NotNode(operand=self._do_substitute(node.operand, var_name, replacement))
        
        if isinstance(node, QuantifiedNode):
            # Don't substitute bound variables
            if var_name in node.variables:
                return node
            return QuantifiedNode(
                quantifier=node.quantifier,
                variables=list(node.variables),
                body=self._do_substitute(node.body, var_name, replacement)
            )
        
        return node
    
    def derive_contrapositive(self, implication_node: BinaryOpNode) -> BinaryOpNode:
        """
        Given A IMPLIES B, derive NOT(B) IMPLIES NOT(A).
        """
        if not isinstance(implication_node, BinaryOpNode) or implication_node.op != "IMPLIES":
            raise ValueError("Expected an IMPLIES expression")
        
        # NOT(B) IMPLIES NOT(A)
        contrapositive = BinaryOpNode(
            op="IMPLIES",
            left=NotNode(operand=deepcopy(implication_node.right)),
            right=NotNode(operand=deepcopy(implication_node.left))
        )
        return self.simplifier.simplify(contrapositive)
    
    def chain_implications(self, impl1: BinaryOpNode, impl2: BinaryOpNode) -> BinaryOpNode | None:
        """
        Given A IMPLIES B and B IMPLIES C, derive A IMPLIES C.
        
        Returns None if implications cannot be chained.
        """
        if impl1.op != "IMPLIES" or impl2.op != "IMPLIES":
            return None
        
        # Check if impl1.right matches impl2.left
        if ast_equal(impl1.right, impl2.left):
            return BinaryOpNode(
                op="IMPLIES",
                left=deepcopy(impl1.left),
                right=deepcopy(impl2.right)
            )
        
        return None
    
    def to_cnf(self, node: Any) -> Any:
        """
        Convert expression to Conjunctive Normal Form (AND of ORs).
        
        This is useful for resolution-based reasoning.
        """
        # Enable De Morgan and push negations inward
        cnf_simplifier = AOPSimplifier(
            enable_de_morgan=True,
            enable_implication_expansion=True,
        )
        
        # First simplify and expand
        expanded = cnf_simplifier.simplify(node)
        
        # Then distribute OR over AND
        return self._distribute_or_over_and(expanded)
    
    def _distribute_or_over_and(self, node: Any) -> Any:
        """Distribute OR over AND: A OR (B AND C) => (A OR B) AND (A OR C)"""
        if not isinstance(node, BinaryOpNode):
            return node
        
        if node.op == "OR":
            left = self._distribute_or_over_and(node.left)
            right = self._distribute_or_over_and(node.right)
            
            # If right is AND, distribute
            if isinstance(right, BinaryOpNode) and right.op == "AND":
                return BinaryOpNode(
                    op="AND",
                    left=self._distribute_or_over_and(
                        BinaryOpNode(op="OR", left=left, right=right.left)
                    ),
                    right=self._distribute_or_over_and(
                        BinaryOpNode(op="OR", left=left, right=right.right)
                    )
                )
            
            # If left is AND, distribute
            if isinstance(left, BinaryOpNode) and left.op == "AND":
                return BinaryOpNode(
                    op="AND",
                    left=self._distribute_or_over_and(
                        BinaryOpNode(op="OR", left=left.left, right=right)
                    ),
                    right=self._distribute_or_over_and(
                        BinaryOpNode(op="OR", left=left.right, right=right)
                    )
                )
            
            return BinaryOpNode(op="OR", left=left, right=right)
        
        if node.op == "AND":
            return BinaryOpNode(
                op="AND",
                left=self._distribute_or_over_and(node.left),
                right=self._distribute_or_over_and(node.right)
            )
        
        return node


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Interface for Agents
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class SimplificationResult:
    """Result of a simplification operation."""
    original_dsl: str
    simplified_dsl: str
    rules_applied: list[str]
    changed: bool
    error: str | None = None


def simplify_aop(dsl_source: str) -> SimplificationResult:
    """
    Simplify an AOP DSL expression.
    
    This is the main entry point for agent tools.
    
    Args:
        dsl_source: DSL expression to simplify
        
    Returns:
        SimplificationResult with original, simplified, and rules applied
    """
    try:
        simplifier = AOPSimplifier()
        simplified = simplifier.simplify_dsl(dsl_source)
        rules = simplifier.get_applied_rules()
        
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl=simplified,
            rules_applied=rules,
            changed=simplified != dsl_source,
        )
    except Exception as e:
        logger.error("Simplification failed: %s", e)
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl=dsl_source,
            rules_applied=[],
            changed=False,
            error=str(e),
        )


def combine_aops(dsl_sources: list[str], operator: str = "AND") -> SimplificationResult:
    """
    Combine multiple AOP expressions with AND or OR and simplify.
    
    Args:
        dsl_sources: List of DSL expressions to combine
        operator: "AND" or "OR"
    
    Returns:
        SimplificationResult with combined and simplified expression
    """
    from ..dsl import DSLParser
    parser = DSLParser()
    
    try:
        nodes = []
        for src in dsl_sources:
            parsed = parser.parse(src)
            if parsed:
                nodes.extend(parsed)
        
        if not nodes:
            return SimplificationResult(
                original_dsl="; ".join(dsl_sources),
                simplified_dsl="",
                rules_applied=[],
                changed=False,
                error="No valid expressions to combine",
            )
        
        ops = AOPOperations()
        if operator == "AND":
            combined = ops.combine_with_and(nodes)
        else:
            combined = ops.combine_with_or(nodes)
        
        simplified_dsl = ast_to_dsl(combined)
        rules = ops.simplifier.get_applied_rules()
        
        return SimplificationResult(
            original_dsl="; ".join(dsl_sources),
            simplified_dsl=simplified_dsl,
            rules_applied=rules,
            changed=True,
        )
    except Exception as e:
        logger.error("Combine failed: %s", e)
        return SimplificationResult(
            original_dsl="; ".join(dsl_sources),
            simplified_dsl="",
            rules_applied=[],
            changed=False,
            error=str(e),
        )


def negate_aop(dsl_source: str) -> SimplificationResult:
    """
    Negate an AOP expression and simplify.
    
    Args:
        dsl_source: DSL expression to negate
    
    Returns:
        SimplificationResult with negated expression
    """
    from ..dsl import DSLParser
    parser = DSLParser()
    
    try:
        nodes = parser.parse(dsl_source)
        if not nodes:
            return SimplificationResult(
                original_dsl=dsl_source,
                simplified_dsl="",
                rules_applied=[],
                changed=False,
                error="No valid expression to negate",
            )
        
        ops = AOPOperations()
        negated = ops.negate(nodes[0])
        simplified_dsl = ast_to_dsl(negated)
        rules = ops.simplifier.get_applied_rules()
        
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl=simplified_dsl,
            rules_applied=rules,
            changed=True,
        )
    except Exception as e:
        logger.error("Negation failed: %s", e)
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl="",
            rules_applied=[],
            changed=False,
            error=str(e),
        )


def substitute_in_aop(dsl_source: str, var_name: str, replacement_dsl: str) -> SimplificationResult:
    """
    Substitute a variable in an AOP expression.
    
    Args:
        dsl_source: DSL expression
        var_name: Variable to replace (e.g., "?x")
        replacement_dsl: DSL expression to substitute
    
    Returns:
        SimplificationResult with substituted expression
    """
    from ..dsl import DSLParser
    parser = DSLParser()
    
    try:
        nodes = parser.parse(dsl_source)
        replacement_nodes = parser.parse(replacement_dsl)
        
        if not nodes or not replacement_nodes:
            return SimplificationResult(
                original_dsl=dsl_source,
                simplified_dsl="",
                rules_applied=[],
                changed=False,
                error="Invalid DSL source or replacement",
            )
        
        ops = AOPOperations()
        result = ops.substitute(nodes[0], var_name, replacement_nodes[0])
        simplified_dsl = ast_to_dsl(result)
        rules = ops.simplifier.get_applied_rules()
        
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl=simplified_dsl,
            rules_applied=rules,
            changed=True,
        )
    except Exception as e:
        logger.error("Substitution failed: %s", e)
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl="",
            rules_applied=[],
            changed=False,
            error=str(e),
        )


def convert_to_cnf(dsl_source: str) -> SimplificationResult:
    """
    Convert an AOP expression to Conjunctive Normal Form.
    
    Args:
        dsl_source: DSL expression to convert
    
    Returns:
        SimplificationResult with CNF expression
    """
    from ..dsl import DSLParser
    parser = DSLParser()
    
    try:
        nodes = parser.parse(dsl_source)
        if not nodes:
            return SimplificationResult(
                original_dsl=dsl_source,
                simplified_dsl="",
                rules_applied=[],
                changed=False,
                error="No valid expression",
            )
        
        ops = AOPOperations()
        cnf = ops.to_cnf(nodes[0])
        cnf_dsl = ast_to_dsl(cnf)
        
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl=cnf_dsl,
            rules_applied=["to_cnf", "de_morgan", "distribute_or"],
            changed=cnf_dsl != dsl_source,
        )
    except Exception as e:
        logger.error("CNF conversion failed: %s", e)
        return SimplificationResult(
            original_dsl=dsl_source,
            simplified_dsl="",
            rules_applied=[],
            changed=False,
            error=str(e),
        )
