"""
Reasoning Agent
===============
Main LlamaIndex agent that orchestrates:
1. RAG retrieval from PropertyGraphIndex stores
2. Z3 formal proof execution
3. LLM-based deduction when Z3 is insufficient
4. Iterative reasoning loop combining Z3 + LLM

The agent uses a collaborative LLM + Z3 process:
- LLM generates proof attempts
- Z3 checks for correctness
- When contradiction: LLM reports to user
- When incomplete: LLM retries with new context
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from llama_index.core.agent import ReActAgent
from llama_index.core.llms import LLM
from llama_index.core.tools import FunctionTool

from ..config import settings
from .property_graphs import (
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ProofResult, ProofStatus, ContradictionError
from .tools import create_all_tools

logger = logging.getLogger(__name__)


class ReasoningStatus(str, Enum):
    """Status of a reasoning request."""
    SUCCESS = "success"               # Successfully answered/proved
    PARTIAL = "partial"               # Partial answer, incomplete proof
    CONTRADICTION = "contradiction"   # Contradiction detected
    INFEASIBLE = "infeasible"         # Cannot answer with available info
    ERROR = "error"                   # Error during reasoning


@dataclass
class ReasoningResult:
    """Result of a reasoning request."""
    status: ReasoningStatus
    answer: str
    proof_trace: list[str] = field(default_factory=list)
    deduced_theorems: list[dict[str, Any]] = field(default_factory=list)
    deduced_facts: list[dict[str, Any]] = field(default_factory=list)
    used_axioms: list[str] = field(default_factory=list)
    used_rules: list[str] = field(default_factory=list)
    contradiction_info: dict[str, Any] | None = None
    iterations: int = 0


# System prompt for the reasoning agent
REASONING_AGENT_PROMPT = """You are a symbolic logic reasoning agent for a banking customer service application.

Your role is to assist users by:
1. Retrieving relevant information from our knowledge graphs (axioms, rules, business facts, theorems)
2. Running formal proofs using the Z3 theorem prover to verify logical statements
3. Deducing new facts and procedures when possible
4. Storing successfully proven theorems and discovered facts

IMPORTANT GUIDELINES:

## Knowledge Sources
- **Axioms**: Immutable logical truths. Use retrieve_axioms to get foundational logic.
- **Deduction Rules**: Hilbert-style rules for deriving conclusions. Use retrieve_deduction_rules.
- **Business Facts**: Information about microservices, screens, workflows. Use retrieve_business_facts.
- **Theorems**: Previously proven statements. Use retrieve_theorems before proving something new.

## Reasoning Process
1. First, always retrieve relevant context using the retrieval tools
2. Try to prove statements formally using run_z3_proof with retrieved axioms and rules
3. If Z3 proof succeeds, consider storing the result using store_theorem
4. If Z3 proof fails or is insufficient:
   a. Check if more context is needed (retrieve more)
   b. Try reasoning yourself using the DSL and retrieved context
   c. If still insufficient AND no more relevant info exists, report infeasibility

## Z3 Integration
- Z3 can ONLY use information you explicitly provide
- Before calling run_z3_proof, gather all relevant axioms, rules, and facts
- If Z3 reports INVALID with a counterexample, analyze why and report to user
- If Z3 reports CONTRADICTION, this is critical - DO NOT store contradictory results

## Storing Results
- Only store theorems after successful Z3 verification OR confident LLM deduction
- When storing, include the full proof trace and which axioms/rules were used
- New business facts discovered should also be stored

## Error Handling
- If you detect a contradiction, report it clearly to the user
- If the request is infeasible (not enough information), explain what's missing
- Never make up information not from our knowledge graphs

