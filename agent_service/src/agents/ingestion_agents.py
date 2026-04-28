"""
Ingestion Agents
================
Specialized agents for ingesting different data sources:

1. ChatIngestionAgent - User-assisted chat data ingestion with iterative reasoning
2. DocumentIngestionAgent - Background document/image processing
3. JiraIngestionAgent - Background Jira ticket processing  
4. AOPValidationAgent - Direct AOP validation and storage

Each agent leverages the PropertyGraphIndex stores and Z3 engine
for knowledge extraction and validation.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from llama_index.core.agent import ReActAgent
from llama_index.core.llms import LLM
from llama_index.core.tools import FunctionTool
from llama_index.core.extractors import (
    TitleExtractor,
    KeywordExtractor,
    SummaryExtractor,
    QuestionsAnsweredExtractor,
)
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.schema import TextNode, Document

from ..config import settings
from ..dsl import DSLParser, DSLEvaluator, EvaluationContext
from .property_graphs import (
    AxiomsGraph,
    DeductionRulesGraph,
    BusinessDomainGraph,
    TheoremsGraph,
)
from .z3_engine import Z3ProofEngine, ProofStatus, ContradictionError
from .tools import create_all_tools

logger = logging.getLogger(__name__)


class IngestionStatus(str, Enum):
    """Status of an ingestion operation."""
    SUCCESS = "success"
    PARTIAL = "partial"
    VALIDATION_FAILED = "validation_failed"
    CONTRADICTION = "contradiction"
    ERROR = "error"


@dataclass
class IngestionResult:
    """Result of an ingestion operation."""
    status: IngestionStatus
    message: str
    entities_ingested: int = 0
    theorems_deduced: int = 0
    facts_discovered: int = 0
    validation_errors: list[str] = field(default_factory=list)
    contradiction_info: dict[str, Any] | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# Chat Ingestion Agent
# ═══════════════════════════════════════════════════════════════════════════════

CHAT_INGESTION_PROMPT = """You are a chat data ingestion agent for a banking customer service application.

Your role is to process customer conversations and extract:
1. Business domain facts (new information about app features, workflows, etc.)
2. Operational procedures (AOPs) that successfully resolved customer issues
3. New theorems that can be derived from the conversation context

PROCESS:
1. Analyze the conversation to identify valuable information
2. Retrieve relevant axioms, rules, and existing facts for context
3. Attempt to formalize new knowledge as DSL expressions
4. Run Z3 verification when appropriate
5. Store validated knowledge in the appropriate graph

