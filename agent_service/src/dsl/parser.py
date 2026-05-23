"""
DSL Parser
==========
Parses DSL source text into an AST using the Lark parsing library.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from lark import Lark, Tree, Token, UnexpectedInput

from .grammar import DSLGrammar


class ParseError(Exception):
    """Raised when DSL source text cannot be parsed."""


# ── AST node types ──────────────────────────────────────────────────────────

@dataclass
class DSLNode:
    """Base class for all AST nodes."""
    kind: str

    def __repr__(self) -> str:  # pragma: no cover
        return f"{self.__class__.__name__}({self.kind})"


@dataclass
class AxiomNode(DSLNode):
    name: str
    expr: Any
    kind: str = field(default="axiom", init=False)


@dataclass
class RuleNode(DSLNode):
    name: str
    premises: list[Any]
    conclusion: Any
    kind: str = field(default="rule", init=False)


@dataclass
class ProcedureNode(DSLNode):
    name: str
    precond: Any | None
    steps: list[tuple[str, Any]]
    kind: str = field(default="procedure", init=False)


@dataclass
class MetaLinkNode(DSLNode):
    source: str
    target: str
    link_type: str
    kind: str = field(default="meta_link", init=False)


@dataclass
class ContextShiftNode(DSLNode):
    context_name: str
    kind: str = field(default="shift_ctx", init=False)


@dataclass
class ContextEmbedNode(DSLNode):
    context_name: str
    expr: Any
    kind: str = field(default="embed_ctx", init=False)


@dataclass
class SubstNode(DSLNode):
    expr: Any
    var: str
    replacement: Any
    kind: str = field(default="subst", init=False)


@dataclass
class QuantifiedNode(DSLNode):
    quantifier: str      # "FORALL" | "EXISTS"
    variables: list[str]
    body: Any
    kind: str = field(default="quantified", init=False)


@dataclass
class BinaryOpNode(DSLNode):
    op: str
    left: Any
    right: Any
    kind: str = field(default="binop", init=False)


@dataclass
class NotNode(DSLNode):
    operand: Any
    kind: str = field(default="not", init=False)


@dataclass
class PredicateNode(DSLNode):
    name: str
    args: list[Any]
    kind: str = field(default="predicate", init=False)


@dataclass
class VarNode(DSLNode):
    name: str       # includes the leading '?'
    kind: str = field(default="var", init=False)


@dataclass
class LiteralNode(DSLNode):
    value: Any
    kind: str = field(default="literal", init=False)


@dataclass
class MatchNode(DSLNode):
    subject: Any
    arms: list[tuple[Any, Any]]   # [(pattern, expr), …]
    kind: str = field(default="match", init=False)


# ── Lark transformer ─────────────────────────────────────────────────────────

class _DSLTransformer:
    """Recursive transformer that converts a Lark parse tree into DSL AST nodes."""

    # ── Statement level ───────────────────────────────────────────────────────

    def axiom_decl(self, items: list) -> AxiomNode:
        name, expr = str(items[0]), items[1]
        return AxiomNode(name=name, expr=expr)

    def rule_decl(self, items: list) -> RuleNode:
        name = str(items[0])
        premises = [i for i in items[1:] if isinstance(i, tuple) and i[0] == "premise"]
        conclusion = items[-1]
        return RuleNode(name=name, premises=[p[1] for p in premises], conclusion=conclusion)

    def rule_premise(self, items: list) -> tuple:
        return ("premise", items[0])

    def procedure_decl(self, items: list) -> ProcedureNode:
        name = str(items[0])
        precond = None
        steps: list[tuple[str, Any]] = []
        for item in items[1:]:
            if isinstance(item, tuple) and item[0] == "precond":
                precond = item[1]
            elif isinstance(item, tuple) and item[0] == "step":
                steps.append((item[1], item[2]))
        return ProcedureNode(name=name, precond=precond, steps=steps)

    def proc_precond(self, items: list) -> tuple:
        return ("precond", items[0])

    def proc_step(self, items: list) -> tuple:
        return ("step", str(items[0]), items[1])

    def subst_stmt(self, items: list) -> SubstNode:
        expr, var, replacement = items
        return SubstNode(expr=expr, var=var.name, replacement=replacement)

    def meta_link_decl(self, items: list) -> MetaLinkNode:
        source, target, link_type = str(items[0]), str(items[1]), str(items[2])
        return MetaLinkNode(source=source, target=target, link_type=link_type)

    def expr_stmt(self, items: list) -> Any:
        return items[0]

    def shift_ctx(self, items: list) -> ContextShiftNode:
        return ContextShiftNode(context_name=str(items[0]))

    def embed_ctx(self, items: list) -> ContextEmbedNode:
        return ContextEmbedNode(context_name=str(items[0]), expr=items[1])

    def context_op(self, items: list) -> Any:
        return items[0]

    # ── Expression level ──────────────────────────────────────────────────────

    def expr(self, items: list) -> Any:
        return items[0]

    def quantified(self, items: list) -> QuantifiedNode:
        # items: [QUANTIFIER token, var, …, body_expr]
        quantifier = str(items[0])
        variables = [v.name for v in items[1:-1] if isinstance(v, VarNode)]
        body = items[-1]
        return QuantifiedNode(quantifier=quantifier, variables=variables, body=body)

    def _binary(self, op: str, items: list) -> Any:
        if len(items) == 1:
            return items[0]
        result = items[0]
        for rhs in items[1:]:
            result = BinaryOpNode(op=op, left=result, right=rhs)
        return result

    def iff_expr(self, items: list) -> Any:    return self._binary("IFF", items)
    def implies_expr(self, items: list) -> Any: return self._binary("IMPLIES", items)
    def or_expr(self, items: list) -> Any:     return self._binary("OR", items)
    def xor_expr(self, items: list) -> Any:    return self._binary("XOR", items)
    def and_expr(self, items: list) -> Any:    return self._binary("AND", items)

    def negation(self, items: list) -> NotNode:
        return NotNode(operand=items[0])

    def not_expr(self, items: list) -> Any:
        return items[0]

    def atom(self, items: list) -> Any:
        return items[0]

    def paren_expr(self, items: list) -> Any:
        return items[0]

    def predicate(self, items: list) -> PredicateNode:
        name = str(items[0])
        args = list(items[1]) if len(items) > 1 else []
        return PredicateNode(name=name, args=args)

    def arg_list(self, items: list) -> list:
        return list(items)

    def match_expr(self, items: list) -> MatchNode:
        subject = items[0]
        arms = list(items[1:])  # each is a tuple (pattern, expr) from match_arm
        return MatchNode(subject=subject, arms=arms)

    def match_arm(self, items: list) -> tuple:
        # items: [pattern, expr]  (the '|' token is discarded)
        return (items[0], items[1])

    def pattern(self, items: list) -> Any:
        item = items[0]
        if hasattr(item, 'type') and str(getattr(item, 'type', '')) == 'WILDCARD':
            return "_"
        return item

    def var(self, items: list) -> VarNode:
        return VarNode(name=str(items[0]))

    def num_lit(self, items: list) -> LiteralNode:
        return LiteralNode(value=float(str(items[0])))

    def str_lit(self, items: list) -> LiteralNode:
        raw = str(items[0])
        return LiteralNode(value=raw[1:-1])   # strip quotes

    def bool_lit(self, items: list) -> LiteralNode:
        return LiteralNode(value=str(items[0]) == "true")

    def literal(self, items: list) -> Any:
        return items[0]

    def statement(self, items: list) -> Any:
        return items[0]

    def start(self, items: list) -> list:
        return list(items)

    # Lark calls __default__ for rules not explicitly defined
    def __default__(self, data: str, children: list, meta: Any) -> Any:  # pragma: no cover
        return Tree(data, children, meta)

    def __default_token__(self, token: Token) -> Token:  # pragma: no cover
        return token


# ── Public parser ─────────────────────────────────────────────────────────────

class DSLParser:
    """
    Parses DSL source text and returns a list of top-level AST nodes.

    Usage::

        parser = DSLParser()
        nodes = parser.parse("AXIOM A1: Authenticated(?user). ")
    """

    def __init__(self) -> None:
        self._lark = Lark(
            DSLGrammar.raw,
            parser="earley",
            ambiguity="resolve",
        )
        self._transformer = _DSLTransformer()

    def parse(self, source: str) -> list[Any]:
        """Parse *source* and return a list of top-level DSL AST nodes.

        Raises :class:`ParseError` on syntax errors.
        """
        try:
            tree = self._lark.parse(source)
        except UnexpectedInput as exc:
            raise ParseError(f"Syntax error in DSL source:\n{exc}") from exc

        return self._transform(tree)

    def _transform(self, tree: Tree) -> list[Any]:
        """Walk the Lark tree and call transformer methods."""
        return self._visit(tree)

    def _visit(self, node: Any) -> Any:
        if not isinstance(node, Tree):
            return node
        children = [self._visit(c) for c in node.children]
        method = getattr(self._transformer, node.data, None)
        if method is not None:
            return method(children)
        # fallback
        return Tree(node.data, children)
