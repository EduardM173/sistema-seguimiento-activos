"""
Agent Tools
===========
LlamaIndex FunctionTools for the reasoning agent to:
- Retrieve from PropertyGraphIndex stores (axioms, rules, facts, theorems)
- Execute Z3 formal proofs
- Store new theorems and business facts
"""
from __future__ import annotations

import logging
from typing import Any

from llama_index.core.tools import FunctionTool, ToolMetadata, ToolOutput
from pydantic import BaseModel, Field

from .property_graphs import (
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ProofResult, ContradictionError
from ..telemetry import log_event
from ..dsl.guardrails import evaluate_statement_against_context

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Input Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class RetrieveAxiomsInput(BaseModel):
    """Input schema for axiom retrieval."""
    query: str = Field(description="Natural language or DSL query to find relevant axioms")
    top_k: int = Field(default=5, description="Number of axioms to retrieve")
    include_shortcuts: bool = Field(default=True, description="Include deduction shortcuts")


class RetrieveDeductionRulesInput(BaseModel):
    """Input schema for deduction rule retrieval."""
    query: str = Field(description="Query to find relevant deduction rules")
    top_k: int = Field(default=5, description="Number of rules to retrieve")


class RetrieveBusinessFactsInput(BaseModel):
    """Input schema for business fact retrieval."""
    query: str = Field(description="Query about microservices, screens, workflows, etc.")
    top_k: int = Field(default=10, description="Number of facts to retrieve")
    entity_types: list[str] = Field(
        default=[],
        description="Filter by entity types: microservice, endpoint, screen, button, workflow",
    )


class RetrieveTheoremsInput(BaseModel):
    """Input schema for theorem retrieval."""
    query: str = Field(description="Query to find relevant theorems/AOPs")
    top_k: int = Field(default=5, description="Number of theorems to retrieve")


class RunZ3ProofInput(BaseModel):
    """Input schema for Z3 proof execution."""
    goal_dsl: str = Field(description="The DSL expression to prove")
    axiom_names: list[str] = Field(
        default=[],
        description="Names of axioms to use in the proof",
    )
    rule_names: list[str] = Field(
        default=[],
        description="Names of deduction rules to use in the proof",
    )
    fact_contexts: list[str] = Field(
        default=[],
        description="DSL representations of business facts to use",
    )


class StoreTheoremInput(BaseModel):
    """Input schema for storing a new theorem."""
    name: str = Field(description="Name/identifier for the theorem")
    statement_dsl: str = Field(description="DSL representation of the theorem")
    proof_trace: list[str] = Field(description="Steps of the proof")
    used_axiom_ids: list[str] = Field(default=[], description="IDs of axioms used")
    used_rule_ids: list[str] = Field(default=[], description="IDs of rules used")


class StoreBusinessFactInput(BaseModel):
    """Input schema for storing a new business fact."""
    subject: str = Field(description="Subject entity of the fact")
    predicate: str = Field(description="Relationship/property")
    object: str = Field(description="Object entity or value")
    entity_type: str = Field(
        default="entity",
        description="Type: microservice, endpoint, screen, button, workflow",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Factory Functions
# ═══════════════════════════════════════════════════════════════════════════════

def create_retrieve_axioms_tool(axioms_graph: AxiomsGraph) -> FunctionTool:
    """Create a tool for retrieving axioms from the PropertyGraphIndex."""
    
    def retrieve_axioms(
        query: str,
        top_k: int = 5,
        include_shortcuts: bool = True,
    ) -> str:
        """
        Retrieve relevant axioms from the axioms knowledge graph.
        
        Use this when you need logical axioms to build a formal proof
        or when the LLM needs DSL context for deduction.
        """
        log_event("agent.tool.started", {
            "tool": "retrieve_axioms",
            "query": query,
            "top_k": top_k,
        })
        results = axioms_graph.retrieve(query, top_k=top_k, include_relations=include_shortcuts)
        
        if not results:
            return "No relevant axioms found for the given query."
        
        output_lines = ["Retrieved Axioms:"]
        for i, r in enumerate(results, 1):
            output_lines.append(f"\n{i}. {r['metadata'].get('label', 'Unknown')}")
            output_lines.append(f"   DSL: {r['text']}")
            output_lines.append(f"   Score: {r['score']:.3f}")
            if include_shortcuts and r.get('relations'):
                output_lines.append(f"   Shortcuts: {len(r['relations'])} available")

        log_event("agent.tool.completed", {
            "tool": "retrieve_axioms",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })
        
        return "\n".join(output_lines)

    async def aretrieve_axioms(
        query: str,
        top_k: int = 5,
        include_shortcuts: bool = True,
    ) -> str:
        log_event("agent.tool.started", {
            "tool": "retrieve_axioms",
            "query": query,
            "top_k": top_k,
        })
        results = await axioms_graph.aretrieve(
            query,
            top_k=top_k,
            include_relations=include_shortcuts,
        )

        if not results:
            return "No relevant axioms found for the given query."

        output_lines = ["Retrieved Axioms:"]
        for i, r in enumerate(results, 1):
            output_lines.append(f"\n{i}. {r['metadata'].get('label', 'Unknown')}")
            output_lines.append(f"   DSL: {r['text']}")
            output_lines.append(f"   Score: {r['score']:.3f}")
            if include_shortcuts and r.get('relations'):
                output_lines.append(f"   Shortcuts: {len(r['relations'])} available")

        log_event("agent.tool.completed", {
            "tool": "retrieve_axioms",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })

        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=retrieve_axioms,
        async_fn=aretrieve_axioms,
        name="retrieve_axioms",
        description=(
            "Search and retrieve foundational facts and rules."
        ),
    )


def create_retrieve_deduction_rules_tool(rules_graph: DeductionRulesGraph) -> FunctionTool:
    """Create a tool for retrieving deduction rules."""
    
    def retrieve_deduction_rules(
        query: str,
        top_k: int = 5,
    ) -> str:
        """
        Retrieve relevant deduction rules from the rules knowledge graph.
        
        Use this when you need rules to apply in formal proofs.
        Rules are Hilbert-style and produce valid conclusions from premises.
        """
        log_event("agent.tool.started", {
            "tool": "retrieve_deduction_rules",
            "query": query,
            "top_k": top_k,
        })
        results = rules_graph.retrieve(query, top_k=top_k)
        
        if not results:
            return "No relevant deduction rules found for the given query."
        
        output_lines = ["Retrieved Deduction Rules:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
            output_lines.append(f"   DSL: {r['text']}")
            if 'premises' in meta:
                output_lines.append(f"   Premises: {meta['premises']}")
            if 'conclusion' in meta:
                output_lines.append(f"   Conclusion: {meta['conclusion']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_deduction_rules",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })
        
        return "\n".join(output_lines)

    async def aretrieve_deduction_rules(
        query: str,
        top_k: int = 5,
    ) -> str:
        log_event("agent.tool.started", {
            "tool": "retrieve_deduction_rules",
            "query": query,
            "top_k": top_k,
        })
        results = await rules_graph.aretrieve(query, top_k=top_k)

        if not results:
            return "No relevant deduction rules found for the given query."

        output_lines = ["Retrieved Deduction Rules:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
            output_lines.append(f"   DSL: {r['text']}")
            if 'premises' in meta:
                output_lines.append(f"   Premises: {meta['premises']}")
            if 'conclusion' in meta:
                output_lines.append(f"   Conclusion: {meta['conclusion']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_deduction_rules",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })

        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=retrieve_deduction_rules,
        async_fn=aretrieve_deduction_rules,
        name="retrieve_deduction_rules",
        description=(
            "Search and retrieve inference rules and logical relationships."
        ),
    )


