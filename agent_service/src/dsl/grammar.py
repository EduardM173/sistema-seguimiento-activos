"""
DSL Grammar Definition
======================
A formal language for deterministic AOP (Aspect-Oriented Procedures) encoding.

Supported constructs:
  - Variables             : ?x, ?y, …
  - Logical connectives   : AND, OR, NOT, IMPLIES, IFF, XOR
  - Punctuation           : parentheses, comma, semicolon, dot
  - Quantifiers           : FORALL, EXISTS
  - Deduction rules       : RULE … THEN …
  - Axioms                : AXIOM …
  - Substitution          : SUBST
  - Meta links            : META_LINK
  - Context operators     : SHIFT_CTX, EMBED_CTX
  - Pattern matching      : MATCH … WITH …
  - AOP / procedures      : PROCEDURE, STEP, PRECOND, POSTCOND
  - Atoms / predicates    : PascalCase identifiers
  - Literals              : strings, numbers, booleans
"""
from __future__ import annotations

GRAMMAR = r"""
start: statement+
statement: axiom_decl | rule_decl | procedure_decl | meta_link_decl | context_op | subst_stmt | expr_stmt
axiom_decl: "AXIOM" NAME ":" expr "."
rule_decl: "RULE" NAME ":" rule_premise+ "THEN" expr "."
rule_premise: "IF" expr ";"
procedure_decl: "PROCEDURE" NAME proc_precond? "BEGIN" proc_step+ "END" "."
proc_precond: "PRECOND" "(" expr ")"
proc_step: "STEP" NAME ":" expr ";"
subst_stmt: "SUBST" "(" expr "," var "," expr ")" "."
meta_link_decl: "META_LINK" "(" NAME "," NAME "," NAME ")" "."
context_op: shift_ctx | embed_ctx
shift_ctx: "SHIFT_CTX" "(" NAME ")" "."
embed_ctx: "EMBED_CTX" "(" NAME "," expr ")" "."
expr_stmt: expr "."
expr: quantified | iff_expr
quantified: QUANTIFIER var+ "." expr
QUANTIFIER: "FORALL" | "EXISTS"
iff_expr: implies_expr ("IFF" implies_expr)*
implies_expr: or_expr ("IMPLIES" or_expr)*
or_expr: xor_expr ("OR" xor_expr)*
xor_expr: and_expr ("XOR" and_expr)*
and_expr: not_expr ("AND" not_expr)*
not_expr: "NOT" not_expr -> negation | atom
atom: "(" expr ")" -> paren_expr | match_expr | predicate | literal | var
predicate: PRED_NAME "(" arg_list ")" | PRED_NAME
arg_list: expr ("," expr)*
PRED_NAME: /[A-Z][a-zA-Z0-9_]*/
match_expr: "MATCH" expr "WITH" match_arm+
match_arm: "|" pattern "ARROW" expr
ARROW: "=>"
pattern: var | WILDCARD | predicate
WILDCARD: "_"
var: VAR_TOKEN
VAR_TOKEN: /\?[a-z_][a-zA-Z0-9_]*/
literal: NUMBER -> num_lit | ESCAPED_STRING -> str_lit | BOOL -> bool_lit
BOOL: "true" | "false"
NAME: /[a-zA-Z_][a-zA-Z0-9_]*/
%import common.NUMBER
%import common.ESCAPED_STRING
%import common.WS
COMMENT: /\/\/[^\n]*/
%ignore WS
%ignore COMMENT
"""


class DSLGrammar:
    """Container for the DSL grammar string; used by the parser."""

    raw: str = GRAMMAR

    # Operator precedence table (higher number = tighter binding)
    PRECEDENCE: dict[str, int] = {
        "IFF": 1,
        "IMPLIES": 2,
        "OR": 3,
        "XOR": 4,
        "AND": 5,
        "NOT": 6,
        "FORALL": 7,
        "EXISTS": 7,
    }

    # All keyword tokens
    KEYWORDS: frozenset[str] = frozenset(
        {
            "AXIOM", "RULE", "IF", "THEN", "PROCEDURE", "PRECOND", "BEGIN",
            "STEP", "END", "SUBST", "META_LINK", "SHIFT_CTX", "EMBED_CTX",
            "MATCH", "WITH", "FORALL", "EXISTS",
            "AND", "OR", "NOT", "IMPLIES", "IFF", "XOR",
        }
    )
