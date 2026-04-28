"""
Chat Reasoning Agent (DSL-Only)
================================
Specialized agent for RAG-enabled chat with Z3 deduction.

CRITICAL: All reasoning between Gemini and Z3 happens EXCLUSIVELY in DSL format.
Natural language is used ONLY for:
1. Understanding the user's initial question
2. Presenting the final answer to the user

The workflow:
1. User asks question (natural language)
2. Agent translates to DSL query
3. RAG retrieves relevant DSL facts/axioms/rules
4. Agent formulates deduction in DSL
5. Z3 validates/proves DSL statements
6. Agent generates conjectures in DSL (if needed)
7. Z3 validates conjectures in DSL
8. Final DSL results translated to natural language for user
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import re

from llama_index.core.agent import ReActAgent
from llama_index.core.agent.react.output_parser import ReActOutputParser
from llama_index.core.llms import LLM
from llama_index.core.tools import FunctionTool

from ..config import settings
from .property_graphs import (
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ContradictionError
from ..telemetry import log_event, set_active_session

logger = logging.getLogger(__name__)


class LenientReActOutputParser(ReActOutputParser):
    """Output parser that tolerates Gemini omitting the ``Thought:`` line.

    LlamaIndex's default ``extract_tool_use`` regex requires *something*
    before ``\\n+Action:``.  When the LLM emits ``Action:`` on the very
    first line the regex never matches, causing an infinite retry loop.

    This subclass detects the missing ``Thought:`` prefix and inserts a
    synthetic one so the downstream regex succeeds on the first try.
    """

    def parse(self, output: str, is_streaming: bool = False):
        # If the output starts with "Action:" (no Thought:), prepend one.
        stripped = output.strip()
        if re.match(r"^Action:", stripped, re.IGNORECASE) and not re.search(
            r"Thought:", stripped[: stripped.find("Action:")], re.IGNORECASE
        ):
            output = f"Thought: I will use a tool.\n{stripped}"
        return super().parse(output, is_streaming=is_streaming)


@dataclass
class ChatReasoningResult:
    """Result from processing a chat message."""
    answer: str  # Natural language answer for user
    dsl_conclusion: str = ""  # Final DSL conclusion
    proof_trace: list[str] = field(default_factory=list)  # DSL proof steps
    facts_used: list[str] = field(default_factory=list)  # DSL facts from RAG
    conjectures_made: list[str] = field(default_factory=list)  # DSL conjectures
    z3_validations: list[dict[str, Any]] = field(default_factory=list)
    new_facts: list[dict[str, Any]] = field(default_factory=list)  # New DSL facts
    is_conjecture: bool = False  # True when answer is a conjecture (no RAG found)
    retrieved_rag_nodes: list[dict[str, Any]] = field(default_factory=list)
    status: str = "success"


# System prompt — Conversational Coordinator Agent
CHAT_REASONING_PROMPT = """You are a helpful customer service assistant answering the user's questions in their language.
The knowledge base (accessed via your retrieval tools) is the single source of absolute global truth.
You must maintain a friendly and conversational tone with the user, incorporating their current conversational (ephemeral) state gracefully.

RULES:
1. WHEN TO SEARCH: You MUST call retrieval tools to search for knowledge ONLY IF the user asks for factual knowledge, business rules, or domain logic. 
   - If the user is just making conversational chat, greeting you, or stating/asking about their own ephemeral identity (e.g., "Hello", "My name is Andres", "What is my name?"), DO NOT search tools for that. Just use the CONVERSATION HISTORY to answer naturally.
2. If KNOWLEDGE IS FOUND IN TOOLS: Answer the user naturally and directly. NEVER mention that you searched a database, graph, DSL, or tools. Just speak as if you know it.
3. IF RELEVANT GLOBAL KNOWLEDGE IS MISSING (after searching):
   - You may formulate a natural-language conjecture representing the missing global fact (e.g., "The user works at Acme Corp").
   - CRITICAL: DO NOT formulate conjectures about the user's ephemeral conversational state (e.g., DO NOT make conjectures like "User's name is Unknown"). Conjectures must only be stable, global business facts.
   - If a valid global conjecture is possible, pass it to the `record_conjecture` tool. After it's archived, answer the user normally indicating your assumption.
   - If it's just a conversational question and info is missing, just answer normally without calling the tool.