def create_retrieve_business_facts_tool(domain_graph: BusinessDomainGraph) -> FunctionTool:
    """Create a tool for retrieving business domain facts."""
    
    def retrieve_business_facts(
        query: str,
        top_k: int = 10,
        entity_types: list[str] | None = None,
    ) -> str:
        """
        Retrieve business domain facts from the domain knowledge graph.
        
        Facts include:
        - Microservices, endpoints, JSON schemas
        - Screens, buttons, UI elements
        - User workflows and navigation paths
        - Permissions and requirements
        """
        log_event("agent.tool.started", {
            "tool": "retrieve_business_facts",
            "query": query,
            "top_k": top_k,
            "entity_types": entity_types or [],
        })
        results = domain_graph.retrieve(query, top_k=top_k)
        
        # Filter by entity types if specified
        if entity_types:
            results = [
                r for r in results
                if r['metadata'].get('entity_type') in entity_types
            ]
        
        if not results:
            return "No relevant business facts found for the given query."
        
        output_lines = ["Retrieved Business Domain Facts:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. [{meta.get('entity_type', 'fact')}] {meta.get('subject', 'Unknown')}")
            output_lines.append(f"   Relation: {meta.get('predicate', '?')} -> {meta.get('object', '?')}")
            output_lines.append(f"   Full: {r['text']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_business_facts",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })
        
        return "\n".join(output_lines)

    async def aretrieve_business_facts(
        query: str,
        top_k: int = 10,
        entity_types: list[str] | None = None,
    ) -> str:
        log_event("agent.tool.started", {
            "tool": "retrieve_business_facts",
            "query": query,
            "top_k": top_k,
            "entity_types": entity_types or [],
        })
        results = await domain_graph.aretrieve(query, top_k=top_k)

        if entity_types:
            results = [
                r for r in results
                if r['metadata'].get('entity_type') in entity_types
            ]

        if not results:
            return "No relevant business facts found for the given query."

        output_lines = ["Retrieved Business Domain Facts:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. [{meta.get('entity_type', 'fact')}] {meta.get('subject', 'Unknown')}")
            output_lines.append(f"   Relation: {meta.get('predicate', '?')} -> {meta.get('object', '?')}")
            output_lines.append(f"   Full: {r['text']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_business_facts",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })

        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=retrieve_business_facts,
        async_fn=aretrieve_business_facts,
        name="retrieve_business_facts",
        description=(
            "Search and retrieve facts about any topic stored in the knowledge base."
        ),
    )


