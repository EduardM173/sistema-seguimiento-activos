"""
Fact Deduplication & Refinement
================================
Before presenting synthesized facts to the admin panel, run a dedup +
refinement round so the model avoids redundant predicates / entities.

Key principles:
  - If CanFly exists, NOT CanFly is informationally equivalent — no need
    for a separate NotCanFly predicate.
  - RAG existing predicates and entities against candidate ones.
  - Let the LLM decide if an existing element can be reused or updated.
  - Only create new elements when no existing one covers the semantics.
  - For composite statements, decompose into leaf components and dedup
    each one independently.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from .rich_embeddings import build_rich_embedding_text

logger = logging.getLogger(__name__)


@dataclass
class DeduplicationResult:
    """Result of the deduplication round for a single candidate."""
    candidate_dsl: str
    action: str  # "reuse", "update", "create"
    existing_id: str | None = None
    existing_dsl: str | None = None
    updated_dsl: str | None = None
    explanation: str = ""


@dataclass
class RefinementReport:
    """Full report from refining a set of candidate facts."""
    original_count: int = 0
    deduplicated_count: int = 0
    reused: list[DeduplicationResult] = field(default_factory=list)
    updated: list[DeduplicationResult] = field(default_factory=list)
    created: list[DeduplicationResult] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def all_results(self) -> list[DeduplicationResult]:
        return self.reused + self.updated + self.created


class FactRefiner:
    """
    Runs a dedup / refinement round over candidate facts before they reach
    the admin panel.

    Workflow per candidate:
      1. Parse DSL → extract predicates and entity literals
      2. For each predicate: RAG existing predicates, ask LLM if reusable
      3. For each entity: RAG existing entities, ask LLM if reusable
      4. If reusable → map candidate to existing element
      5. If updatable → propose property extension on existing element
      6. If truly new → mark for creation
    """

    def __init__(
        self,
        llm: Any,
        axioms_graph: Any,
        rules_graph: Any,
        domain_graph: Any,
        theorems_graph: Any,
    ) -> None:
        self._llm = llm
        self._graphs = {
            "axioms": axioms_graph,
            "rules": rules_graph,
            "facts": domain_graph,
            "theorems": theorems_graph,
        }

    async def refine_facts(
        self,
        candidate_facts: list[dict[str, Any]],
    ) -> RefinementReport:
        """
        Run dedup + refinement on a list of candidate fact dicts.

        Each dict must have at least: { "dsl": str, "type": str }
        """
        report = RefinementReport(original_count=len(candidate_facts))

        for candidate in candidate_facts:
            dsl = candidate.get("dsl", "")
            if not dsl:
                report.errors.append("Empty DSL in candidate")
                continue
            try:
                result = await self._dedup_single(dsl, candidate.get("type", "fact"))
                if result.action == "reuse":
                    report.reused.append(result)
                elif result.action == "update":
                    report.updated.append(result)
                else:
                    report.created.append(result)
            except Exception as exc:
                logger.warning("Dedup error for '%s': %s", dsl[:80], exc)
                report.errors.append(f"Error deduplicating '{dsl[:80]}': {exc}")
                # Still mark as create so nothing is lost
                report.created.append(DeduplicationResult(
                    candidate_dsl=dsl,
                    action="create",
                    explanation=f"Dedup failed, defaulting to create: {exc}",
                ))

        report.deduplicated_count = len(report.reused) + len(report.updated) + len(report.created)
        return report

    async def _dedup_single(
        self,
        candidate_dsl: str,
        fact_type: str,
    ) -> DeduplicationResult:
        """Deduplicate a single candidate against existing knowledge."""
        # 1. Extract predicates and entities from the candidate
        predicates, entities = self._extract_components(candidate_dsl)

        # 2. Build a rich embedding query so vector similarity captures
        #    semantic proximity (nodes are stored with rich embeddings).
        rich_query = build_rich_embedding_text(
            dsl_source=candidate_dsl,
            node_type=fact_type,
            label="",
            properties={
                "predicates": predicates,
                "entities": entities,
            },
        )

        # 3. RAG each graph using the rich query text
        existing_matches: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for graph_name, graph in self._graphs.items():
            try:
                results = graph.retrieve(rich_query, top_k=5)
                for r in results:
                    rid = r.get("id", "")
                    if rid and rid in seen_ids:
                        continue
                    if rid:
                        seen_ids.add(rid)
                    r["_graph"] = graph_name
                    existing_matches.append(r)
            except Exception:
                pass

        # Sort by similarity score descending for best matches first
        existing_matches.sort(key=lambda r: r.get("score", 0.0), reverse=True)

        if not existing_matches:
            return DeduplicationResult(
                candidate_dsl=candidate_dsl,
                action="create",
                explanation="No similar existing elements found in any graph.",
            )

        # 4. Ask LLM to decide: reuse, update, or create
        existing_text = "\n".join(
            f"  [{r.get('_graph', '?')}/{r.get('metadata', {}).get('type', '?')}] "
            f"{r.get('metadata', {}).get('dsl_source') or r['text']} "
            f"(score={r['score']:.2f})"
            for r in existing_matches[:8]
        )

        prompt = f"""You are a knowledge deduplication assistant for a formal logic system.

