"""
DSL Translator
==============
Converts between:
  - DSL AST nodes ↔ DSL source text (pretty-print)
  - DSL AOP expressions ↔ human-readable natural language (via Gemini LLM)
  - Natural language procedure descriptions ↔ DSL source text
"""
from __future__ import annotations

import logging
from typing import Any

from .parser import (
    AxiomNode, RuleNode, ProcedureNode, MetaLinkNode,
    ContextShiftNode, ContextEmbedNode, SubstNode,
    QuantifiedNode, BinaryOpNode, NotNode,
    PredicateNode, VarNode, LiteralNode, MatchNode,
    DSLNode,
)

logger = logging.getLogger(__name__)


def ast_to_dict(node: Any) -> dict[str, Any] | list | str | float | bool | None:
    """Recursively converts a DSL AST node to a JSON-compliant dictionary payload."""
    if node is None:
        return None
    if isinstance(node, list):
        return [ast_to_dict(n) for n in node]
    if isinstance(node, tuple):
        return [ast_to_dict(n) for n in node]
    if not isinstance(node, DSLNode):
        # Native literals
        return node

    base = {"kind": getattr(node, "kind", str(node.__class__.__name__).lower().replace("node", ""))}
    for key, value in vars(node).items():
        if key == "kind":
            continue
        base[key] = ast_to_dict(value)
    return base


class DSLTranslator:
    """
    Provides serialisation (AST → DSL text), deserialisation helpers,
    and optional Gemini-powered natural-language conversion.

    The Gemini LLM is injected lazily so this module can be used
    without a live API key (e.g. in unit tests with a mock LLM).
    """

    def __init__(self, llm: Any | None = None) -> None:
        self._llm = llm  # llama-index LLM instance, injected by the pipeline

    # ── AST → DSL text ────────────────────────────────────────────────────────

    def to_dsl(self, node: Any) -> str:
        """Serialise an AST node back to DSL source text."""
        return self._emit(node)

    def _emit(self, node: Any) -> str:  # noqa: C901  (complexity OK here)
        if isinstance(node, AxiomNode):
            return f"AXIOM {node.name}: {self._emit(node.expr)}."

        if isinstance(node, RuleNode):
            premises = " ".join(f"IF {self._emit(p)};" for p in node.premises)
            return f"RULE {node.name}: {premises} THEN {self._emit(node.conclusion)}."

        if isinstance(node, ProcedureNode):
            parts = [f"PROCEDURE {node.name}"]
            if node.precond is not None:
                parts.append(f"PRECOND ({self._emit(node.precond)})")
            parts.append("BEGIN")
            for step_name, step_expr in node.steps:
                parts.append(f"  STEP {step_name}: {self._emit(step_expr)};")
            parts.append("END.")
            return "\n".join(parts)

        if isinstance(node, MetaLinkNode):
            return f"META_LINK({node.source}, {node.target}, {node.link_type})."

        if isinstance(node, ContextShiftNode):
            return f"SHIFT_CTX({node.context_name})."

        if isinstance(node, ContextEmbedNode):
            return f"EMBED_CTX({node.context_name}, {self._emit(node.expr)})."

        if isinstance(node, SubstNode):
            return f"SUBST({self._emit(node.expr)}, {node.var}, {self._emit(node.replacement)})."

        if isinstance(node, QuantifiedNode):
            vars_str = " ".join(node.variables)
            return f"{node.quantifier} {vars_str}. {self._emit(node.body)}"

        if isinstance(node, BinaryOpNode):
            lp = self._maybe_paren(node.left, node.op)
            rp = self._maybe_paren(node.right, node.op)
            return f"{lp} {node.op} {rp}"

        if isinstance(node, NotNode):
            return f"NOT {self._emit(node.operand)}"

        if isinstance(node, PredicateNode):
            if not node.args:
                return node.name
            args_str = ", ".join(self._emit(a) for a in node.args)
            return f"{node.name}({args_str})"

        if isinstance(node, VarNode):
            return node.name

        if isinstance(node, LiteralNode):
            if isinstance(node.value, bool):
                return "true" if node.value else "false"
            if isinstance(node.value, str):
                return f'"{node.value}"'
            return str(node.value)

        if isinstance(node, MatchNode):
            subject = self._emit(node.subject)
            arms = " | ".join(f"{self._emit(p)} => {self._emit(r)}" for p, r in node.arms)
            return f"MATCH {subject} WITH | {arms}"

        return str(node)  # fallback

    def _maybe_paren(self, child: Any, parent_op: str) -> str:
        """Add parentheses around *child* when needed by precedence."""
        from .grammar import DSLGrammar
        text = self._emit(child)
        if isinstance(child, BinaryOpNode):
            child_prec = DSLGrammar.PRECEDENCE.get(child.op, 0)
            parent_prec = DSLGrammar.PRECEDENCE.get(parent_op, 0)
            if child_prec < parent_prec:
                return f"({text})"
        return text

    # ── DSL AOP → human-readable text (via Gemini) ────────────────────────────

    async def to_natural_language(self, node: Any) -> str:
        """
        Translate a DSL AOP expression to human-readable text.

        If no LLM is available, falls back to pretty-printing the DSL.
        """
        dsl_text = self.to_dsl(node)
        if self._llm is None:
            logger.warning("No LLM available — returning raw DSL for NL translation")
            return dsl_text

        prompt = _NL_PROMPT.format(dsl=dsl_text)
        try:
            response = await self._llm.acomplete(prompt)
            return response.text.strip()
        except Exception as exc:  # pragma: no cover
            logger.error("LLM translation failed: %s", exc)
            return dsl_text

    # ── Natural language → DSL source text (via Gemini) ───────────────────────

    async def from_natural_language(self, text: str, context_hint: str = "") -> str:
        """
        Translate a natural-language procedure description to DSL source.

        Returns DSL source text that can be fed to :class:`DSLParser`.
        """
        if self._llm is None:
            raise RuntimeError("LLM is required for NL→DSL translation")

        prompt = _DSL_PROMPT.format(text=text, context=context_hint)
        try:
            response = await self._llm.acomplete(prompt)
            return response.text.strip()
        except Exception as exc:  # pragma: no cover
            logger.error("LLM DSL generation failed: %s", exc)
            raise

    # ── Graph diagram → DSL (via multimodal Gemini) ────────────────────────────

    async def diagram_to_dsl(self, image_bytes: bytes, mime_type: str = "image/png") -> str:
        """
        Translate a BPMN / flow diagram image to DSL source using the
        multimodal Gemini vision capability.
        """
        if self._llm is None:
            raise RuntimeError("LLM is required for diagram→DSL translation")

        import base64
        b64 = base64.b64encode(image_bytes).decode()
        prompt = _DIAGRAM_PROMPT.format(b64=b64, mime=mime_type)
        try:
            response = await self._llm.acomplete(prompt)
            return response.text.strip()
        except Exception as exc:  # pragma: no cover
            logger.error("LLM diagram translation failed: %s", exc)
            raise