def create_retrieve_theorems_tool(theorems_graph: TheoremsGraph) -> FunctionTool:
    """Create a tool for retrieving existing theorems/AOPs."""
    
    def retrieve_theorems(
        query: str,
        top_k: int = 5,
    ) -> str:
        """
        Retrieve existing theorems and AOPs from the theorems knowledge graph.
        
        Theorems are previously proven statements that can be reused.
        AOPs are Abstract Operational Procedures deduced from facts.
        """
        log_event("agent.tool.started", {
            "tool": "retrieve_theorems",
            "query": query,
            "top_k": top_k,
        })
        results = theorems_graph.retrieve(query, top_k=top_k)
        
        if not results:
            return "No relevant theorems or AOPs found for the given query."
        
        output_lines = ["Retrieved Theorems/AOPs:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
            output_lines.append(f"   Type: {meta.get('type', 'theorem')}")
            output_lines.append(f"   Statement: {r['text']}")
            if meta.get('used_axioms'):
                output_lines.append(f"   Used Axioms: {meta['used_axioms']}")
            if meta.get('used_rules'):
                output_lines.append(f"   Used Rules: {meta['used_rules']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_theorems",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })
        
        return "\n".join(output_lines)

    async def aretrieve_theorems(
        query: str,
        top_k: int = 5,
    ) -> str:
        log_event("agent.tool.started", {
            "tool": "retrieve_theorems",
            "query": query,
            "top_k": top_k,
        })
        results = await theorems_graph.aretrieve(query, top_k=top_k)

        if not results:
            return "No relevant theorems or AOPs found for the given query."

        output_lines = ["Retrieved Theorems/AOPs:"]
        for i, r in enumerate(results, 1):
            meta = r['metadata']
            output_lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
            output_lines.append(f"   Type: {meta.get('type', 'theorem')}")
            output_lines.append(f"   Statement: {r['text']}")
            if meta.get('used_axioms'):
                output_lines.append(f"   Used Axioms: {meta['used_axioms']}")
            if meta.get('used_rules'):
                output_lines.append(f"   Used Rules: {meta['used_rules']}")
            output_lines.append(f"   Score: {r['score']:.3f}")

        log_event("agent.tool.completed", {
            "tool": "retrieve_theorems",
            "result_count": len(results),
            "top_result": (results[0].get("text", "")[:300] if results else ""),
        })

        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=retrieve_theorems,
        async_fn=aretrieve_theorems,
        name="retrieve_theorems",
        description=(
            "Search and retrieve derived conclusions and known facts."
        ),
    )


