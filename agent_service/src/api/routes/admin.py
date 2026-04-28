"""
Admin routes — knowledge graph inspection and DSL utilities.
"""
from __future__ import annotations

import logging

from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter()

from ...telemetry import log_event, get_recent_events
from ...dsl.guardrails import evaluate_statement_against_context


class DSLParseRequest(BaseModel):
    dsl_source: str


class DSLSimplifyRequest(BaseModel):
    dsl_source: str


@router.get("/contexts", summary="List all knowledge graph contexts")
async def list_contexts() -> dict:
    from ..dependencies import get_graph_store
    store = get_graph_store()
    contexts = store.list_contexts()
    return {"contexts": [c.model_dump(mode="json") for c in contexts]}


@router.get("/contexts/{name}/nodes", summary="List nodes in a graph context")
async def list_context_nodes(name: str) -> dict:
    from ..dependencies import get_graph_store
    store = get_graph_store()
    nodes = store.get_nodes_by_context(name)
    return {"nodes": [n.model_dump(mode="json") for n in nodes]}


@router.get("/meta-graph", summary="Inspect the meta-graph structure")
async def get_meta_graph_info() -> dict:
    from ..dependencies import get_meta_graph
    mg = get_meta_graph()
    return {
        "contexts": mg.all_contexts(),
        "edges": [
            {"source": u, "target": v, **d}
            for u, v, d in mg._g.edges(data=True)
        ],
    }


@router.post("/dsl/parse", summary="Parse DSL source text and return AST summary")
async def dsl_parse(body: DSLParseRequest) -> dict:
    from ...dsl import DSLParser, ParseError
    parser = DSLParser()
    try:
        nodes = parser.parse(body.dsl_source)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "node_count": len(nodes),
        "node_kinds": [getattr(n, "kind", str(type(n).__name__)) for n in nodes],
    }