CANDIDATE (new, proposed):
  {candidate_dsl}
  Type: {fact_type}
  Predicates used: {', '.join(predicates) if predicates else 'none found'}
  Entities referenced: {', '.join(entities) if entities else 'none found'}

EXISTING ELEMENTS (from knowledge graph):
{existing_text}

RULES:
- If an existing element is semantically EQUIVALENT to the candidate (e.g. CanFly vs NOT CanFly — informationally equivalent via negation), answer REUSE.
- If an existing element covers PART of the candidate's semantics but needs property updates to fully cover it, answer UPDATE and specify what to add.
- If NO existing element can reasonably represent the candidate's meaning, answer CREATE.
- Prefer REUSE over UPDATE, and UPDATE over CREATE.
- Consider that NOT P(x) is equivalent to P(x) with negation — no need for separate NotP(x).

Respond with EXACTLY one of these JSON formats (no markdown, no explanation outside the JSON):
{{"action": "reuse", "existing_id": "<id>", "existing_dsl": "<dsl>", "explanation": "..."}}
{{"action": "update", "existing_id": "<id>", "existing_dsl": "<dsl>", "updated_dsl": "<new dsl>", "explanation": "..."}}
{{"action": "create", "explanation": "..."}}
"""
        try:
            response = await self._llm.acomplete(prompt)
            text = str(response.text).strip()
            # Parse JSON response
            import json
            # Strip possible markdown fences
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(text)

            return DeduplicationResult(
                candidate_dsl=candidate_dsl,
                action=data.get("action", "create"),
                existing_id=data.get("existing_id"),
                existing_dsl=data.get("existing_dsl"),
                updated_dsl=data.get("updated_dsl"),
                explanation=data.get("explanation", ""),
            )
        except Exception as exc:
            logger.warning("LLM dedup decision failed: %s", exc)
            return DeduplicationResult(
                candidate_dsl=candidate_dsl,
                action="create",
                explanation=f"LLM decision failed ({exc}), defaulting to create.",
            )

    def _extract_components(self, dsl_source: str) -> tuple[list[str], list[str]]:
        """Extract predicate names and entity literals from DSL."""
        predicates: list[str] = []
        entities: list[str] = []
        try:
            from ..dsl import DSLParser
            from ..dsl.parser import PredicateNode, LiteralNode
            parser = DSLParser()
            nodes = parser.parse(dsl_source)
            for node in nodes:
                self._walk_ast(node, predicates, entities)
        except Exception:
            pass
        return predicates, entities

    def _walk_ast(self, node: Any, predicates: list[str], entities: list[str]) -> None:
        """Walk AST collecting predicates and literals."""
        from ..dsl.parser import (
            PredicateNode, LiteralNode, BinaryOpNode, NotNode,
            QuantifiedNode, AxiomNode, RuleNode, ProcedureNode,
        )
        if isinstance(node, PredicateNode):
            if node.name not in predicates:
                predicates.append(node.name)
            for arg in node.args:
                self._walk_ast(arg, predicates, entities)
        elif isinstance(node, LiteralNode):
            if isinstance(node.value, str) and node.value not in entities:
                entities.append(node.value)
        elif isinstance(node, BinaryOpNode):
            self._walk_ast(node.left, predicates, entities)
            self._walk_ast(node.right, predicates, entities)
        elif isinstance(node, NotNode):
            self._walk_ast(node.operand, predicates, entities)
        elif isinstance(node, QuantifiedNode):
            self._walk_ast(node.body, predicates, entities)
        elif isinstance(node, AxiomNode):
            self._walk_ast(node.expr, predicates, entities)
        elif isinstance(node, RuleNode):
            for p in node.premises:
                self._walk_ast(p, predicates, entities)
            self._walk_ast(node.conclusion, predicates, entities)
        elif isinstance(node, ProcedureNode):
            if node.precond:
                self._walk_ast(node.precond, predicates, entities)
            for _, step_expr in node.steps:
                self._walk_ast(step_expr, predicates, entities)