def create_run_z3_proof_tool(
    z3_engine: Z3ProofEngine,
    axioms_graph: AxiomsGraph,
    rules_graph: DeductionRulesGraph,
) -> FunctionTool:
    """Create a tool for running Z3 formal proofs."""
    
    def run_z3_proof(
        goal_dsl: str,
        axiom_names: list[str] | None = None,
        rule_names: list[str] | None = None,
        fact_contexts: list[str] | None = None,
    ) -> str:
        """
        Execute a formal proof using Z3 theorem prover.
        
        Provide the goal to prove in DSL format, along with axioms,
        rules, and facts to use. Z3 will attempt to verify the goal
        is a valid consequence of the provided context.
        
        IMPORTANT: Z3 can only use information explicitly provided.
        First use retrieval tools to gather relevant axioms, rules, and facts.
        """
        try:
            log_event("agent.tool.started", {
                "tool": "run_z3_proof",
                "goal_dsl": goal_dsl,
            })
            # Translate goal to Z3
            goal_z3 = z3_engine.translate_dsl_text_to_z3(goal_dsl)
            if goal_z3 is None:
                return f"ERROR: Could not parse goal DSL: {goal_dsl}"
            
            # Gather axioms
            axioms_z3 = []
            if axiom_names:
                for name in axiom_names:
                    results = axioms_graph.retrieve(name, top_k=1)
                    if results:
                        dsl = results[0]['text']
                        formula = z3_engine.translate_dsl_text_to_z3(dsl)
                        if formula is not None:
                            axioms_z3.append((name, formula))
            
            # Gather rules
            rules_z3 = []
            if rule_names:
                for name in rule_names:
                    results = rules_graph.retrieve(name, top_k=1)
                    if results:
                        dsl = results[0]['text']
                        formula = z3_engine.translate_dsl_text_to_z3(dsl)
                        if formula is not None:
                            rules_z3.append((name, formula))
            
            # Gather facts
            facts_z3 = []
            if fact_contexts:
                for i, dsl in enumerate(fact_contexts):
                    formula = z3_engine.translate_dsl_text_to_z3(dsl)
                    if formula is not None:
                        facts_z3.append((f"fact_{i}", formula))
            
            # Run proof
            result = z3_engine.prove_with_context(
                goal=goal_z3,
                axioms=axioms_z3 or None,
                rules=rules_z3 or None,
                facts=facts_z3 or None,
            )
            
            # Format output
            output_lines = [
                f"Z3 Proof Result: {result.status.value.upper()}",
                f"Message: {result.message}",
                "",
                "Proof Trace:",
            ]
            output_lines.extend([f"  {line}" for line in result.proof_trace])
            
            if result.model:
                output_lines.append("\nCounterexample found:")
                for k, v in result.model.items():
                    output_lines.append(f"  {k} = {v}")
            
            if result.used_axioms:
                output_lines.append(f"\nAxioms used: {result.used_axioms}")
            if result.used_rules:
                output_lines.append(f"Rules used: {result.used_rules}")

            log_event("agent.tool.completed", {
                "tool": "run_z3_proof",
                "status": result.status.value,
                "message": result.message,
            })
            
            return "\n".join(output_lines)
            
        except ContradictionError as e:
            log_event("agent.tool.failed", {
                "tool": "run_z3_proof",
                "error": str(e),
            })
            return f"CONTRADICTION DETECTED: {e}\nConflicting: {e.conflicting_formulas}"
        except Exception as e:
            logger.exception("Z3 proof error")
            log_event("agent.tool.failed", {
                "tool": "run_z3_proof",
                "error": str(e),
            })
            return f"ERROR during Z3 proof: {str(e)}"

    async def arun_z3_proof(
        goal_dsl: str,
        axiom_names: list[str] | None = None,
        rule_names: list[str] | None = None,
        fact_contexts: list[str] | None = None,
    ) -> str:
        try:
            log_event("agent.tool.started", {
                "tool": "run_z3_proof",
                "goal_dsl": goal_dsl,
            })
            goal_z3 = z3_engine.translate_dsl_text_to_z3(goal_dsl)
            if goal_z3 is None:
                return f"ERROR: Could not parse goal DSL: {goal_dsl}"

            axioms_z3 = []
            if axiom_names:
                for name in axiom_names:
                    results = await axioms_graph.aretrieve(name, top_k=1)
                    if results:
                        dsl = results[0]['text']
                        formula = z3_engine.translate_dsl_text_to_z3(dsl)
                        if formula is not None:
                            axioms_z3.append((name, formula))

            rules_z3 = []
            if rule_names:
                for name in rule_names:
                    results = await rules_graph.aretrieve(name, top_k=1)
                    if results:
                        dsl = results[0]['text']
                        formula = z3_engine.translate_dsl_text_to_z3(dsl)
                        if formula is not None:
                            rules_z3.append((name, formula))

            facts_z3 = []
            if fact_contexts:
                for i, dsl in enumerate(fact_contexts):
                    formula = z3_engine.translate_dsl_text_to_z3(dsl)
                    if formula is not None:
                        facts_z3.append((f"fact_{i}", formula))

            result = z3_engine.prove_with_context(
                goal=goal_z3,
                axioms=axioms_z3 or None,
                rules=rules_z3 or None,
                facts=facts_z3 or None,
            )

            output_lines = [
                f"Z3 Proof Result: {result.status.value.upper()}",
                f"Message: {result.message}",
                "",
                "Proof Trace:",
            ]
            output_lines.extend([f"  {line}" for line in result.proof_trace])

            if result.model:
                output_lines.append("\nCounterexample found:")
                for k, v in result.model.items():
                    output_lines.append(f"  {k} = {v}")

            if result.used_axioms:
                output_lines.append(f"\nAxioms used: {result.used_axioms}")
            if result.used_rules:
                output_lines.append(f"Rules used: {result.used_rules}")

            log_event("agent.tool.completed", {
                "tool": "run_z3_proof",
                "status": result.status.value,
                "message": result.message,
            })

            return "\n".join(output_lines)

        except ContradictionError as e:
            log_event("agent.tool.failed", {
                "tool": "run_z3_proof",
                "error": str(e),
            })
            return f"CONTRADICTION DETECTED: {e}\nConflicting: {e.conflicting_formulas}"
        except Exception as e:
            logger.exception("Z3 proof error")
            log_event("agent.tool.failed", {
                "tool": "run_z3_proof",
                "error": str(e),
            })
            return f"ERROR during Z3 proof: {str(e)}"
    
    return FunctionTool.from_defaults(
        fn=run_z3_proof,
        async_fn=arun_z3_proof,
        name="run_z3_proof",
        description=(
            "Execute a formal proof using the Z3 theorem prover. "
            "Provide the goal in DSL format and specify which axioms, "
            "rules, and facts to use. Z3 will verify if the goal "
            "follows logically from the provided context. "
            "IMPORTANT: First retrieve relevant axioms/rules/facts before calling this."
        ),
    )