4. If conjectures are NOT allowed (per context): Simply tell the user you don't have the factual answer.
5. TRUST THE CONVERSATION HISTORY: NEVER contradict, doubt, or retroactively correct the Assistant's previous statements in the CONVERSATION HISTORY. Assume that all previous Assistant responses were based on absolute ground truth retrieved successfully at that time, even if they seem factually incorrect or strange outside of this specific business domain.
"""

DSL_ARCHIVIST_PROMPT = """You are a strict DSL encoding specialist.
Your ONLY job is to translate the following natural language conjecture into valid formal DSL syntax.
DO NOT output any conversational text, explanations, or Markdown code blocks. Output ONLY the DSL statement.
Use standard Predicates or AXIOMs.
Example output: PredicateName("Arg1", "Arg2").

Translate this conjecture to strict DSL:
"{conjecture}"
"""


class ChatReasoningAgent(ReActAgent):
    """
    Agent for RAG-enabled chat with DSL-only reasoning.
    
    All reasoning between this agent and Z3 happens in DSL format.
    Natural language is only used for user interaction.
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
        dual_retriever: Any | None = None,
        max_iterations: int = 10,
    ) -> None:
        tools = self._create_rag_tools(dual_retriever)
        
        super().__init__(
            tools=tools,
            llm=llm,
            verbose=True,
            max_iterations=max_iterations,
            system_prompt=CHAT_REASONING_PROMPT,
        )
        
        self._tools = tools
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine or Z3ProofEngine()
        self._dual_retriever = dual_retriever
        self._active_session_id: str | None = None
        
        # Tracking state (reset per message) - all in DSL format
        self._dsl_facts_used: list[str] = []
        self._dsl_conjectures_made: list[str] = []
        self._z3_validations: list[dict[str, Any]] = []
        self._new_dsl_facts: list[dict[str, Any]] = []
        self._proof_trace: list[str] = []
        self._retrieved_rag_nodes: list[dict[str, Any]] = []
        
        self.output_parser = LenientReActOutputParser()
        
        logger.info("ChatReasoningAgent initialized natively with %d tools", len(self._tools))
    
    def _track_rag_results(self, results: list[dict[str, Any]], tool_name: str) -> None:
        """Accumulate retrieved RAG nodes for conjecture attribution."""
        for r in results:
            self._retrieved_rag_nodes.append({
                "node_id": r.get("id", ""),
                "text": (r.get("text", "") or "")[:300],
                "score": r.get("score", 0.0),
                "source_tool": tool_name,
                "metadata": r.get("metadata", {}),
            })

    def _create_rag_tools(self, dual_retriever: Any | None = None) -> list[FunctionTool]:
        """Create retrieval tools that also track RAG nodes for conjecture attribution."""
        agent = self
        tools: list[FunctionTool] = []

        async def _axioms(query: str, top_k: int = 5) -> str:
            """Search and retrieve foundational facts and rules."""
            results = await agent._axioms_graph.aretrieve(query, top_k=top_k, include_relations=True)
            agent._track_rag_results(results, "retrieve_axioms")
            if not results:
                return "No relevant axioms found for the given query."
            lines = ["Retrieved Axioms:"]
            for i, r in enumerate(results, 1):
                lines.append(f"\n{i}. {r['metadata'].get('label', 'Unknown')}")
                lines.append(f"   DSL: {r['text']}")
                lines.append(f"   Score: {r['score']:.3f}")
            return "\n".join(lines)
        tools.append(FunctionTool.from_defaults(async_fn=_axioms, name="retrieve_axioms",
            description="Search and retrieve foundational facts and rules."))

        async def _rules(query: str, top_k: int = 5) -> str:
            """Search and retrieve inference rules and logical relationships."""
            results = await agent._rules_graph.aretrieve(query, top_k=top_k)
            agent._track_rag_results(results, "retrieve_deduction_rules")
            if not results:
                return "No relevant deduction rules found for the given query."
            lines = ["Retrieved Deduction Rules:"]
            for i, r in enumerate(results, 1):
                meta = r['metadata']
                lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
                lines.append(f"   DSL: {r['text']}")
                lines.append(f"   Score: {r['score']:.3f}")
            return "\n".join(lines)
        tools.append(FunctionTool.from_defaults(async_fn=_rules, name="retrieve_deduction_rules",
            description="Search and retrieve inference rules and logical relationships."))

        async def _facts(query: str, top_k: int = 10) -> str:
            """Search and retrieve facts about any topic stored in the knowledge base."""
            results = await agent._domain_graph.aretrieve(query, top_k=top_k)
            agent._track_rag_results(results, "retrieve_business_facts")
            if not results:
                return "No relevant business facts found for the given query."
            lines = ["Retrieved Business Domain Facts:"]
            for i, r in enumerate(results, 1):
                meta = r['metadata']
                lines.append(f"\n{i}. [{meta.get('entity_type', 'fact')}] {meta.get('subject', 'Unknown')}")
                lines.append(f"   Relation: {meta.get('predicate', '?')} -> {meta.get('object', '?')}")
                lines.append(f"   Full: {r['text']}")
                lines.append(f"   Score: {r['score']:.3f}")
            return "\n".join(lines)
        tools.append(FunctionTool.from_defaults(async_fn=_facts, name="retrieve_business_facts",
            description="Search and retrieve facts about any topic stored in the knowledge base."))

        async def _theorems(query: str, top_k: int = 5) -> str:
            """Search and retrieve derived conclusions and known facts."""
            results = await agent._theorems_graph.aretrieve(query, top_k=top_k)
            agent._track_rag_results(results, "retrieve_theorems")
            if not results:
                return "No relevant theorems or AOPs found for the given query."
            lines = ["Retrieved Theorems/AOPs:"]
            for i, r in enumerate(results, 1):
                meta = r['metadata']
                lines.append(f"\n{i}. {meta.get('label', 'Unknown')}")
                lines.append(f"   Statement: {r['text']}")
                lines.append(f"   Score: {r['score']:.3f}")
            return "\n".join(lines)
        tools.append(FunctionTool.from_defaults(async_fn=_theorems, name="retrieve_theorems",
            description="Search and retrieve derived conclusions and known facts."))

        if dual_retriever is not None:
            async def _graph_search(query: str, top_k: int = 10) -> str:
                """Deep search that finds facts and their related context and dependencies."""
                results = await agent._dual_retriever.aretrieve(query, top_k=top_k)
                agent._track_rag_results(results, "graph_context_search")
                if not results:
                    return "No relevant context found in the knowledge graph."
                lines = ["Retrieved Context (Vector + Graph):"]
                for i, r in enumerate(results, 1):
                    source = r.get("source", "unknown")
                    meta = r.get("metadata", {})
                    lines.append(f"\n{i}. [{source.upper()}] {meta.get('label', meta.get('type', ''))}")
                    lines.append(f"   DSL: {r['text']}")
                    lines.append(f"   Score: {r['score']:.3f}")
                return "\n".join(lines)
            tools.append(FunctionTool.from_defaults(async_fn=_graph_search, name="graph_context_search",
                description="Deep search that finds facts and their related context and dependencies."))

        async def _record_conjecture(conjecture_nl: str) -> str:
            """
            Use this tool to submit a factual conjecture (in natural language) when the RAG supervisors 
            cannot find the relevant global knowledge. Do NOT use for ephemeral chat states.
            """
            try:
                # LLM call to translate NLP conjecture to Strict DSL
                prompt = DSL_ARCHIVIST_PROMPT.format(conjecture=conjecture_nl)
                response = await agent.llm.acomplete(prompt)
                dsl_text = response.text.strip()
                agent._dsl_conjectures_made.append(dsl_text)
                
                # Attributions
                rag_source_ids = [n["node_id"] for n in agent._retrieved_rag_nodes if n.get("node_id")]
                
                ast_components = []
                try:
                    from ..dsl.parser import DSLParser
                    from ..dsl.translator import ast_to_dict
                    parser = DSLParser()
                    ast_nodes = parser.parse(dsl_text)
                    ast_components = [ast_to_dict(n) for n in ast_nodes] if ast_nodes else []
                except Exception as e:
                    logger.warning("Failed to parse conjecture DSL for AST components: %s", e)
                
                agent._new_dsl_facts.append({
                    "dsl": dsl_text,
                    "type": "fact",
                    "origin": "ai_conjecture",
                    "confidence": 0.3,
                    "description": conjecture_nl,
                    "rag_sources": rag_source_ids,
                    "ast_components": ast_components,
                })
                agent._proof_trace.append(f"[CONJECTURE RECORDED] {dsl_text}")
                logger.info("Archivist generated DSL: %s", dsl_text)
                return f"Conjecture successfully recorded as DSL: {dsl_text}. You may now respond to the user."
            except Exception as e:
                logger.error("Failed to record conjecture: %s", e)
                return f"Error recording conjecture: {str(e)}"

        tools.append(FunctionTool.from_defaults(async_fn=_record_conjecture, name="record_conjecture",
            description="Encode and submit a factual conjecture (natural language) explicitly when RAG facts are insufficient."))

        return tools
    
    def _reset_tracking(self) -> None:
        """Reset tracking state for a new message."""
        self._dsl_facts_used = []
        self._dsl_conjectures_made = []
        self._z3_validations = []
        self._new_dsl_facts = []
        self._proof_trace = []
        self._retrieved_rag_nodes = []
    
    # ═══════════════════════════════════════════════════════════════════════════
    # Main Processing
    # ═══════════════════════════════════════════════════════════════════════════
    
    async def process_chat_message(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        allow_conjectures: bool = True,
    ) -> ChatReasoningResult:
        """
        Process a chat message with pure RAG retrieval from Neo4j.
        """
        self._reset_tracking()
        self._active_session_id = (context or {}).get("session_id")
        set_active_session(self._active_session_id)
        
        self._proof_trace.append(f"[USER QUERY] {message}")
        log_event("chat.agent.process.started", {
            "session_id": self._active_session_id,
            "message_preview": message[:300],
            "allow_conjectures": allow_conjectures,
        })
        
        try:
            augmented_query = self._build_query(message, context)
            
            # Run the native ReActAgent workflow
            response = await self.run(user_msg=augmented_query)
            
            answer = str(response)
            self._proof_trace.append(f"[FINAL ANSWER] {answer[:200]}...")
            
            # Extract DSL conclusion if present
            dsl_conclusion = self._extract_dsl_conclusion()
            
            # Conjectures are now handled directly by the internal LLM tool `_record_conjecture`.
            is_conjecture = len(self._dsl_conjectures_made) > 0
            
            # Check for contradictions
            if "CONTRADICTION" in answer.upper():
                log_event("chat.agent.process.completed", {
                    "session_id": self._active_session_id,
                    "status": "contradiction",
                    "facts_used": len(self._dsl_facts_used),
                    "conjectures": len(self._dsl_conjectures_made),
                    "z3_validations": len(self._z3_validations),
                })
                return ChatReasoningResult(
                    answer=answer,
                    dsl_conclusion=dsl_conclusion,
                    proof_trace=self._proof_trace,
                    facts_used=self._dsl_facts_used,
                    conjectures_made=self._dsl_conjectures_made,
                    z3_validations=self._z3_validations,
                    new_facts=self._new_dsl_facts,
                    is_conjecture=is_conjecture,
                    retrieved_rag_nodes=self._retrieved_rag_nodes,
                    status="contradiction",
                )
            
            log_event("chat.agent.process.completed", {
                "session_id": self._active_session_id,
                "status": "conjecture" if is_conjecture else "success",
                "is_conjecture": is_conjecture,
                "facts_used": len(self._dsl_facts_used),
                "conjectures": len(self._dsl_conjectures_made),
                "z3_validations": len(self._z3_validations),
                "rag_nodes_retrieved": len(self._retrieved_rag_nodes),
            })
            return ChatReasoningResult(
                answer=answer,
                dsl_conclusion=dsl_conclusion,
                proof_trace=self._proof_trace,
                facts_used=self._dsl_facts_used,
                conjectures_made=self._dsl_conjectures_made,
                z3_validations=self._z3_validations,
                new_facts=self._new_dsl_facts,
                is_conjecture=is_conjecture,
                retrieved_rag_nodes=self._retrieved_rag_nodes,
                status="conjecture" if is_conjecture else "success",
            )
            
        except ContradictionError as e:
            log_event("chat.agent.process.failed", {
                "session_id": self._active_session_id,
                "status": "contradiction-error",
                "error": str(e),
            })
            return ChatReasoningResult(
                answer=f"Contradiction detected: {e}",
                proof_trace=self._proof_trace + e.proof_trace,
                facts_used=self._dsl_facts_used,
                conjectures_made=self._dsl_conjectures_made,
                z3_validations=self._z3_validations,
                new_facts=[],
                status="contradiction",
            )
        except Exception as e:
            logger.exception("Error processing chat message")
            log_event("chat.agent.process.failed", {
                "session_id": self._active_session_id,
                "status": "error",
                "error": str(e),
            })
            return ChatReasoningResult(
                answer=f"Error: {e}",
                proof_trace=self._proof_trace + [f"ERROR: {e}"],
                facts_used=self._dsl_facts_used,
                conjectures_made=self._dsl_conjectures_made,
                z3_validations=self._z3_validations,
                new_facts=self._new_dsl_facts,
                status="error",
            )
        finally:
            set_active_session(None)

    def _build_query(
        self,
        message: str,
        context: dict[str, Any] | None,
    ) -> str:
        """Build the query for the RAG agent."""
        allow_conjectures = (context or {}).get("allow_conjectures", True)
        
        parts = []
        
        # Inject Tracked EPHEMERAL STATE (Dynamic JSON)
        user_state = (context or {}).get("user_state", {})
        if user_state:
            import json
            parts.append("--- CURRENT USER EPHEMERAL STATE ---")
            parts.append(json.dumps(user_state, indent=2, ensure_ascii=False))
            parts.append("------------------------------------\n")
            
        # Inject Chat History textually so the agent doesn't forget the flow
        hist = (context or {}).get("conversation_history", [])
        if hist:
            parts.append("--- CONVERSATION HISTORY (Ephemeral State) ---")
            for msg in hist[-6:]:  # Include last 6 messages for brevity and memory
                role = "User" if msg.role.value == "user" else "Assistant"
                parts.append(f"{role}: {msg.content}")
            parts.append("----------------------------------------------\n")
            
        parts.extend([
            f"User's Current Message: {message}",
            "",
            "Search the knowledge graph with retrieve_business_facts (and any other relevant retrieval tools) before answering.",
        ])
        
        if allow_conjectures:
            parts.append("If no relevant information is found, use the record_conjecture tool to postulate a global fact.")
        else:
            parts.append("If no relevant information is found, say so. Do NOT conjecture and do NOT use record_conjecture.")
            
        if context:
            explicit_ctx = {k: v for k, v in context.items()
                            if k not in ("session_id", "allow_conjectures", "conversation_history", "user_state")}
            if explicit_ctx:
                parts.append(f"Additional context: {explicit_ctx}")
        return "\n".join(parts)

    def _extract_dsl_conclusion(self) -> str:
        return ""