When the user provides more context, incorporate it and continue reasoning.
Extract as much structured knowledge as possible from conversations.
Report any contradictions with existing knowledge immediately.
"""


class ChatIngestionAgent(ReActAgent):
    """
    Agent for user-assisted chat data ingestion.
    
    Works interactively with the user to:
    - Process conversation transcripts
    - Extract business facts and procedures
    - Verify consistency with existing knowledge
    - Store validated information
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
    ) -> None:
        z3_engine = z3_engine or Z3ProofEngine()
        tools = create_all_tools(
            axioms_graph=axioms_graph,
            rules_graph=rules_graph,
            domain_graph=domain_graph,
            theorems_graph=theorems_graph,
            z3_engine=z3_engine,
        )
        
        super().__init__(
            tools=tools,
            llm=llm,
            system_prompt=CHAT_INGESTION_PROMPT,
            verbose=True,
        )
        
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine
        self._tools = tools
    
    async def process_conversation(
        self,
        conversation: list[dict[str, str]],
        metadata: dict[str, Any] | None = None,
    ) -> IngestionResult:
        """
        Process a conversation transcript for knowledge extraction.
        
        Args:
            conversation: List of {"role": "user"|"agent", "content": "..."} dicts
            metadata: Optional metadata about the conversation
        """
        # Format conversation for agent
        formatted = self._format_conversation(conversation)
        
        query = f"""Analyze this customer service conversation and extract knowledge:

{formatted}

Please:
1. Identify any business domain facts (screens, buttons, workflows mentioned)
2. Extract any operational procedures that resolved the customer's issue
3. Check for consistency with existing knowledge
4. Store validated information in the appropriate graphs

Metadata: {metadata or 'None'}
"""
        
        try:
            response = await self.run(user_msg=query)
            answer = str(response)
            
            # Parse response to count extractions
            entities = answer.lower().count("stored fact") + answer.lower().count("added")
            theorems = answer.lower().count("stored theorem") + answer.lower().count("proved")
            
            if "CONTRADICTION" in answer.upper():
                return IngestionResult(
                    status=IngestionStatus.CONTRADICTION,
                    message=answer,
                    contradiction_info={"source": "conversation"},
                )
            
            return IngestionResult(
                status=IngestionStatus.SUCCESS,
                message=answer,
                entities_ingested=entities,
                theorems_deduced=theorems,
            )
            
        except ContradictionError as e:
            return IngestionResult(
                status=IngestionStatus.CONTRADICTION,
                message=str(e),
                contradiction_info={
                    "conflicting": e.conflicting_formulas,
                    "trace": e.proof_trace,
                },
            )
        except Exception as e:
            logger.exception("Chat ingestion error")
            return IngestionResult(
                status=IngestionStatus.ERROR,
                message=str(e),
            )
    
    def _format_conversation(self, conversation: list[dict[str, str]]) -> str:
        """Format conversation for agent processing."""
        lines = []
        for msg in conversation:
            role = msg.get("role", "unknown").upper()
            content = msg.get("content", "")
            lines.append(f"[{role}]: {content}")
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# Document Ingestion Agent
# ═══════════════════════════════════════════════════════════════════════════════

DOCUMENT_INGESTION_PROMPT = """You are a document ingestion agent for a banking customer service application.

Your role is to process documentation (text or images) and synthesize structured knowledge.

PROCESS:
1. Analyze the document content
2. Request relevant axioms, deduction rules, and existing theorems to contextualize
3. Extract entities, relationships, and procedures from the document  
4. Verify extracted information using formal proofs when applicable
5. Store validated knowledge in the appropriate graphs

You operate autonomously without user assistance.
Request context from the knowledge graphs as needed using retrieval tools.
Always verify new information against existing knowledge for consistency.
"""


class DocumentIngestionAgent(ReActAgent):
    """
    Background agent for document/image processing.
    
    Processes documentation autonomously by:
    - Extracting text and structure from documents
    - Requesting axioms/rules/theorems for context
    - Synthesizing and validating new knowledge
    - Storing results without user intervention
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
    ) -> None:
        z3_engine = z3_engine or Z3ProofEngine()
        tools = create_all_tools(
            axioms_graph=axioms_graph,
            rules_graph=rules_graph,
            domain_graph=domain_graph,
            theorems_graph=theorems_graph,
            z3_engine=z3_engine,
        )
        
        super().__init__(
            tools=tools,
            llm=llm,
            system_prompt=DOCUMENT_INGESTION_PROMPT,
            verbose=True,
            max_iterations=20,  # Allow more iterations for documents
        )
        
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine
        self._tools = tools
        
        # Add document-specific extractors
        self._extractors = [
            TitleExtractor(llm=llm),
            KeywordExtractor(llm=llm, keywords=10),
            SummaryExtractor(llm=llm, summaries=["self"]),
            QuestionsAnsweredExtractor(llm=llm, questions=5),
        ]
        
        self._splitter = SentenceSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
    
    async def ingest_document(
        self,
        content: str,
        document_type: str = "text",
        metadata: dict[str, Any] | None = None,
    ) -> IngestionResult:
        """
        Ingest a document and extract knowledge.
        
        Args:
            content: Document text content
            document_type: Type of document (text, markdown, etc.)
            metadata: Optional metadata
        """
        # First, run extractors to get structured metadata
        doc = Document(text=content, metadata=metadata or {})
        nodes = self._splitter.get_nodes_from_documents([doc])
        
        # Extract metadata from each node
        for extractor in self._extractors:
            try:
                nodes = await extractor.acall(nodes)
            except Exception as e:
                logger.warning(f"Extractor {extractor.__class__.__name__} failed: {e}")
        
        # Build extraction summary
        extraction_info = self._summarize_extractions(nodes)
        
        # Process with agent
        query = f"""Process this document for knowledge extraction:

Document Type: {document_type}
Extraction Summary: {extraction_info}

Document Content:
{content[:5000]}...  # Truncated for context

Please:
1. Retrieve relevant axioms and rules for context
2. Extract business domain facts from the document
3. Identify any procedures or workflows described
4. Verify consistency and store validated knowledge
"""
        
        try:
            response = await self.run(user_msg=query)
            answer = str(response)
            
            entities = answer.lower().count("stored") + answer.lower().count("added")
            theorems = answer.lower().count("theorem") + answer.lower().count("proved")
            
            return IngestionResult(
                status=IngestionStatus.SUCCESS,
                message=answer,
                entities_ingested=entities,
                theorems_deduced=theorems,
            )
            
        except ContradictionError as e:
            return IngestionResult(
                status=IngestionStatus.CONTRADICTION,
                message=str(e),
                contradiction_info={
                    "conflicting": e.conflicting_formulas,
                },
            )
        except Exception as e:
            logger.exception("Document ingestion error")
            return IngestionResult(
                status=IngestionStatus.ERROR,
                message=str(e),
            )
    
    def _summarize_extractions(self, nodes: Any) -> str:
        """Summarize extraction results from nodes."""
        titles = set()
        keywords = set()
        
        for node in nodes:
            meta = getattr(node, 'metadata', {}) or {}
            if "document_title" in meta:
                titles.add(meta["document_title"])
            if "keywords" in meta:
                keywords.update(meta.get("keywords", "").split(", "))
        
        return f"Titles: {titles}, Keywords: {list(keywords)[:20]}"


# ═══════════════════════════════════════════════════════════════════════════════
# Jira Ingestion Agent
# ═══════════════════════════════════════════════════════════════════════════════

JIRA_INGESTION_PROMPT = """You are a Jira ticket ingestion agent for a banking customer service application.

Your role is to process Jira tickets (bugs, features, support) and extract:
1. System entities mentioned (microservices, endpoints, screens)
2. Bug relationships and causes
3. Feature workflows and requirements
4. Resolution procedures that can become AOPs

PROCESS:
1. Analyze the ticket content and comments
2. Retrieve relevant axioms, rules, and domain facts for context
3. Extract entities and relationships
4. Verify any logical claims using formal proofs
5. Store validated knowledge