def create_store_theorem_tool(
    theorems_graph: TheoremsGraph,
    z3_engine: Z3ProofEngine,
) -> FunctionTool:
    """Create a tool for storing new theorems after successful proof."""
    
    def store_theorem(
        name: str,
        statement_dsl: str,
        proof_trace: list[str],
        used_axiom_ids: list[str] | None = None,
        used_rule_ids: list[str] | None = None,
    ) -> str:
        """
        Store a newly proven theorem in the theorems knowledge graph.
        
        IMPORTANT: Only call this after a successful Z3 proof or
        LLM-verified deduction. The theorem will be persisted and
        can be reused in future proofs.
        """
        try:
            log_event("agent.tool.started", {
                "tool": "store_theorem",
                "name": name,
                "statement_dsl": statement_dsl,
            })
            # First check consistency with existing theorems
            existing = theorems_graph.retrieve("all theorems", top_k=50)
            existing_dsl = [r.get("text", "") for r in existing if isinstance(r.get("text"), str)]

            guardrail = evaluate_statement_against_context(statement_dsl, existing_dsl)
            if not guardrail.get("ok"):
                reason = guardrail.get("reason")
                conflict = guardrail.get("conflict_with")
                log_event("agent.tool.rejected", {
                    "tool": "store_theorem",
                    "reason": reason,
                    "statement_dsl": statement_dsl,
                    "conflict_with": conflict,
                })
                return (
                    "CANNOT STORE: theorem rejected by DSL guardrails. "
                    f"Reason={reason}, conflict_with={conflict}"
                )

            existing_formulas = []
            for r in existing:
                formula = z3_engine.translate_dsl_text_to_z3(r['text'])
                if formula is not None:
                    existing_formulas.append((r['id'], formula))
            
            new_formula = z3_engine.translate_dsl_text_to_z3(statement_dsl)
            if new_formula is not None and existing_formulas:
                z3_engine.check_new_fact_consistency(
                    new_formula,
                    existing_formulas,
                )
            
            # Store the theorem
            theorem_id = theorems_graph.add_theorem(
                name=name,
                statement=statement_dsl,
                proof_trace=proof_trace,
                used_axioms=used_axiom_ids,
                used_rules=used_rule_ids,
            )
            log_event("agent.tool.completed", {
                "tool": "store_theorem",
                "name": name,
                "theorem_id": theorem_id,
            })
            
            return f"Successfully stored theorem '{name}' with ID: {theorem_id}"
            
        except ContradictionError as e:
            log_event("agent.tool.rejected", {
                "tool": "store_theorem",
                "reason": "z3-contradiction",
                "error": str(e),
            })
            return (
                f"CANNOT STORE: Would cause contradiction!\n"
                f"Message: {e}\n"
                f"Conflicting formulas: {e.conflicting_formulas}"
            )
        except Exception as e:
            logger.exception("Error storing theorem")
            log_event("agent.tool.failed", {
                "tool": "store_theorem",
                "error": str(e),
            })
            return f"ERROR storing theorem: {str(e)}"

    async def astore_theorem(
        name: str,
        statement_dsl: str,
        proof_trace: list[str],
        used_axiom_ids: list[str] | None = None,
        used_rule_ids: list[str] | None = None,
    ) -> str:
        try:
            log_event("agent.tool.started", {
                "tool": "store_theorem",
                "name": name,
                "statement_dsl": statement_dsl,
            })
            existing = await theorems_graph.aretrieve("all theorems", top_k=50)
            existing_dsl = [r.get("text", "") for r in existing if isinstance(r.get("text"), str)]

            guardrail = evaluate_statement_against_context(statement_dsl, existing_dsl)
            if not guardrail.get("ok"):
                reason = guardrail.get("reason")
                conflict = guardrail.get("conflict_with")
                log_event("agent.tool.rejected", {
                    "tool": "store_theorem",
                    "reason": reason,
                    "statement_dsl": statement_dsl,
                    "conflict_with": conflict,
                })
                return (
                    "CANNOT STORE: theorem rejected by DSL guardrails. "
                    f"Reason={reason}, conflict_with={conflict}"
                )

            existing_formulas = []
            for r in existing:
                formula = z3_engine.translate_dsl_text_to_z3(r['text'])
                if formula is not None:
                    existing_formulas.append((r['id'], formula))

            new_formula = z3_engine.translate_dsl_text_to_z3(statement_dsl)
            if new_formula is not None and existing_formulas:
                z3_engine.check_new_fact_consistency(
                    new_formula,
                    existing_formulas,
                )

            theorem_id = theorems_graph.add_theorem(
                name=name,
                statement=statement_dsl,
                proof_trace=proof_trace,
                used_axioms=used_axiom_ids,
                used_rules=used_rule_ids,
            )
            log_event("agent.tool.completed", {
                "tool": "store_theorem",
                "name": name,
                "theorem_id": theorem_id,
            })

            return f"Successfully stored theorem '{name}' with ID: {theorem_id}"

        except ContradictionError as e:
            log_event("agent.tool.rejected", {
                "tool": "store_theorem",
                "reason": "z3-contradiction",
                "error": str(e),
            })
            return (
                f"CANNOT STORE: Would cause contradiction!\n"
                f"Message: {e}\n"
                f"Conflicting formulas: {e.conflicting_formulas}"
            )
        except Exception as e:
            logger.exception("Error storing theorem")
            log_event("agent.tool.failed", {
                "tool": "store_theorem",
                "error": str(e),
            })
            return f"ERROR storing theorem: {str(e)}"
    
    return FunctionTool.from_defaults(
        fn=store_theorem,
        async_fn=astore_theorem,
        name="store_theorem",
        description=(
            "Store a newly proven theorem in the knowledge graph. "
            "Only use after successful Z3 proof or verified LLM deduction. "
            "The system will check for contradictions before storing."
        ),
    )