# ── Prompt templates ──────────────────────────────────────────────────────────

_NL_PROMPT = """\
You are a formal DSL interpreter for a banking customer-service assistant.
The following is a formal DSL expression (AOP — Aspect-Oriented Procedure):

{dsl}

Translate this DSL expression into clear, customer-friendly natural language.
Be concise, accurate, and friendly. Do NOT expose internal DSL syntax.
"""

_DSL_PROMPT = """\
You are a formal DSL encoder for a banking customer-service assistant.
Convert the following natural-language procedure description into valid DSL source text.

Context hint: {context}

Natural language description:
{text}

DSL grammar rules:
- AXIOM <Name>: <expr>.
- RULE <Name>: IF <expr>; THEN <expr>.
- PROCEDURE <Name> [PRECOND (<expr>)] BEGIN STEP <Name>: <expr>; ... END.
- Predicates: PascalCase identifiers, e.g., Authenticated(?user)
- Variables: ?varName
- Connectives: AND, OR, NOT, IMPLIES, IFF, XOR
- Quantifiers: FORALL ?x. <expr>,  EXISTS ?x. <expr>

Produce ONLY valid DSL source text, no explanation.
"""

_DIAGRAM_PROMPT = """\
You are a formal DSL encoder for a banking customer-service assistant.
Analyse the following diagram (base64 encoded, MIME type {mime}) and
translate it into valid DSL PROCEDURE declarations that capture the
sequential entity interactions, preconditions, and steps shown.

[IMAGE BASE64 OMITTED FOR BREVITY — this is a multimodal call]

Produce ONLY valid DSL source text, no explanation.
"""