Operate autonomously without user intervention.
Focus on extracting actionable knowledge from tickets.
"""


class JiraIngestionAgent(ReActAgent):
    """
    Background agent for Jira ticket processing.
    
    Processes Jira tickets to extract:
    - System entities and relationships
    - Bug causes and relationships
    - Resolution procedures (AOPs)
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
    ) -> None:
        z3_engine = z3_engine or Z3ProofEngine()
        tools = create_all_tools(
            axioms_graph=axioms_graph,
            rules_graph=rules_graph,
            domain_graph=domain_graph,
            theorems_graph=theorems_graph,
            z3_engine=z3_engine,
        )
        
        super().__init__(
            tools=tools,
            llm=llm,
            system_prompt=JIRA_INGESTION_PROMPT,
            verbose=True,
            max_iterations=15,
        )
        
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine
        self._tools = tools
    
    async def ingest_ticket(
        self,
        ticket_key: str,
        summary: str,
        description: str,
        issue_type: str,
        comments: list[dict[str, str]] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> IngestionResult:
        """
        Ingest a Jira ticket for knowledge extraction.
        
        Args:
            ticket_key: Jira ticket key (e.g., BANK-123)
            summary: Ticket summary
            description: Ticket description
            issue_type: Type (Bug, Story, Task, etc.)
            comments: List of comments
            metadata: Additional metadata
        """
        # Format comments
        comments_text = ""
        if comments:
            comments_text = "\nComments:\n" + "\n".join(
                f"- {c.get('author', 'Unknown')}: {c.get('body', '')}"
                for c in comments
            )
        
        query = f"""Process this Jira ticket for knowledge extraction:

Ticket: {ticket_key}
Type: {issue_type}
Summary: {summary}

Description:
{description}
{comments_text}

Metadata: {metadata or 'None'}

Please:
1. Retrieve relevant business domain facts for context
2. Extract system entities mentioned (microservices, screens, etc.)
3. Identify any procedures or workflows
4. If this describes a bug resolution, formalize as an AOP
5. Verify and store validated knowledge
"""
        
        try:
            response = await self.run(user_msg=query)
            answer = str(response)
            
            entities = answer.lower().count("stored") + answer.lower().count("entity")
            facts = answer.lower().count("fact")
            
            return IngestionResult(
                status=IngestionStatus.SUCCESS,
                message=answer,
                entities_ingested=entities,
                facts_discovered=facts,
            )
            
        except ContradictionError as e:
            return IngestionResult(
                status=IngestionStatus.CONTRADICTION,
                message=str(e),
                contradiction_info={"ticket": ticket_key},
            )
        except Exception as e:
            logger.exception("Jira ingestion error")
            return IngestionResult(
                status=IngestionStatus.ERROR,
                message=str(e),
            )


# ═══════════════════════════════════════════════════════════════════════════════
# AOP Validation Agent
# ═══════════════════════════════════════════════════════════════════════════════

class AOPValidationAgent(ReActAgent):
    """
    Low-level agent for direct AOP validation and storage.
    
    Validates AOP/DSL expressions by:
    1. Local parsing/evaluation (no external engine)
    2. Checking for contradictions with existing system
    3. If valid: stores directly
    4. If invalid: passes to LLM for correction
    """
    
    def __init__(
        self,
        llm: LLM,
        axioms_graph: AxiomsGraph,
        rules_graph: DeductionRulesGraph,
        domain_graph: BusinessDomainGraph,
        theorems_graph: TheoremsGraph,
        z3_engine: Z3ProofEngine | None = None,
    ) -> None:
        z3_engine = z3_engine or Z3ProofEngine()
        tools = create_all_tools(
            axioms_graph=axioms_graph,
            rules_graph=rules_graph,
            domain_graph=domain_graph,
            theorems_graph=theorems_graph,
            z3_engine=z3_engine,
        )
        
        super().__init__(
            tools=tools,
            llm=llm,
            system_prompt="You are an AOP Validation Agent.",
            verbose=True,
            max_iterations=5,
        )
        
        self._llm = llm
        self._axioms_graph = axioms_graph
        self._rules_graph = rules_graph
        self._domain_graph = domain_graph
        self._theorems_graph = theorems_graph
        self._z3_engine = z3_engine
        self._tools = tools
        self._dsl_parser = DSLParser()
        self._dsl_evaluator = DSLEvaluator()
    
    async def validate_and_store(
        self,
        dsl_source: str,
        metadata: dict[str, Any] | None = None,
    ) -> IngestionResult:
        """
        Validate and store an AOP/DSL expression.
        
        Pipeline:
        1. Parse DSL locally
        2. Evaluate for well-formedness
        3. Check consistency with existing knowledge (Z3)
        4. If valid: store directly
        5. If invalid: attempt LLM correction
        """
        validation_errors = []
        
        # Step 1: Parse DSL
        try:
            ast_nodes = self._dsl_parser.parse(dsl_source)
        except Exception as e:
            validation_errors.append(f"Parse error: {e}")
            # Attempt LLM correction
            corrected = await self._attempt_correction(dsl_source, str(e))
            if corrected:
                return await self.validate_and_store(corrected, metadata)
            return IngestionResult(
                status=IngestionStatus.VALIDATION_FAILED,
                message="DSL parsing failed",
                validation_errors=validation_errors,
            )
        
        # Step 2: Evaluate for well-formedness
        try:
            ctx = EvaluationContext()
            self._dsl_evaluator.evaluate(ast_nodes, ctx)
        except Exception as e:
            validation_errors.append(f"Evaluation error: {e}")
            corrected = await self._attempt_correction(dsl_source, str(e))
            if corrected:
                return await self.validate_and_store(corrected, metadata)
            return IngestionResult(
                status=IngestionStatus.VALIDATION_FAILED,
                message="DSL evaluation failed",
                validation_errors=validation_errors,
            )
        
        # Step 3: Check consistency with Z3
        try:
            # Gather existing axioms and theorems
            existing = []
            
            axiom_results = self._axioms_graph.retrieve("all axioms", top_k=50)
            for r in axiom_results:
                formula = self._z3_engine.translate_dsl_text_to_z3(r['text'])
                if formula is not None:
                    existing.append((r['id'], formula))
            
            theorem_results = self._theorems_graph.retrieve("all theorems", top_k=50)
            for r in theorem_results:
                formula = self._z3_engine.translate_dsl_text_to_z3(r['text'])
                if formula is not None:
                    existing.append((r['id'], formula))
            
            # Check new AOP consistency
            for node in ast_nodes:
                new_formula = self._z3_engine.translate_dsl_to_z3(node)
                if new_formula is not None and existing:
                    self._z3_engine.check_new_fact_consistency(
                        new_formula, existing
                    )
            
        except ContradictionError as e:
            return IngestionResult(
                status=IngestionStatus.CONTRADICTION,
                message=f"AOP contradicts existing knowledge: {e}",
                validation_errors=validation_errors,
                contradiction_info={
                    "conflicting": e.conflicting_formulas,
                    "trace": e.proof_trace,
                },
            )
        except Exception as e:
            logger.warning(f"Z3 consistency check failed (non-fatal): {e}")
        
        # Step 4: Store the valid AOP
        stored_count = 0
        for name, proc in ctx.procedures.items():
            try:
                from ..dsl import DSLTranslator
                translator = DSLTranslator()
                dsl_text = translator.to_dsl(proc)
                
                self._theorems_graph.add_aop(
                    name=name,
                    procedure_dsl=dsl_text,
                    proof_trace=["Direct AOP ingestion", "Validated locally"],
                )
                stored_count += 1
            except Exception as e:
                validation_errors.append(f"Storage error for {name}: {e}")
        
        for name, axiom_expr in ctx.axioms.items():
            try:
                from ..dsl import DSLTranslator
                translator = DSLTranslator()
                dsl_text = translator.to_dsl(axiom_expr)
                
                self._axioms_graph.add_axiom(
                    name=name,
                    expression=dsl_text,
                    properties=metadata,
                )
                stored_count += 1
            except Exception as e:
                validation_errors.append(f"Storage error for axiom {name}: {e}")
        
        if stored_count > 0:
            return IngestionResult(
                status=IngestionStatus.SUCCESS,
                message=f"Successfully stored {stored_count} items",
                theorems_deduced=stored_count,
                validation_errors=validation_errors if validation_errors else [],
            )
        else:
            return IngestionResult(
                status=IngestionStatus.PARTIAL,
                message="DSL parsed but no procedures/axioms to store",
                validation_errors=validation_errors,
            )
    
    async def _attempt_correction(
        self,
        original_dsl: str,
        error_message: str,
    ) -> str | None:
        """Attempt to correct invalid DSL using LLM."""
        prompt = f"""The following DSL expression has an error:

{original_dsl}

Error: {error_message}

Please provide a corrected version of this DSL that fixes the error.
Only output the corrected DSL, nothing else.
If you cannot fix it, respond with "UNFIXABLE".
"""
        
        try:
            response = await self._llm.acomplete(prompt)
            corrected = response.text.strip()
            
            if "UNFIXABLE" in corrected:
                return None
            
            return corrected
        except Exception as e:
            logger.error(f"LLM correction failed: {e}")
            return None