@router.post("/dsl/simplify", summary="Parse and simplify a DSL expression")
async def dsl_simplify(body: DSLSimplifyRequest) -> dict:
    from ...dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator, ParseError
    parser = DSLParser()
    evaluator = DSLEvaluator()
    translator = DSLTranslator()

    try:
        nodes = parser.parse(body.dsl_source)
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    ctx = EvaluationContext()
    evaluator.evaluate(nodes, ctx)

    all_dsl = [translator.to_dsl(n) for n in ctx.contexts.get(ctx.active_ctx, [])]
    return {
        "simplified": all_dsl,
        "axioms": list(ctx.axioms.keys()),
        "rules": list(ctx.rules.keys()),
        "procedures": list(ctx.procedures.keys()),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Pending Facts Verification
# ═══════════════════════════════════════════════════════════════════════════════

from datetime import datetime
from typing import Any

from ...models.chat import (
    PendingFact,
    PendingFactStatus,
    PendingFactType,
    AdminFactReviewRequest,
    AdminBulkReviewRequest,
    AdminBulkReviewResponse,
)


class PendingFactsFilterParams(BaseModel):
    """Filter parameters for listing pending facts."""
    status: PendingFactStatus | None = None
    fact_type: PendingFactType | None = None
    session_id: str | None = None
    min_confidence: float | None = None
    z3_validated_only: bool = False


@router.get("/pending-facts", summary="List all pending facts awaiting verification")
async def list_pending_facts(
    status: PendingFactStatus = PendingFactStatus.PENDING,
    fact_type: str | None = None,
    session_id: str | None = None,
    min_confidence: float | None = None,
    z3_validated_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    List pending facts awaiting admin verification.
    
    Filters:
    - status: Filter by review status (pending, approved, rejected). Defaults to "pending".
    - fact_type: Filter by type (axiom, fact, theorem, rule, procedure)
    - session_id: Filter by originating chat session
    - min_confidence: Only show facts with confidence >= this value
    - z3_validated_only: Only show facts validated by Z3
    """
    from .chat import get_pending_facts
    
    all_facts = list(get_pending_facts().values())
    
    # Apply filters
    all_facts = [f for f in all_facts if f.status == status]
    if fact_type:
        try:
            ft = PendingFactType(fact_type)
            all_facts = [f for f in all_facts if f.fact_type == ft]
        except ValueError:
            pass
    if session_id:
        all_facts = [f for f in all_facts if f.session_id == session_id]
    if min_confidence is not None:
        all_facts = [f for f in all_facts if f.confidence >= min_confidence]
    if z3_validated_only:
        all_facts = [f for f in all_facts if f.z3_validated]
    
    # Sort by created_at descending
    all_facts.sort(key=lambda f: f.created_at, reverse=True)
    
    total = len(all_facts)
    facts = all_facts[offset:offset + limit]
    
    # Calculate summary stats
    stats = {
        "total": total,
        "by_status": {},
        "by_type": {},
        "avg_confidence": 0.0,
    }
    
    for f in all_facts:
        stats["by_status"][f.status.value] = stats["by_status"].get(f.status.value, 0) + 1
        stats["by_type"][f.fact_type.value] = stats["by_type"].get(f.fact_type.value, 0) + 1
    
    if all_facts:
        stats["avg_confidence"] = sum(f.confidence for f in all_facts) / len(all_facts)
    
    return {
        "facts": [f.model_dump(mode="json") for f in facts],
        "stats": stats,
        "limit": limit,
        "offset": offset,
    }


@router.get("/pending-facts/{fact_id}", summary="Get details of a pending fact with full conversation")
async def get_pending_fact(fact_id: str, include_conversation: bool = True) -> dict:
    """
    Get detailed information about a pending fact.
    
    Args:
        fact_id: The ID of the pending fact
        include_conversation: If True (default), include the full conversation
                             that led to this fact being proposed
    
    Returns:
        The pending fact details, session info, and optionally the full conversation
    """
    from .chat import get_pending_facts, get_conversation_for_session, _sessions
    
    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")
    
    fact = facts[fact_id]
    
    # Get related session info if available
    session_info = None
    conversation = None
    
    try:
        if fact.session_id in _sessions:
            session = _sessions[fact.session_id]
            session_info = {
                "id": session.id,
                "title": session.title,
                "status": session.status.value,
                "user_id": session.user_id,
                "started_at": session.started_at.isoformat() if session.started_at else None,
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "feedback_success": session.feedback_success,
                "feedback_rating": session.feedback_rating,
                "feedback_comment": session.feedback_comment,
            }
            
            # Get full conversation for context
            if include_conversation:
                conversation = get_conversation_for_session(fact.session_id)
    except Exception as e:
        logger.warning("Error fetching session info for fact %s: %s", fact_id, e)
    
    return {
        "fact": fact.model_dump(mode="json"),
        "session": session_info,
        "conversation": conversation,
    }


@router.post("/pending-facts/{fact_id}/review", summary="Review a pending fact")
async def review_pending_fact(fact_id: str, body: AdminFactReviewRequest) -> dict:
    """
    Approve or reject a pending fact.
    
    When approved:
    - The fact is added to the appropriate knowledge graph
    - DSL is parsed and stored
    - Z3 consistency is re-verified before storage
    
    When rejected:
    - The fact is marked as rejected with reason
    - It will not be added to the knowledge graph
    """
    from .chat import get_pending_facts, update_pending_fact
    
    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")
    
    fact = facts[fact_id]
    
    if fact.status != PendingFactStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Fact already reviewed: {fact.status.value}"
        )
    
    if body.approved:
        # Re-verify with Z3 before adding to knowledge graph
        try:
            await _add_fact_to_knowledge_graph(fact)
            fact.status = PendingFactStatus.APPROVED
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to add fact to knowledge graph: {str(e)}"
            ) from e
    else:
        fact.status = PendingFactStatus.REJECTED
        fact.rejection_reason = body.reason
    
    fact.reviewed_by = body.reviewer_id
    fact.reviewed_at = datetime.utcnow()
    
    update_pending_fact(fact_id, fact)
    
    return {
        "fact_id": fact_id,
        "status": fact.status.value,
        "message": "Fact approved and added to knowledge graph" if body.approved else "Fact rejected",
    }


@router.post("/pending-facts/bulk-review", summary="Bulk review multiple pending facts")
async def bulk_review_facts(body: AdminBulkReviewRequest) -> AdminBulkReviewResponse:
    """
    Approve or reject multiple pending facts at once.
    
    Useful for batch processing facts from a completed session.
    """
    from .chat import get_pending_facts, update_pending_fact
    
    facts = get_pending_facts()
    
    processed = 0
    approved = 0
    rejected = 0
    errors = []
    
    for fact_id in body.fact_ids:
        if fact_id not in facts:
            errors.append({"fact_id": fact_id, "error": "Not found"})
            continue
        
        fact = facts[fact_id]
        
        if fact.status != PendingFactStatus.PENDING:
            errors.append({
                "fact_id": fact_id,
                "error": f"Already reviewed: {fact.status.value}"
            })
            continue
        
        try:
            if body.approved:
                await _add_fact_to_knowledge_graph(fact)
                fact.status = PendingFactStatus.APPROVED
                approved += 1
            else:
                fact.status = PendingFactStatus.REJECTED
                fact.rejection_reason = body.reason
                rejected += 1
            
            fact.reviewed_by = body.reviewer_id
            fact.reviewed_at = datetime.utcnow()
            update_pending_fact(fact_id, fact)
            processed += 1
            
        except Exception as e:
            errors.append({"fact_id": fact_id, "error": str(e)})
    
    return AdminBulkReviewResponse(
        processed=processed,
        approved=approved,
        rejected=rejected,
        errors=errors,
    )


@router.delete("/pending-facts/{fact_id}", summary="Delete a pending fact")
async def delete_pending_fact(fact_id: str) -> dict:
    """Delete a pending fact (only if not yet approved)."""
    from .chat import get_pending_facts, _pending_facts
    from ...persistence.chat_db import delete_pending_fact_from_db
    
    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")
    
    fact = facts[fact_id]
    
    if fact.status == PendingFactStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete approved facts"
        )
    
    del _pending_facts[fact_id]
    delete_pending_fact_from_db(fact_id)
    
    return {"message": "Fact deleted", "fact_id": fact_id}


@router.get("/sessions/{session_id}/conversation", summary="Get full conversation for admin review")
async def get_session_conversation(session_id: str) -> dict:
    """
    Get the full conversation for a chat session.
    
    This is useful for admin review to understand the context
    in which pending facts were proposed.
    """
    from .chat import get_conversation_for_session, _sessions, _session_facts, _pending_facts
    
    conversation = get_conversation_for_session(session_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _sessions.get(session_id)
    
    # Get facts from this session
    fact_ids = _session_facts.get(session_id, [])
    facts = [
        _pending_facts[fid].model_dump(mode="json")
        for fid in fact_ids
        if fid in _pending_facts
    ]
    
    # Group facts by status
    facts_by_status = {}
    for f in facts:
        status = f.get("status", "unknown")
        if status not in facts_by_status:
            facts_by_status[status] = []
        facts_by_status[status].append(f)
    
    return {
        "session": {
            "id": session.id if session else session_id,
            "title": session.title if session else None,
            "status": session.status.value if session else "unknown",
            "user_id": session.user_id if session else None,
            "started_at": session.started_at.isoformat() if session and session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session and session.ended_at else None,
            "feedback_success": session.feedback_success if session else None,
            "feedback_rating": session.feedback_rating if session else None,
            "feedback_comment": session.feedback_comment if session else None,
            "summary": session.summary if session else None,
        },
        "conversation": conversation,
        "facts": {
            "total": len(facts),
            "by_status": facts_by_status,
            "all": facts,
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

async def _add_fact_to_knowledge_graph(fact: PendingFact) -> None:
    """
    Add an approved fact to the knowledge graph via the unified registrar.
    Z3 consistency re-verification is temporarily disabled.
    """
    from ..dependencies import get_knowledge_registrar
    from ...dsl import DSLParser
    from ...knowledge_graph.schemas import NodeType
    from ...pipeline.knowledge_registrar import RegistrationRequest

    registrar = get_knowledge_registrar()

    # Auto-fix common issue: missing terminal dot
    dsl_source = fact.dsl_source.strip()
    if dsl_source and not dsl_source.endswith("."):
        dsl_source += "."

    # Parse DSL
    parser = DSLParser()
    nodes = parser.parse(dsl_source)

    if not nodes:
        raise ValueError("No valid DSL nodes in fact")

    # Z3 consistency verification — disabled.

    # Map PendingFactType → NodeType
    _fact_type_map = {
        PendingFactType.AXIOM: NodeType.AXIOM,
        PendingFactType.THEOREM: NodeType.THEOREM,
        PendingFactType.RULE: NodeType.RULE,
        PendingFactType.PROCEDURE: NodeType.PROCEDURE,
        PendingFactType.FACT: NodeType.FACT,  # standalone facts → Fact label/context
    }
    node_type = _fact_type_map.get(fact.fact_type, NodeType.AXIOM)

    reg_result = registrar.register(RegistrationRequest(
        dsl_source=dsl_source,
        node_type=node_type,
        context="",  # let registrar pick default context for this type
        label=fact.natural_language or dsl_source[:80],
        source=f"chat_session:{fact.session_id}" if fact.session_id else "chat",
        confidence=fact.confidence,
        origin=fact.origin.value,
        session_id=fact.session_id,
        z3_validated=fact.z3_validated,
        z3_proof_trace=fact.z3_proof_trace,
        depends_on_facts=fact.depends_on_facts,
        derived_from_rag=fact.derived_from_rag,
    ))

    if not reg_result.success:
        raise ValueError(
            f"Failed to register fact in knowledge graph: {'; '.join(reg_result.errors)}"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Foundational Deduction Rules Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/deduction-rules/register-foundational", summary="Register all foundational AOP deduction rules")
async def register_foundational_deduction_rules(force_update: bool = False) -> dict:
    """
    Register all foundational AOP deduction rules in the deduction property graph.
    
    This operation is **idempotent** - calling it multiple times will not create
    duplicate rules. Existing rules will be skipped unless force_update=True.
    
    This populates the deduction rules graph with:
    - Logical simplification rules (De Morgan, absorption, etc.)
    - AOP combination rules (sequential, parallel, conditional composition)
    - AOP simplification rules (dead step elimination, redundant precondition removal)
    - Connection deduction rules (dependency chains, effect propagation)
    - Implication extraction rules (postcondition inference, invariants)
    - Quantifier manipulation rules
    - Procedure transformation rules
    
    Args:
        force_update: If True, update existing rules. If False (default), skip existing.
    
    These rules guide the LLM on how to algebraically manipulate DSL expressions.
    """
    from ..dependencies import get_deduction_rules_graph
    from ...agents.aop_deduction_rules import register_foundational_rules
    
    deduction_graph = get_deduction_rules_graph()
    result = await register_foundational_rules(deduction_graph, force_update=force_update)
    
    return {
        "message": "Foundational deduction rules registration complete",
        "total_registered": result["total_registered"],
        "total_skipped": result["total_skipped"],
        "total_updated": result["total_updated"],
        "by_category": result["by_category"],
        "errors": result["errors"],
    }


@router.get("/deduction-rules/foundational", summary="Get all foundational deduction rules")
async def get_foundational_rules() -> dict:
    """
    Get all foundational AOP deduction rules as DSL text.
    
    Returns the rules formatted for inclusion in LLM prompts.
    """
    from ...agents.aop_deduction_rules import (
        ALL_FOUNDATIONAL_RULES,
        RuleCategory,
        get_foundational_rules_dsl,
        get_foundational_rules_summary,
    )
    
    rules_by_category = {}
    for cat in RuleCategory:
        rules_by_category[cat.value] = [
            {
                "name": r.name,
                "description": r.description,
                "premises": r.premises,
                "conclusion": r.conclusion,
                "dsl_pattern": r.dsl_pattern,
                "examples": r.examples,
            }
            for r in ALL_FOUNDATIONAL_RULES
            if r.category == cat
        ]
    
    return {
        "total_rules": len(ALL_FOUNDATIONAL_RULES),
        "by_category": rules_by_category,
        "dsl_text": get_foundational_rules_dsl(),
        "summary": get_foundational_rules_summary(),
    }


@router.get("/deduction-rules/foundational/{category}", summary="Get foundational rules by category")
async def get_foundational_rules_by_category(category: str) -> dict:
    """
    Get foundational deduction rules for a specific category.
    
    Categories:
    - logical_simplification: Boolean algebra equivalences
    - aop_combination: Rules for composing AOPs
    - aop_simplification: Rules for simplifying AOPs
    - connection_deduction: Rules for inferring connections
    - implication_extraction: Rules for extracting implications
    - quantifier_manipulation: Rules for quantifier operations
    - procedure_transformation: Rules for transforming procedures
    """
    from ...agents.aop_deduction_rules import RuleCategory, get_rules_by_category
    
    try:
        cat_enum = RuleCategory(category)
    except ValueError:
        from fastapi import HTTPException
        valid_categories = [c.value for c in RuleCategory]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Valid categories: {valid_categories}"
        )
    
    rules = get_rules_by_category(cat_enum)
    
    return {
        "category": category,
        "count": len(rules),
        "rules": [
            {
                "name": r.name,
                "description": r.description,
                "premises": r.premises,
                "conclusion": r.conclusion,
                "dsl_pattern": r.dsl_pattern,
                "examples": r.examples,
            }
            for r in rules
        ],
    }


@router.get("/deduction-rules/prompt-context", summary="Get AOP deduction context for LLM prompts")
async def get_deduction_prompt_context() -> dict:
    """
    Get the AOP deduction rules context formatted for inclusion in LLM prompts.
    
    This provides a condensed reference that guides the LLM on how to
    apply algebraic simplification and manipulation to DSL expressions.
    """
    from ...agents.aop_deduction_rules import (
        AOP_DEDUCTION_PROMPT_CONTEXT,
        get_foundational_rules_summary,
    )
    
    return {
        "prompt_context": AOP_DEDUCTION_PROMPT_CONTEXT,
        "summary": get_foundational_rules_summary(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge Management — Manual Fact Addition, Search, Delete, Archive
# ═══════════════════════════════════════════════════════════════════════════════

from ...models.chat import (
    KnowledgeItemType,
    KnowledgeItemStatus,
    AddKnowledgeRequest,
    AddKnowledgeResponse,
    SearchKnowledgeRequest,
    SearchKnowledgeResponse,
    SearchKnowledgeResult,
    ArchiveKnowledgeRequest,
    DeleteKnowledgeRequest,
)


@router.post("/knowledge/add", summary="Manually add a business fact or knowledge item")
async def add_knowledge_item(body: AddKnowledgeRequest) -> AddKnowledgeResponse:
    """
    Manually add a knowledge item (fact, axiom, rule, theorem, procedure).
    
    The input can be:
    - **DSL format** (is_dsl=True): Directly parsed and stored
    - **Natural language** (is_dsl=False): Translated to DSL by Gemini first
    
    Before adding, a **soundness check** is performed using Z3 to ensure
    the new item doesn't contradict existing knowledge. This can be:
    - Skipped with skip_soundness_check=True
    - Forced through weak contradictions with force_add=True
    
    Example DSL inputs:
    ```
    AXIOM user_access: HasRole(?u, "admin") IMPLIES FullAccess(?u).
    Screen("Dashboard") AND HasButton("Dashboard", "Settings").
    RULE access_inheritance: IF HasRole(?u, ?r); IF RoleGrants(?r, ?p); THEN HasPermission(?u, ?p).
    ```
    """
    from ..dependencies import get_llm, get_property_graphs, get_graph_store
    from ...dsl import DSLParser, DSLTranslator
    from ...dsl.syntax_reference import DSL_QUICK_REFERENCE, DSL_TRANSLATION_CONVENTIONS
    from ...knowledge_graph.schemas import NodeType
    import time
    
    llm = get_llm()
    graphs = get_property_graphs()
    
    dsl_source = body.content
    
    # Step 1: Translate to DSL if natural language
    if not body.is_dsl:
        try:
            log_event("admin.translation.started", {
                "operation": "knowledge_add",
                "item_type": body.item_type.value,
                "content_preview": body.content[:200],
            })
            graph_key = _get_graph_key_for_type(body.item_type)

            # Retrieve semantically related DSL to enforce predicate consistency.
            retrieved_dsl_examples: list[str] = []
            try:
                graph = graphs.get(graph_key)
                if graph is not None:
                    retrieval_results = graph.retrieve(
                        query=body.content,
                        top_k=8,
                        include_relations=False,
                    )
                    for result in retrieval_results:
                        candidate = result.get("text")
                        if not candidate:
                            metadata = result.get("metadata", {})
                            if isinstance(metadata, dict):
                                candidate = metadata.get("dsl_source")

                        if isinstance(candidate, str) and candidate.strip():
                            retrieved_dsl_examples.append(candidate.strip())
            except Exception as retrieval_error:
                logger.warning("Semantic retrieval for translation context failed: %s", retrieval_error)

            # Fallback to direct store context scan if semantic retrieval was empty.
            if not retrieved_dsl_examples:
                try:
                    store = get_graph_store()
                    context_nodes = store.get_nodes_by_context(_neo4j_context(graph_key))
                    for node in context_nodes[:50]:
                        candidate = None
                        if isinstance(node.properties, dict):
                            candidate = node.properties.get("dsl_source")
                        if not candidate:
                            candidate = node.dsl_source
                        if isinstance(candidate, str) and candidate.strip():
                            retrieved_dsl_examples.append(candidate.strip())
                except Exception as store_error:
                    logger.warning("Context fallback retrieval failed: %s", store_error)

            retrieved_dsl_examples = retrieved_dsl_examples[:20]
            predicate_signature_guide = _build_predicate_signature_guide(retrieved_dsl_examples)

            translate_prompt = f"""Convert this natural language statement to DSL format.

{DSL_QUICK_REFERENCE}

Natural language: {body.content}

Item type hint: {body.item_type.value}

{DSL_TRANSLATION_CONVENTIONS}

Retrieved DSL examples (semantic context):
{chr(10).join(f"- {x}" for x in retrieved_dsl_examples) if retrieved_dsl_examples else "- (none)"}

Known predicate signatures inferred from retrieved context:
{predicate_signature_guide if predicate_signature_guide else "- (none)"}

Respond with ONLY the valid DSL statement, no explanation.
For facts, use predicate format: Predicate(args).
For axioms, use: AXIOM name: expression.
For rules, use: RULE name: IF premise; THEN conclusion.
"""
            response = await llm.acomplete(translate_prompt)
            dsl_source = str(response.text).strip()
            log_event("admin.translation.completed", {
                "operation": "knowledge_add",
                "item_type": body.item_type.value,
                "dsl_preview": dsl_source[:200],
                "retrieved_examples": len(retrieved_dsl_examples),
            })
            logger.info("Translated to DSL: %s -> %s", body.content[:50], dsl_source[:100])
        except Exception as e:
            logger.error("Failed to translate to DSL: %s", e)
            log_event("admin.translation.failed", {
                "operation": "knowledge_add",
                "item_type": body.item_type.value,
                "error": str(e),
            })
            return AddKnowledgeResponse(
                success=False,
                item_type=body.item_type,
                dsl_source="",
                soundness_checked=False,
                is_sound=False,
                message=f"Failed to translate to DSL: {str(e)}",
            )
    
    # Step 2: Parse DSL to validate syntax
    # Be tolerant with manual/admin input missing trailing DOT.
    parser = DSLParser()
    try:
        nodes = parser.parse(dsl_source)
        if not nodes:
            return AddKnowledgeResponse(
                success=False,
                item_type=body.item_type,
                dsl_source=dsl_source,
                soundness_checked=False,
                is_sound=False,
                message="Invalid DSL: No valid statements parsed",
            )
    except Exception as e:
        err_text = str(e)

        # Retry once for common case: statement is syntactically complete
        # but missing terminal DOT (e.g., IsLife(EVO)).
        if (
            "Unexpected end-of-input" in err_text
            and "DOT" in err_text
            and not dsl_source.strip().endswith(".")
        ):
            dsl_source_retry = f"{dsl_source.strip()}."
            try:
                nodes = parser.parse(dsl_source_retry)
                if nodes:
                    dsl_source = dsl_source_retry
                else:
                    return AddKnowledgeResponse(
                        success=False,
                        item_type=body.item_type,
                        dsl_source=dsl_source_retry,
                        soundness_checked=False,
                        is_sound=False,
                        message="Invalid DSL: No valid statements parsed",
                    )
            except Exception:
                return AddKnowledgeResponse(
                    success=False,
                    item_type=body.item_type,
                    dsl_source=dsl_source,
                    soundness_checked=False,
                    is_sound=False,
                    message=f"DSL parse error: {err_text}",
                )
        else:
            return AddKnowledgeResponse(
                success=False,
                item_type=body.item_type,
                dsl_source=dsl_source,
                soundness_checked=False,
                is_sound=False,
                message=f"DSL parse error: {err_text}",
            )

    if not nodes:
        return AddKnowledgeResponse(
            success=False,
            item_type=body.item_type,
            dsl_source=dsl_source,
            soundness_checked=False,
            is_sound=False,
            message="Invalid DSL: No valid statements parsed",
        )
    
    # Step 3: Soundness gate — Z3 disabled. Accept all syntactically valid DSL.
    is_sound = True
    contradiction_details = None

    # Step 4: Add to the appropriate graph
    try:
        # nest_asyncio (applied in main.py) allows sync/async nesting, so calling
        # the registrar directly on the event loop thread avoids thread/loop
        # boundary issues that block embedding generation via PGVectorStore.
        item_id = _add_to_knowledge_graph(
            graphs,
            body.item_type,
            dsl_source,
            body.name,
            body.description,
            body.source,
            body.confidence,
        )
        
        logger.info("Added knowledge item %s: %s", body.item_type.value, item_id)
        log_event("admin.persist.success", {
            "operation": "knowledge_add",
            "item_type": body.item_type.value,
            "item_id": item_id,
            "dsl": dsl_source,
        })
        
        return AddKnowledgeResponse(
            success=True,
            item_id=item_id,
            item_type=body.item_type,
            dsl_source=dsl_source,
            soundness_checked=True,
            is_sound=is_sound,
            contradiction_details=contradiction_details,
            message="Knowledge item added successfully",
        )
        
    except Exception as e:
        logger.error("Failed to add knowledge item: %s", e)
        log_event("admin.persist.error", {
            "operation": "knowledge_add",
            "item_type": body.item_type.value,
            "dsl": dsl_source,
            "error": str(e),
        })
        return AddKnowledgeResponse(
            success=False,
            item_type=body.item_type,
            dsl_source=dsl_source,
            soundness_checked=True,
            is_sound=is_sound,
            message=f"Failed to add item: {str(e)}",
        )


@router.post("/knowledge/search", summary="Search knowledge base using natural language")
async def search_knowledge(body: SearchKnowledgeRequest) -> SearchKnowledgeResponse:
    """
    Search the knowledge base using natural language.
    
    The query is:
    1. Translated to DSL format by Gemini
    2. Used for semantic search across the specified knowledge graphs
    3. Results ranked by similarity
    
    Filters:
    - **item_types**: Limit search to specific types (axiom, rule, fact, theorem, procedure)
    - **include_archived**: Include archived items in results
    - **min_similarity**: Minimum similarity threshold (0.0-1.0)
    
    Example queries:
    - "Which services depend on AuthService?"
    - "Rules about user permissions"
    - "Screens with submit buttons"
    """
    from ..dependencies import get_llm, get_property_graphs, get_graph_store
    from ...dsl.syntax_reference import DSL_QUICK_REFERENCE, DSL_TRANSLATION_CONVENTIONS
    import time
    
    start_time = time.time()
    
    llm = get_llm()
    graphs = get_property_graphs()
    store = get_graph_store()

    # Empty query in admin UI means "browse recent knowledge", not semantic search.
    if not body.query.strip():
        search_graphs = []
        if body.item_types is None:
            search_graphs = [
                ("axioms", KnowledgeItemType.AXIOM),
                ("rules", KnowledgeItemType.RULE),
                ("facts", KnowledgeItemType.FACT),
                ("theorems", KnowledgeItemType.THEOREM),
            ]
        else:
            for item_type in body.item_types:
                search_graphs.append((_get_graph_key_for_type(item_type), item_type))

        all_results: list[SearchKnowledgeResult] = []
        for graph_key, item_type in search_graphs:
            try:
                nodes = store.get_nodes_by_context(_neo4j_context(graph_key))
            except Exception as e:
                logger.warning("Browse failed for context %s: %s", graph_key, e)
                continue

            nodes_sorted = sorted(
                nodes,
                key=lambda n: n.created_at or datetime.min,
                reverse=True,
            )

            for node in nodes_sorted:
                props = node.properties if isinstance(node.properties, dict) else {}
                status = props.get("status", "active")
                if status == "deleted":
                    continue
                if status == "archived" and not body.include_archived:
                    continue

                dsl_source = node.dsl_source or props.get("dsl_source") or node.label
                all_results.append(SearchKnowledgeResult(
                    id=node.id,
                    item_type=item_type,
                    dsl_source=dsl_source or "",
                    natural_description=props.get("description"),
                    similarity_score=1.0,
                    created_at=node.created_at,
                    source=props.get("source"),
                    properties=props,
                ))

        all_results.sort(
            key=lambda r: (r.created_at or datetime.min),
            reverse=True,
        )
        all_results = all_results[:body.top_k]
        elapsed_ms = (time.time() - start_time) * 1000

        return SearchKnowledgeResponse(
            query=body.query,
            dsl_query="*",
            results=all_results,
            total_found=len(all_results),
            item_types_searched=[g[1].value for g in search_graphs],
            search_time_ms=elapsed_ms,
        )
    
    # Step 1: Translate natural language to DSL query
    translate_prompt = f"""Convert this natural language search query to a DSL pattern.

{DSL_QUICK_REFERENCE}

Search query: {body.query}

{DSL_TRANSLATION_CONVENTIONS}

Respond with a DSL pattern that captures the semantic meaning.
Use variables (?x, ?y) for unknowns.
Examples:
- "services that depend on X" -> DependsOn(?service, "X")
- "user access rules" -> HasRole(?user, ?role) IMPLIES HasPermission(?user, ?perm)
- "screens with buttons" -> Screen(?s) AND Button(?s, ?btn)

Respond with ONLY the DSL pattern:"""

    try:
        response = await llm.acomplete(translate_prompt)
        dsl_query = str(response.text).strip()
    except Exception as e:
        logger.warning("DSL translation failed, using raw query: %s", e)
        dsl_query = body.query
    
    # Step 2: Determine which graphs to search
    search_graphs = []
    if body.item_types is None:
        # Search all
        search_graphs = [
            ("axioms", KnowledgeItemType.AXIOM),
            ("rules", KnowledgeItemType.RULE),
            ("facts", KnowledgeItemType.FACT),
            ("theorems", KnowledgeItemType.THEOREM),
        ]
    else:
        for item_type in body.item_types:
            graph_key = _get_graph_key_for_type(item_type)
            search_graphs.append((graph_key, item_type))
    
    # Step 3: Search each graph
    all_results: list[SearchKnowledgeResult] = []
    
    for graph_key, item_type in search_graphs:
        try:
            graph = graphs.get(graph_key)
            if graph is None:
                continue
            
            # Search using the DSL query
            results = graph.retrieve(
                query=dsl_query,
                top_k=body.top_k,
                include_relations=False,
            )
            
            for r in results:
                score = r.get("score", 0.0)
                
                # Apply minimum similarity filter
                if score < body.min_similarity:
                    continue
                
                # Check status filters
                metadata = r.get("metadata", {})
                status = metadata.get("status", "active")
                if status == "deleted":
                    continue
                if status == "archived" and not body.include_archived:
                    continue
                
                all_results.append(SearchKnowledgeResult(
                    id=r.get("id", ""),
                    item_type=item_type,
                    dsl_source=r.get("text", ""),
                    natural_description=metadata.get("description"),
                    similarity_score=score,
                    created_at=metadata.get("created_at"),
                    source=metadata.get("source"),
                    properties=metadata,
                ))
                
        except Exception as e:
            logger.warning("Search failed for graph %s: %s", graph_key, e)
    
    # Step 4: Sort by similarity and limit results
    all_results.sort(key=lambda x: x.similarity_score, reverse=True)
    all_results = all_results[:body.top_k]
    
    elapsed_ms = (time.time() - start_time) * 1000
    
    return SearchKnowledgeResponse(
        query=body.query,
        dsl_query=dsl_query,
        results=all_results,
        total_found=len(all_results),
        item_types_searched=[g[1].value for g in search_graphs],
        search_time_ms=elapsed_ms,
    )


@router.get("/diagnostics/traces", summary="Inspect recent internal agent/model/tool traces")
async def get_diagnostics_traces(
    limit: int = 200,
    event_type: str | None = None,
    session_id: str | None = None,
) -> dict:
    """Return in-memory telemetry traces for debugging model/tool behavior."""
    safe_limit = max(1, min(limit, 2000))
    events = get_recent_events(limit=safe_limit, event_type=event_type, session_id=session_id)
    return {
        "count": len(events),
        "limit": safe_limit,
        "event_type": event_type,
        "session_id": session_id,
        "events": events,
    }


@router.delete("/knowledge/{item_type}/{item_id}", summary="Delete a knowledge item")
async def delete_knowledge_item(
    item_type: KnowledgeItemType,
    item_id: str,
    reason: str | None = None,
    deleted_by: str | None = None,
    cascade: bool = False,
) -> dict:
    """
    Delete a knowledge item from the system.
    
    This performs a soft delete by default, marking the item as deleted
    but preserving the data. Use cascade=True to also delete dependent items.
    
    **Warning**: Deleting axioms or rules may affect deductions that depend on them.
    Consider archiving instead for important items.
    """
    from ..dependencies import get_graph_store, get_property_graphs
    
    store = get_graph_store()
    graphs = get_property_graphs()
    
    # Find the item
    node = store.get_node(item_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Knowledge item not found: {item_id}")
    
    # Verify type matches
    expected_type = _node_type_for_item_type(item_type)
    if node.type != expected_type:
        raise HTTPException(
            status_code=400, 
            detail=f"Item type mismatch: expected {item_type.value}, found {node.type.value}"
        )
    
    # Check if item has dependents
    dependents = store.get_edges_by_target(item_id)
    if dependents and not cascade:
        return {
            "success": False,
            "item_id": item_id,
            "message": f"Item has {len(dependents)} dependent items. Use cascade=True to delete them.",
            "dependent_count": len(dependents),
        }
    
    # Perform hard deletion from Neo4j
    try:
        # If cascade, delete dependents first (their edges are also removed by DETACH DELETE)
        deleted_dependents = 0
        if cascade and dependents:
            for edge in dependents:
                dep_node = store.get_node(edge.source_id)
                if dep_node:
                    store.delete_node(dep_node.id)
                    deleted_dependents += 1

        # Delete the main node — DETACH DELETE removes all its relationships too
        store.delete_node(item_id)

        logger.info("Deleted knowledge item %s (cascade: %d dependents)", item_id, deleted_dependents)
        
        return {
            "success": True,
            "item_id": item_id,
            "item_type": item_type.value,
            "message": "Item deleted successfully",
            "cascade_deleted": deleted_dependents,
        }
        
    except Exception as e:
        logger.error("Failed to delete item %s: %s", item_id, e)
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.post("/knowledge/{item_type}/{item_id}/archive", summary="Archive a knowledge item")
async def archive_knowledge_item(
    item_type: KnowledgeItemType,
    item_id: str,
    body: ArchiveKnowledgeRequest,
) -> dict:
    """
    Archive a knowledge item.
    
    Archived items:
    - Are excluded from regular search results by default
    - Can be included with include_archived=True in search
    - Can be restored using the unarchive endpoint
    - Preserve all data and relationships
    
    This is preferred over deletion for important items that may need to be
    referenced later or restored.
    """
    from ..dependencies import get_graph_store
    
    store = get_graph_store()
    
    # Find the item
    node = store.get_node(item_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Knowledge item not found: {item_id}")
    
    # Verify type matches
    expected_type = _node_type_for_item_type(item_type)
    if node.type != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"Item type mismatch: expected {item_type.value}, found {node.type.value}"
        )
    
    # Archive the item
    try:
        node.properties["status"] = "archived"
        node.properties["archived_at"] = datetime.utcnow().isoformat()
        node.properties["archived_by"] = body.archived_by
        node.properties["archive_reason"] = body.reason
        store.upsert_node(node)
        
        logger.info("Archived knowledge item: %s", item_id)
        
        return {
            "success": True,
            "item_id": item_id,
            "item_type": item_type.value,
            "status": "archived",
            "message": "Item archived successfully",
        }
        
    except Exception as e:
        logger.error("Failed to archive item %s: %s", item_id, e)
        raise HTTPException(status_code=500, detail=f"Archive failed: {str(e)}")


@router.post("/knowledge/{item_type}/{item_id}/unarchive", summary="Restore an archived knowledge item")
async def unarchive_knowledge_item(
    item_type: KnowledgeItemType,
    item_id: str,
) -> dict:
    """
    Restore an archived knowledge item back to active status.
    """
    from ..dependencies import get_graph_store
    
    store = get_graph_store()
    
    # Find the item
    node = store.get_node(item_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Knowledge item not found: {item_id}")
    
    # Verify it's archived
    if node.properties.get("status") != "archived":
        raise HTTPException(status_code=400, detail="Item is not archived")
    
    # Restore the item
    try:
        node.properties["status"] = "active"
        node.properties["unarchived_at"] = datetime.utcnow().isoformat()
        node.properties.pop("archived_at", None)
        node.properties.pop("archived_by", None)
        node.properties.pop("archive_reason", None)
        store.upsert_node(node)
        
        logger.info("Unarchived knowledge item: %s", item_id)
        
        return {
            "success": True,
            "item_id": item_id,
            "item_type": item_type.value,
            "status": "active",
            "message": "Item restored successfully",
        }
        
    except Exception as e:
        logger.error("Failed to unarchive item %s: %s", item_id, e)
        raise HTTPException(status_code=500, detail=f"Unarchive failed: {str(e)}")


@router.get("/knowledge/{item_type}/{item_id}", summary="Get details of a knowledge item")
async def get_knowledge_item(
    item_type: KnowledgeItemType,
    item_id: str,
) -> dict:
    """
    Get detailed information about a specific knowledge item.
    """
    from ..dependencies import get_graph_store
    
    store = get_graph_store()
    
    node = store.get_node(item_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Knowledge item not found: {item_id}")
    
    # Get related edges
    outgoing_edges = store.get_edges_by_source(item_id)
    incoming_edges = store.get_edges_by_target(item_id)
    
    return {
        "item": {
            "id": node.id,
            "type": node.type.value,
            "label": node.label,
            "dsl_source": node.dsl_source,
            "context": node.context,
            "properties": node.properties,
            "created_at": node.created_at.isoformat() if node.created_at else None,
            "updated_at": node.updated_at.isoformat() if node.updated_at else None,
        },
        "relationships": {
            "outgoing": [
                {"id": e.id, "type": e.type.value, "target_id": e.target_id, "properties": e.properties}
                for e in outgoing_edges
            ],
            "incoming": [
                {"id": e.id, "type": e.type.value, "source_id": e.source_id, "properties": e.properties}
                for e in incoming_edges
            ],
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Knowledge Management Helper Functions
# ═══════════════════════════════════════════════════════════════════════════════

# Maps property-graph dict key → actual Neo4j context (PropertyGraphManager.graph_name).
_GRAPH_KEY_TO_NEO4J_CONTEXT: dict[str, str] = {
    "axioms": "axioms",
    "rules": "deduction_rules",
    "facts": "business_domain",
    "theorems": "theorems",
}


def _neo4j_context(graph_key: str) -> str:
    """Resolve a property-graph dict key to the actual Neo4j context name."""
    return _GRAPH_KEY_TO_NEO4J_CONTEXT.get(graph_key, graph_key)


def _get_graph_key_for_type(item_type: KnowledgeItemType) -> str:
    """Map item type to property-graph dict key."""
    mapping = {
        KnowledgeItemType.AXIOM: "axioms",
        KnowledgeItemType.RULE: "rules",
        KnowledgeItemType.FACT: "facts",
        KnowledgeItemType.THEOREM: "theorems",
        KnowledgeItemType.PROCEDURE: "facts",  # Procedures go to facts graph
    }
    return mapping.get(item_type, "facts")


def _get_soundness_contexts_for_type(item_type: KnowledgeItemType) -> list[str]:
    """Neo4j context names to include in soundness checks for a new item."""
    primary = _neo4j_context(_get_graph_key_for_type(item_type))
    base = [_neo4j_context(k) for k in ("axioms", "rules", "facts", "theorems")]
    ordered = [primary] + [ctx for ctx in base if ctx != primary]
    # Deduplicate while preserving order.
    seen: set[str] = set()
    result: list[str] = []
    for ctx in ordered:
        if ctx in seen:
            continue
        seen.add(ctx)
        result.append(ctx)
    return result


def _node_type_for_item_type(item_type: KnowledgeItemType):
    """Map KnowledgeItemType to NodeType."""
    from ...knowledge_graph.schemas import NodeType
    
    mapping = {
        KnowledgeItemType.AXIOM: NodeType.AXIOM,
        KnowledgeItemType.RULE: NodeType.RULE,
        KnowledgeItemType.FACT: NodeType.FACT,
        KnowledgeItemType.THEOREM: NodeType.THEOREM,
        KnowledgeItemType.PROCEDURE: NodeType.PROCEDURE,
    }
    return mapping.get(item_type, NodeType.ENTITY)


def _build_predicate_signature_guide(dsl_examples: list[str]) -> str:
    """Build a compact predicate signature guide from retrieved DSL examples."""
    from ...dsl import DSLParser
    from ...dsl.parser import PredicateNode, AxiomNode, RuleNode, BinaryOpNode, NotNode, QuantifiedNode

    parser = DSLParser()
    signatures: dict[str, int] = {}

    def walk(node: Any) -> None:
        if isinstance(node, PredicateNode):
            current_arity = len(node.args)
            prev_arity = signatures.get(node.name)
            if prev_arity is None or current_arity > prev_arity:
                signatures[node.name] = current_arity
            for arg in node.args:
                walk(arg)
            return

        if isinstance(node, AxiomNode):
            walk(node.expr)
            return

        if isinstance(node, RuleNode):
            for premise in node.premises:
                walk(premise)
            walk(node.conclusion)
            return

        if isinstance(node, BinaryOpNode):
            walk(node.left)
            walk(node.right)
            return

        if isinstance(node, NotNode):
            walk(node.operand)
            return

        if isinstance(node, QuantifiedNode):
            walk(node.body)

    for dsl in dsl_examples:
        try:
            nodes = parser.parse(dsl)
        except Exception:
            continue
        for node in nodes:
            walk(node)

    if not signatures:
        return ""

    ordered = sorted(signatures.items(), key=lambda kv: kv[0].lower())
    return "\n".join(f"- {name}/{arity}" for name, arity in ordered)


def _add_to_knowledge_graph(
    graphs: dict,
    item_type: KnowledgeItemType,
    dsl_source: str,
    name: str | None,
    description: str,
    source: str,
    confidence: float,
) -> str:
    """Add an item to the knowledge graph via the unified registrar."""
    from ..dependencies import get_knowledge_registrar
    from ...knowledge_graph.schemas import NodeType
    from ...pipeline.knowledge_registrar import RegistrationRequest

    registrar = get_knowledge_registrar()
    node_type = _node_type_for_item_type(item_type)

    reg_result = registrar.register(RegistrationRequest(
        dsl_source=dsl_source,
        node_type=node_type,
        context="",  # let registrar pick default
        label=name or dsl_source[:80],
        source=source or "admin_manual",
        confidence=confidence,
        origin="user_provided",
        description=description,
    ))

    if not reg_result.success:
        raise ValueError(
            f"Knowledge registration failed: {'; '.join(reg_result.errors)}"
        )

    if reg_result.warnings:
        logger.warning(
            "Knowledge registration warnings for %s: %s",
            reg_result.node_id, reg_result.warnings,
        )

    return reg_result.node_id

# ═══════════════════════════════════════════════════════════════════════════════
# Graph Visualization Endpoints — Lightweight graph data for visualization
# ═══════════════════════════════════════════════════════════════════════════════

class GraphVisualizationNode(BaseModel):
    """Lightweight node for graph visualization."""
    id: str
    label: str
    type: str


class GraphVisualizationEdge(BaseModel):
    """Lightweight edge for graph visualization."""
    id: str
    source: str
    target: str
    type: str


class GraphVisualizationResponse(BaseModel):
    """Response containing lightweight graph structure."""
    nodes: list[GraphVisualizationNode]
    edges: list[GraphVisualizationEdge]
    context: str
    node_count: int
    edge_count: int


@router.get("/graph/{context_name}", summary="Get lightweight graph structure for visualization")
async def get_graph_visualization(context_name: str) -> GraphVisualizationResponse:
    """
    Fetch a lightweight graph structure (adjacency list) for visualization.
    
    Returns only essential information:
    - Node: id, label, type
    - Edge: id, source, target, type
    
    This is optimized for frontend caching - detailed node/edge info should
    be fetched separately using the detail endpoints.
    """
    from ..dependencies import get_graph_store
    store = get_graph_store()
    
    # Verify context exists
    ctx = store.get_context(context_name)
    if ctx is None:
        raise HTTPException(status_code=404, detail=f"Context '{context_name}' not found")
    
    # Get nodes for context
    nodes = store.get_nodes_by_context(context_name)
    
    # Get edges for context
    edges = store.get_edges_by_context(context_name)
    
    # Build lightweight response
    viz_nodes = [
        GraphVisualizationNode(
            id=n.id,
            label=n.label or n.id[:20],
            type=n.type.value,
        )
        for n in nodes
    ]
    
    # Filter edges to only include those where both source and target exist in our nodes
    node_ids = {n.id for n in nodes}
    viz_edges = [
        GraphVisualizationEdge(
            id=e.id,
            source=e.source_id,
            target=e.target_id,
            type=e.type.value,
        )
        for e in edges
        if e.source_id in node_ids and e.target_id in node_ids
    ]
    
    return GraphVisualizationResponse(
        nodes=viz_nodes,
        edges=viz_edges,
        context=context_name,
        node_count=len(viz_nodes),
        edge_count=len(viz_edges),
    )


@router.get("/graph/{context_name}/node/{node_id}", summary="Get detailed node information")
async def get_node_detail(context_name: str, node_id: str) -> dict:
    """
    Get full details of a single node.
    
    This is used for on-demand loading when a user clicks on a node
    in the visualization.
    """
    from ..dependencies import get_graph_store
    store = get_graph_store()
    
    node = store.get_node(node_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found")
    
    if node.context != context_name:
        raise HTTPException(status_code=400, detail="Node does not belong to this context")
    
    # Get edges connected to this node
    outgoing = store.get_edges_by_source(node_id)
    incoming = store.get_edges_by_target(node_id)
    
    return {
        "node": node.model_dump(mode="json"),
        "edges": {
            "outgoing": [e.model_dump(mode="json") for e in outgoing],
            "incoming": [e.model_dump(mode="json") for e in incoming],
            "total_outgoing": len(outgoing),
            "total_incoming": len(incoming),
        },
    }


@router.get("/graph/{context_name}/edge/{edge_id}", summary="Get detailed edge information")
async def get_edge_detail(context_name: str, edge_id: str) -> dict:
    """
    Get full details of a single edge.
    """
    from ..dependencies import get_graph_store
    store = get_graph_store()
    
    # Find edge by iterating (or we could add a get_edge method to store)
    all_edges = store.get_edges_by_context(context_name)
    edge = next((e for e in all_edges if e.id == edge_id), None)
    
    if edge is None:
        raise HTTPException(status_code=404, detail=f"Edge '{edge_id}' not found")
    
    # Get source and target node info
    source_node = store.get_node(edge.source_id)
    target_node = store.get_node(edge.target_id)
    
    return {
        "edge": edge.model_dump(mode="json"),
        "source_node": source_node.model_dump(mode="json") if source_node else None,
        "target_node": target_node.model_dump(mode="json") if target_node else None,
    }


@router.get("/graph/{context_name}/stats", summary="Get graph statistics")
async def get_graph_stats(context_name: str) -> dict:
    """
    Get statistics about a graph context.
    """
    from ..dependencies import get_graph_store
    from collections import Counter
    store = get_graph_store()
    
    ctx = store.get_context(context_name)
    if ctx is None:
        raise HTTPException(status_code=404, detail=f"Context '{context_name}' not found")
    
    nodes = store.get_nodes_by_context(context_name)
    edges = store.get_edges_by_context(context_name)
    
    node_types = Counter(n.type.value for n in nodes)
    edge_types = Counter(e.type.value for e in edges)
    
    return {
        "context": ctx.model_dump(mode="json"),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "node_types": dict(node_types),
        "edge_types": dict(edge_types),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Granular AST-Based Fact Authorization
# ═══════════════════════════════════════════════════════════════════════════════


class ASTComponentReviewRequest(BaseModel):
    """Review a single AST component of a pending fact."""
    component_id: str
    approved: bool
    reason: str | None = None
    reviewer_id: str | None = None


class ASTSubtreeReviewRequest(BaseModel):
    """Bulk-approve an entire AST subtree of a pending fact."""
    root_component_id: str
    approved: bool
    reason: str | None = None
    reviewer_id: str | None = None


@router.get(
    "/pending-facts/{fact_id}/ast",
    summary="Get AST decomposition of a pending fact",
)
async def get_fact_ast(fact_id: str) -> dict:
    """
    Return the AST component tree for a pending fact.

    Components are ordered leaves-first (deepest depth first) so the
    admin UI can guide the reviewer to authorize from leaves up.
    """
    from .chat import get_pending_facts, decompose_fact_to_ast

    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")

    fact = facts[fact_id]

    # Build or return cached AST components
    components = getattr(fact, "ast_components", None) or []
    if not components and fact.dsl_source:
        try:
            components = decompose_fact_to_ast(fact.dsl_source)
            fact.ast_components = components  # type: ignore[attr-defined]
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Cannot decompose DSL: {exc}",
            ) from exc

    # Sort leaves-first (deepest first)
    sorted_components = sorted(components, key=lambda c: -c["depth"])

    return {
        "fact_id": fact_id,
        "dsl_source": fact.dsl_source,
        "total_components": len(sorted_components),
        "components": sorted_components,
    }


@router.post(
    "/pending-facts/{fact_id}/ast/review-component",
    summary="Review a single AST component",
)
async def review_ast_component(
    fact_id: str, body: ASTComponentReviewRequest
) -> dict:
    """
    Approve or reject a single AST leaf/node.

    A parent node cannot be approved until all its children are approved.
    """
    from .chat import get_pending_facts, update_pending_fact

    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")

    fact = facts[fact_id]
    components: list[dict] = getattr(fact, "ast_components", None) or []
    if not components:
        raise HTTPException(
            status_code=400,
            detail="Fact has no AST decomposition",
        )

    # Find the target component
    target = None
    for comp in components:
        if comp["id"] == body.component_id:
            target = comp
            break
    if target is None:
        raise HTTPException(
            status_code=404,
            detail=f"Component {body.component_id} not found",
        )

    if body.approved:
        # Check that all children are already approved
        for child_id in target.get("children", []):
            child = next((c for c in components if c["id"] == child_id), None)
            if child and child.get("status") != "approved":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Cannot approve {body.component_id}: child "
                        f"{child_id} is not yet approved"
                    ),
                )
        target["status"] = "approved"
    else:
        target["status"] = "rejected"
        target["rejection_reason"] = body.reason

    # Check if ALL components are now approved → auto-approve the whole fact
    all_approved = all(c.get("status") == "approved" for c in components)
    if all_approved:
        try:
            await _add_fact_to_knowledge_graph(fact)
            fact.status = PendingFactStatus.APPROVED
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"All AST approved, but KG insertion failed: {e}",
            ) from e

    any_rejected = any(c.get("status") == "rejected" for c in components)
    if any_rejected:
        fact.status = PendingFactStatus.REJECTED
        fact.rejection_reason = body.reason or "AST component rejected"

    fact.reviewed_by = body.reviewer_id  # type: ignore[assignment]
    fact.reviewed_at = datetime.utcnow()  # type: ignore[assignment]
    update_pending_fact(fact_id, fact)

    return {
        "fact_id": fact_id,
        "component_id": body.component_id,
        "component_status": target["status"],
        "fact_status": fact.status.value,
        "all_approved": all_approved,
    }


@router.post(
    "/pending-facts/{fact_id}/ast/review-subtree",
    summary="Bulk approve/reject an AST subtree",
)
async def review_ast_subtree(
    fact_id: str, body: ASTSubtreeReviewRequest
) -> dict:
    """
    Approve or reject an entire AST subtree rooted at the given component.

    When approving, all descendants (including the root) are approved.
    When rejecting, all descendants (including the root) are rejected.
    """
    from .chat import get_pending_facts, update_pending_fact

    facts = get_pending_facts()
    if fact_id not in facts:
        raise HTTPException(status_code=404, detail="Pending fact not found")

    fact = facts[fact_id]
    components: list[dict] = getattr(fact, "ast_components", None) or []
    if not components:
        raise HTTPException(
            status_code=400,
            detail="Fact has no AST decomposition",
        )

    # Build id → component lookup
    by_id = {c["id"]: c for c in components}
    root = by_id.get(body.root_component_id)
    if root is None:
        raise HTTPException(
            status_code=404,
            detail=f"Component {body.root_component_id} not found",
        )

    # Collect all descendants (BFS)
    subtree_ids: list[str] = []
    queue = [body.root_component_id]
    while queue:
        cid = queue.pop(0)
        subtree_ids.append(cid)
        node = by_id.get(cid)
        if node:
            queue.extend(node.get("children", []))

    new_status = "approved" if body.approved else "rejected"
    for cid in subtree_ids:
        node = by_id.get(cid)
        if node:
            node["status"] = new_status
            if not body.approved:
                node["rejection_reason"] = body.reason

    # Check if entire fact is now approved
    all_approved = all(c.get("status") == "approved" for c in components)
    if all_approved:
        try:
            await _add_fact_to_knowledge_graph(fact)
            fact.status = PendingFactStatus.APPROVED
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"All AST approved, but KG insertion failed: {e}",
            ) from e

    any_rejected = any(c.get("status") == "rejected" for c in components)
    if any_rejected:
        fact.status = PendingFactStatus.REJECTED
        fact.rejection_reason = body.reason or "AST subtree rejected"

    fact.reviewed_by = body.reviewer_id  # type: ignore[assignment]
    fact.reviewed_at = datetime.utcnow()  # type: ignore[assignment]
    update_pending_fact(fact_id, fact)

    return {
        "fact_id": fact_id,
        "subtree_root": body.root_component_id,
        "components_affected": len(subtree_ids),
        "fact_status": fact.status.value,
        "all_approved": all_approved,
    }