Remember: You must ONLY use information from our PropertyGraphIndex stores. Do not use external knowledge.
"""


class ReasoningAgent(ReActAgent):
    """
    Main reasoning agent combining LLM and Z3 for formal proofs.
    
    Implements an iterative reasoning loop:
    1. LLM retrieves context via RAG
    2. LLM formulates proof attempt
    3. Z3 verifies correctness
    4. If incomplete/invalid, LLM adjusts and retries
    5. On success, stores results; on contradiction, reports to user
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
        max_iterations: int = 5,
    ) -> None:
        z3_engine = z3_engine or Z3ProofEngine()
        
        # Create tools
        tools = create_all_tools(
            axioms_graph=axioms_graph,
            rules_graph=rules_graph,
            domain_graph=domain_graph,
            theorems_graph=theorems_graph,
            z3_engine=z3_engine,
        )
        
        # Initialize parent ReActAgent workflow
        super().__init__(
            tools=tools,
            llm=llm,
            verbose=True,
            max_iterations=max_iterations * 3,
            system_prompt=REASONING_AGENT_PROMPT,
        )
        
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine
        self._max_iterations = max_iterations
        self._tools = tools
        
        logger.info("ReasoningAgent initialized natively with %d tools", len(self._tools))
    
    async def reason(
        self,
        query: str,
        context: dict[str, Any] | None = None,
    ) -> ReasoningResult:
        """
        Process a reasoning request.
        
        Args:
            query: The user's question or task
            context: Optional additional context
            
        Returns:
            ReasoningResult with answer, proof trace, and status
        """
        proof_trace = [f"Query: {query}"]
        deduced_theorems = []
        deduced_facts = []
        used_axioms = []
        used_rules = []
        iterations = 0
        
        try:
            # Augment query with context if provided
            augmented_query = query
            if context:
                augmented_query = f"{query}\n\nAdditional context: {context}"
            
            # Run the agent natively
            response = await self.run(user_msg=augmented_query)
            
            # Extract answer
            answer = str(response)
            proof_trace.append(f"Agent response: {answer}")
            
            # Check for contradiction indicators in response
            if "CONTRADICTION" in answer.upper():
                return ReasoningResult(
                    status=ReasoningStatus.CONTRADICTION,
                    answer=answer,
                    proof_trace=proof_trace,
                    contradiction_info={"detected_in": "agent_response"},
                )
            
            # Check for infeasibility indicators
            if any(phrase in answer.lower() for phrase in [
                "cannot determine", "not enough information",
                "insufficient", "unable to prove", "no relevant",
            ]):
                return ReasoningResult(
                    status=ReasoningStatus.INFEASIBLE,
                    answer=answer,
                    proof_trace=proof_trace,
                )
            
            # Success
            return ReasoningResult(
                status=ReasoningStatus.SUCCESS,
                answer=answer,
                proof_trace=proof_trace,
                deduced_theorems=deduced_theorems,
                deduced_facts=deduced_facts,
                used_axioms=used_axioms,
                used_rules=used_rules,
                iterations=iterations,
            )
            
        except ContradictionError as e:
            return ReasoningResult(
                status=ReasoningStatus.CONTRADICTION,
                answer=f"Contradiction detected: {e}",
                proof_trace=proof_trace + e.proof_trace,
                contradiction_info={
                    "message": str(e),
                    "conflicting_formulas": e.conflicting_formulas,
                },
            )
        except Exception as e:
            logger.exception("Error during reasoning")
            return ReasoningResult(
                status=ReasoningStatus.ERROR,
                answer=f"Error during reasoning: {e}",
                proof_trace=proof_trace + [f"Error: {e}"],
            )
    
    def reason_sync(
        self,
        query: str,
        context: dict[str, Any] | None = None,
    ) -> ReasoningResult:
        """Synchronous version of reason()."""
        import asyncio
        return asyncio.run(self.reason(query, context))
    
    async def prove_statement(
        self,
        statement_dsl: str,
        hint: str | None = None,
    ) -> ReasoningResult:
        """
        Attempt to prove a specific DSL statement.
        
        This is a more focused entry point for formal proofs.
        """
        query = f"Please prove the following DSL statement: {statement_dsl}"
        if hint:
            query += f"\n\nHint: {hint}"
        
        return await self.reason(query)
    
    async def answer_question(
        self,
        question: str,
        require_proof: bool = False,
    ) -> ReasoningResult:
        """
        Answer a question about the banking app or domain.
        
        Args:
            question: Natural language question
            require_proof: If True, requires Z3 verification
        """
        if require_proof:
            query = (
                f"Answer this question with formal proof: {question}\n"
                "You MUST verify your answer using run_z3_proof."
            )
        else:
            query = question
        
        return await self.reason(query)
    
    def clear_memory(self) -> None:
        """Clear the agent's conversation memory."""
        self.memory.reset()
        logger.info("Agent memory cleared")
    
    @property
    def tools(self) -> list[FunctionTool]:
        """Get the list of tools available to the agent."""
        return self._tools


def create_reasoning_agent(
    llm: LLM | None = None,
    graph_store: Any = None,
) -> ReasoningAgent:
    """
    Factory function to create a ReasoningAgent with default configuration.
    
    Args:
        llm: LlamaIndex LLM instance (defaults to GoogleGenAI)
        graph_store: Neo4jGraphStore instance for persistence
        
    Returns:
        Configured ReasoningAgent
    """
    from ..knowledge_graph import Neo4jGraphStore
    
    # Build LLM if not provided
    if llm is None:
        from llama_index.llms.google_genai import GoogleGenAI
        llm = GoogleGenAI(
            model=settings.llm_model,
            api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
        )
    
    # Build graph store
    store = graph_store or Neo4jGraphStore()
    
    # Build property graphs
    axioms_graph = AxiomsGraph(graph_store=store, llm=llm)
    rules_graph = DeductionRulesGraph(graph_store=store, llm=llm)
    domain_graph = BusinessDomainGraph(graph_store=store, llm=llm)
    theorems_graph = TheoremsGraph(graph_store=store, llm=llm)
    
    # Build Z3 engine
    z3_engine = Z3ProofEngine(timeout_ms=settings.dsl_max_deduction_steps * 1000)
    
    return ReasoningAgent(
        llm=llm,
        axioms_graph=axioms_graph,
        rules_graph=rules_graph,
        domain_graph=domain_graph,
        theorems_graph=theorems_graph,
        z3_engine=z3_engine,
    )