def create_store_business_fact_tool(
    domain_graph: BusinessDomainGraph,
    z3_engine: Z3ProofEngine,
) -> FunctionTool:
    """Create a tool for storing new business domain facts."""
    
    def store_business_fact(
        subject: str,
        predicate: str,
        object_value: str,
        entity_type: str = "entity",
    ) -> str:
        """
        Store a new business domain fact in the knowledge graph.
        
        Facts describe the banking app's structure:
        - Microservices and their endpoints
        - Screens and UI elements
        - User workflows and navigation
        """
        try:
            log_event("agent.tool.started", {
                "tool": "store_business_fact",
                "subject": subject,
                "predicate": predicate,
                "object_value": object_value,
                "entity_type": entity_type,
            })
            # Add the fact based on entity type
            if entity_type == "microservice":
                fact_id = domain_graph.add_microservice(
                    name=subject,
                    description=object_value,
                )
            elif entity_type == "screen":
                fact_id = domain_graph.add_screen(
                    name=subject,
                    description=object_value,
                )
            else:
                fact_id = domain_graph.add_fact(
                    subject=subject,
                    predicate=predicate,
                    object_=object_value,
                    properties={"entity_type": entity_type},
                )
            log_event("agent.tool.completed", {
                "tool": "store_business_fact",
                "fact_id": fact_id,
                "subject": subject,
            })
            
            return f"Successfully stored fact: {subject} {predicate} {object_value} (ID: {fact_id})"
            
        except Exception as e:
            logger.exception("Error storing business fact")
            log_event("agent.tool.failed", {
                "tool": "store_business_fact",
                "error": str(e),
            })
            return f"ERROR storing fact: {str(e)}"
    
    return FunctionTool.from_defaults(
        fn=store_business_fact,
        name="store_business_fact",
        description=(
            "Store a new business domain fact in the knowledge graph. "
            "Use this to add information about microservices, endpoints, "
            "screens, buttons, workflows, or other banking app entities."
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# AOP Symbolic Simplifier Tools
# ═══════════════════════════════════════════════════════════════════════════════

class SimplifyAOPInput(BaseModel):
    """Input schema for AOP simplification."""
    dsl_source: str = Field(description="DSL expression to simplify")


class CombineAOPsInput(BaseModel):
    """Input schema for combining AOPs."""
    dsl_sources: list[str] = Field(description="List of DSL expressions to combine")
    operator: str = Field(default="AND", description="Operator: 'AND' or 'OR'")


class NegateAOPInput(BaseModel):
    """Input schema for negating an AOP."""
    dsl_source: str = Field(description="DSL expression to negate")


class SubstituteAOPInput(BaseModel):
    """Input schema for variable substitution."""
    dsl_source: str = Field(description="DSL expression with variables")
    var_name: str = Field(description="Variable to replace (e.g., '?x')")
    replacement_dsl: str = Field(description="DSL expression to substitute")


class ConvertToCNFInput(BaseModel):
    """Input schema for CNF conversion."""
    dsl_source: str = Field(description="DSL expression to convert to CNF")


def create_simplify_aop_tool() -> FunctionTool:
    """Create a tool for simplifying AOP expressions symbolically."""
    
    def simplify_aop(dsl_source: str) -> str:
        """
        Simplify an AOP DSL expression using symbolic term rewriting.
        
        This is faster and more reliable than LLM-based simplification.
        
        Applies rules like:
        - Double negation elimination: NOT(NOT(A)) => A
        - De Morgan's laws
        - Absorption: A AND (A OR B) => A
        - Idempotence: A AND A => A
        - Identity: A AND TRUE => A, A OR FALSE => A
        - Complement: A AND NOT(A) => FALSE
        
        Use this instead of asking Gemini to simplify expressions.
        """
        from .aop_simplifier import simplify_aop as do_simplify
        
        result = do_simplify(dsl_source)
        
        if result.error:
            return f"ERROR: {result.error}"
        
        output_lines = [
            f"Original:   {result.original_dsl}",
            f"Simplified: {result.simplified_dsl}",
            f"Changed: {result.changed}",
        ]
        
        if result.rules_applied:
            output_lines.append(f"Rules applied: {', '.join(result.rules_applied)}")
        
        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=simplify_aop,
        name="simplify_aop",
        description=(
            "Simplify an AOP DSL expression using symbolic term rewriting. "
            "Applies algebraic simplification rules like double negation, "
            "De Morgan, absorption, idempotence, identity, and complement laws. "
            "Use this for reliable, deterministic simplification instead of LLM reasoning."
        ),
    )


def create_combine_aops_tool() -> FunctionTool:
    """Create a tool for combining AOPs with AND/OR."""
    
    def combine_aops(dsl_sources: list[str], operator: str = "AND") -> str:
        """
        Combine multiple AOP expressions with AND or OR and simplify.
        
        Use this to:
        - Merge preconditions: combine with AND
        - Union alternative paths: combine with OR
        - Build complex expressions from simpler parts
        
        The result is automatically simplified after combination.
        """
        from .aop_simplifier import combine_aops as do_combine
        
        if operator not in ("AND", "OR"):
            return f"ERROR: Invalid operator '{operator}'. Use 'AND' or 'OR'."
        
        result = do_combine(dsl_sources, operator)
        
        if result.error:
            return f"ERROR: {result.error}"
        
        output_lines = [
            f"Inputs ({len(dsl_sources)} expressions with {operator}):",
            *[f"  - {src}" for src in dsl_sources],
            f"Combined: {result.simplified_dsl}",
        ]
        
        if result.rules_applied:
            output_lines.append(f"Simplifications applied: {', '.join(result.rules_applied)}")
        
        return "\n".join(output_lines)
    
    return FunctionTool.from_defaults(
        fn=combine_aops,
        name="combine_aops",
        description=(
            "Combine multiple AOP expressions using AND or OR and simplify. "
            "Use for merging preconditions (AND) or unioning alternatives (OR). "
            "Result is automatically deduplicated and simplified."
        ),
    )


def create_negate_aop_tool() -> FunctionTool:
    """Create a tool for negating AOP expressions."""
    
    def negate_aop(dsl_source: str) -> str:
        """
        Negate an AOP expression and simplify.
        
        Use this to:
        - Create the negation of a condition
        - Check for contradictions (if A AND NOT(A) is inconsistent)
        - Build contrapositive forms
        
        Double negation is automatically eliminated.
        """
        from .aop_simplifier import negate_aop as do_negate
        
        result = do_negate(dsl_source)
        
        if result.error:
            return f"ERROR: {result.error}"
        
        return f"NOT({result.original_dsl}) => {result.simplified_dsl}"
    
    return FunctionTool.from_defaults(
        fn=negate_aop,
        name="negate_aop",
        description=(
            "Negate an AOP expression and simplify the result. "
            "Double negation is automatically eliminated. "
            "Use for creating condition negations or building contrapositives."
        ),
    )


def create_substitute_aop_tool() -> FunctionTool:
    """Create a tool for variable substitution in AOPs."""
    
    def substitute_aop(dsl_source: str, var_name: str, replacement_dsl: str) -> str:
        """
        Substitute a variable in an AOP expression with another expression.
        
        Example:
        - Expression: HasRole(?u, "admin") AND CanAccess(?u, ?resource)
        - Variable: ?u
        - Replacement: "john_doe"
        - Result: HasRole("john_doe", "admin") AND CanAccess("john_doe", ?resource)
        
        Use this to instantiate universal quantifiers or apply specific values.
        """
        from .aop_simplifier import substitute_in_aop as do_substitute
        
        result = do_substitute(dsl_source, var_name, replacement_dsl)
        
        if result.error:
            return f"ERROR: {result.error}"
        
        return f"SUBST({var_name} -> {replacement_dsl}):\n  {result.original_dsl}\n=> {result.simplified_dsl}"
    
    return FunctionTool.from_defaults(
        fn=substitute_aop,
        name="substitute_aop",
        description=(
            "Substitute all occurrences of a variable in an AOP expression. "
            "Use to instantiate universal quantifiers or apply specific values. "
            "Variable names include the '?' prefix (e.g., '?x', '?user')."
        ),
    )


def create_convert_to_cnf_tool() -> FunctionTool:
    """Create a tool for converting expressions to CNF."""
    
    def convert_to_cnf(dsl_source: str) -> str:
        """
        Convert an AOP expression to Conjunctive Normal Form (CNF).
        
        CNF is an AND of ORs, which is the standard form for:
        - Resolution-based theorem proving
        - SAT solvers
        - Systematic proof search
        
        Example:
        - Input: A IMPLIES (B OR C)
        - CNF: NOT(A) OR B OR C
        """
        from .aop_simplifier import convert_to_cnf as do_convert
        
        result = do_convert(dsl_source)
        
        if result.error:
            return f"ERROR: {result.error}"
        
        return f"CNF Conversion:\n  Original: {result.original_dsl}\n  CNF: {result.simplified_dsl}"
    
    return FunctionTool.from_defaults(
        fn=convert_to_cnf,
        name="convert_to_cnf",
        description=(
            "Convert an AOP expression to Conjunctive Normal Form (AND of ORs). "
            "CNF is useful for resolution-based theorem proving and SAT solvers. "
            "Implications are expanded and negations pushed inward."
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Tool Export Aliases
# ═══════════════════════════════════════════════════════════════════════════════

# These are the actual tool classes (just aliases for documentation)
RetrieveAxiomsTool = create_retrieve_axioms_tool
RetrieveDeductionRulesTool = create_retrieve_deduction_rules_tool
RetrieveBusinessFactsTool = create_retrieve_business_facts_tool
RetrieveTheoremsTool = create_retrieve_theorems_tool
RunZ3ProofTool = create_run_z3_proof_tool
StoreTheoremTool = create_store_theorem_tool
StoreBusinessFactTool = create_store_business_fact_tool

# AOP Simplifier tools
SimplifyAOPTool = create_simplify_aop_tool
CombineAOPsTool = create_combine_aops_tool
NegateAOPTool = create_negate_aop_tool
SubstituteAOPTool = create_substitute_aop_tool
ConvertToCNFTool = create_convert_to_cnf_tool


# ═══════════════════════════════════════════════════════════════════════════════
# Dual Retriever Tool (Vector + Cypher)
# ═══════════════════════════════════════════════════════════════════════════════

def create_graph_context_search_tool(
    dual_retriever: Any | None = None,
) -> FunctionTool | None:
    """Create a tool that combines vector search with Cypher graph traversal."""
    if dual_retriever is None:
        return None

    async def graph_context_search(query: str, top_k: int = 10) -> str:
        """
        Search the knowledge graph using both semantic similarity AND
        structural graph traversal (Cypher).

        This finds:
        1. Semantically similar DSL statements (vector search)
        2. Structurally related nodes via dependency edges (Cypher expansion)

        Use this for deduction when you need both relevant axioms/rules AND
        their graph dependencies (DERIVED_FROM, USES, IMPLEMENTS chains).
        """
        log_event("agent.tool.started", {
            "tool": "graph_context_search",
            "query": query,
            "top_k": top_k,
        })
        results = await dual_retriever.aretrieve(query, top_k=top_k)
        if not results:
            return "No relevant context found in the knowledge graph."

        output_lines = ["Retrieved Context (Vector + Graph):"]
        for i, r in enumerate(results, 1):
            source = r.get("source", "unknown")
            meta = r.get("metadata", {})
            output_lines.append(f"\n{i}. [{source.upper()}] {meta.get('label', meta.get('type', ''))}")
            output_lines.append(f"   DSL: {r['text']}")
            output_lines.append(f"   Score: {r['score']:.3f}")
            if meta.get("graph_distance") is not None:
                output_lines.append(f"   Graph distance: {meta['graph_distance']} hops")

        log_event("agent.tool.completed", {
            "tool": "graph_context_search",
            "result_count": len(results),
        })
        return "\n".join(output_lines)

    return FunctionTool.from_defaults(
        async_fn=graph_context_search,
        name="graph_context_search",
        description=(
            "Deep search that finds facts and their related context and dependencies."
        ),
    )


def create_all_tools(
    axioms_graph: AxiomsGraph,
    rules_graph: DeductionRulesGraph,
    domain_graph: BusinessDomainGraph,
    theorems_graph: TheoremsGraph,
    z3_engine: Z3ProofEngine,
    dual_retriever: Any | None = None,
) -> list[FunctionTool]:
    """
    Create all agent tools with the provided graph and engine instances.
    
    Returns a list of FunctionTools ready for use with LlamaIndex agents.
    """
    tools = [
        create_retrieve_axioms_tool(axioms_graph),
        create_retrieve_deduction_rules_tool(rules_graph),
        create_retrieve_business_facts_tool(domain_graph),
        create_retrieve_theorems_tool(theorems_graph),
        create_run_z3_proof_tool(z3_engine, axioms_graph, rules_graph),
        create_store_theorem_tool(theorems_graph, z3_engine),
        create_store_business_fact_tool(domain_graph, z3_engine),
        # AOP Symbolic Manipulation Tools (deterministic, no LLM needed)
        create_simplify_aop_tool(),
        create_combine_aops_tool(),
        create_negate_aop_tool(),
        create_substitute_aop_tool(),
        create_convert_to_cnf_tool(),
    ]
    # Add dual retriever tool if available
    graph_tool = create_graph_context_search_tool(dual_retriever)
    if graph_tool is not None:
        tools.append(graph_tool)
    return tools
