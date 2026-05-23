"""
Reasoning routes — Agentic reasoning with PropertyGraphIndex + Z3.
"""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, HTTPException

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# Request/Response Models
# ═══════════════════════════════════════════════════════════════════════════════

class ReasonRequest(BaseModel):
    """Request for reasoning agent."""
    query: str = Field(..., description="Question or task for the reasoning agent")
    context: dict[str, Any] | None = Field(
        None, description="Optional additional context"
    )
    require_proof: bool = Field(
        False, description="If True, requires Z3 verification"
    )


class ReasonResponse(BaseModel):
    """Response from reasoning agent."""
    status: str
    answer: str
    proof_trace: list[str]
    used_axioms: list[str]
    used_rules: list[str]
    iterations: int


class ProveRequest(BaseModel):
    """Request for proving a DSL statement."""
    statement_dsl: str = Field(..., description="DSL statement to prove")
    hint: str | None = Field(None, description="Optional hint for the prover")


class ProveResponse(BaseModel):
    """Response from proof attempt."""
    status: str
    message: str
    proof_trace: list[str]
    model: dict[str, Any] | None = None


class RetrieveGraphRequest(BaseModel):
    """Request for retrieving from a specific graph."""
    query: str = Field(..., description="Search query")
    graph: str = Field(
        "all",
        description="Graph to search: axioms, rules, facts, theorems, or all"
    )
    top_k: int = Field(10, description="Number of results")


class RetrieveGraphResponse(BaseModel):
    """Response from graph retrieval."""
    results: list[dict[str, Any]]
    graph: str
    total: int


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reason", summary="Submit a reasoning request to the agent")
async def reason(body: ReasonRequest) -> ReasonResponse:
    """
    Submit a question or task to the reasoning agent.
    
    The agent will:
    1. Retrieve relevant context from PropertyGraphIndex stores
    2. Attempt formal verification with Z3 if applicable
    3. Use LLM reasoning when Z3 is insufficient
    4. Store newly derived knowledge
    """
    from ..dependencies import get_reasoning_agent
    
    agent = get_reasoning_agent()
    
    try:
        if body.require_proof:
            result = await agent.answer_question(
                body.query,
                require_proof=True,
            )
        else:
            result = await agent.reason(
                body.query,
                context=body.context,
            )
        
        return ReasonResponse(
            status=result.status.value,
            answer=result.answer,
            proof_trace=result.proof_trace,
            used_axioms=result.used_axioms,
            used_rules=result.used_rules,
            iterations=result.iterations,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reasoning failed: {exc}"
        ) from exc


@router.post("/prove", summary="Attempt to prove a DSL statement")
async def prove(body: ProveRequest) -> ProveResponse:
    """
    Attempt to formally prove a DSL statement using Z3.
    
    The agent will gather relevant axioms and rules, then
    use Z3 to verify the statement.
    """
    from ..dependencies import get_reasoning_agent
    
    agent = get_reasoning_agent()
    
    try:
        result = await agent.prove_statement(
            body.statement_dsl,
            hint=body.hint,
        )
        
        return ProveResponse(
            status=result.status.value,
            message=result.answer,
            proof_trace=result.proof_trace,
            model=result.contradiction_info,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Proof attempt failed: {exc}"
        ) from exc


@router.post("/retrieve-graph", summary="Retrieve from PropertyGraphIndex stores")
async def retrieve_graph(body: RetrieveGraphRequest) -> RetrieveGraphResponse:
    """
    Retrieve entities from the PropertyGraphIndex stores.
    
    Can search in:
    - axioms: Logical axioms
    - rules: Deduction rules
    - facts: Business domain facts
    - theorems: Proven theorems/AOPs
    - all: Search all graphs
    """
    from ..dependencies import get_property_graphs
    
    graphs = get_property_graphs()
    
    results = []
    searched_graph = body.graph
    
    try:
        if body.graph in ("axioms", "all"):
            axiom_results = graphs["axioms"].retrieve(body.query, top_k=body.top_k)
            results.extend([{**r, "graph": "axioms"} for r in axiom_results])
        
        if body.graph in ("rules", "all"):
            rule_results = graphs["rules"].retrieve(body.query, top_k=body.top_k)
            results.extend([{**r, "graph": "rules"} for r in rule_results])
        
        if body.graph in ("facts", "all"):
            fact_results = graphs["facts"].retrieve(body.query, top_k=body.top_k)
            results.extend([{**r, "graph": "facts"} for r in fact_results])
        
        if body.graph in ("theorems", "all"):
            theorem_results = graphs["theorems"].retrieve(body.query, top_k=body.top_k)
            results.extend([{**r, "graph": "theorems"} for r in theorem_results])
        
        # Sort by score if from multiple graphs
        if body.graph == "all":
            results.sort(key=lambda x: x.get("score", 0), reverse=True)
            results = results[:body.top_k]
        
        return RetrieveGraphResponse(
            results=results,
            graph=searched_graph,
            total=len(results),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Retrieval failed: {exc}"
        ) from exc


@router.get("/status", summary="Get reasoning agent status")
async def status() -> dict[str, Any]:
    """Get the current status of the reasoning agent and graphs."""
    from ..dependencies import get_reasoning_agent, get_property_graphs
    
    try:
        agent = get_reasoning_agent()
        graphs = get_property_graphs()
        
        return {
            "agent_ready": True,
            "tools_available": len(agent.tools),
            "graphs": {
                "axioms": "ready",
                "rules": "ready", 
                "facts": "ready",
                "theorems": "ready",
            },
            "z3_engine": "ready",
        }
    except Exception as exc:
        return {
            "agent_ready": False,
            "error": str(exc),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Multi-hop Traversal & Reasoning Chain Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

class TraversalRequest(BaseModel):
    """Request for multi-hop graph traversal."""
    node_id: str = Field(..., description="Starting node ID")
    max_hops: int = Field(2, ge=1, le=5, description="Maximum traversal depth")
    direction: str = Field("both", description="Direction: 'outgoing', 'incoming', or 'both'")
    node_types: list[str] | None = Field(None, description="Filter by node types")
    edge_types: list[str] | None = Field(None, description="Filter by edge types")


class TraversalResponse(BaseModel):
    """Response from graph traversal."""
    neighbors: list[dict[str, Any]]
    total: int
    start_node: str
    max_hops: int


class PathFindRequest(BaseModel):
    """Request for finding paths between nodes."""
    source_id: str = Field(..., description="Starting node ID")
    target_id: str = Field(..., description="Target node ID")
    max_hops: int = Field(4, ge=1, le=6, description="Maximum path length")
    find_all: bool = Field(False, description="Find all paths (uses APOC)")


class PathFindResponse(BaseModel):
    """Response from path finding."""
    paths: list[dict[str, Any]]
    total_paths: int
    shortest_length: int | None


class ReasoningChainRequest(BaseModel):
    """Request for reasoning chain traversal."""
    node_id: str = Field(..., description="Starting node ID")
    direction: str = Field("forward", description="'forward' (axiom→theorem) or 'backward' (theorem→axiom)")
    max_depth: int = Field(5, ge=1, le=10, description="Maximum chain depth")


class ReasoningChainResponse(BaseModel):
    """Response from reasoning chain traversal."""
    start_node: str
    direction: str
    axioms: list[dict[str, Any]]
    deduction_rules: list[dict[str, Any]]
    theorems: list[dict[str, Any]]
    entities: list[dict[str, Any]]


class DerivationRequest(BaseModel):
    """Request for theorem derivation tree."""
    theorem_id: str = Field(..., description="ID of the theorem to explain")


class DerivationResponse(BaseModel):
    """Response with derivation explanation."""
    theorem_id: str
    supporting_axioms: list[dict[str, Any]]
    applied_rules: list[dict[str, Any]]
    intermediate_facts: list[dict[str, Any]]
    derivation_edges: list[dict[str, Any]]


class ContextualRetrievalRequest(BaseModel):
    """Request for retrieval with graph context expansion."""
    query: str = Field(..., description="Search query")
    graph: str = Field("all", description="Graph to search: axioms, rules, facts, theorems, or all")
    top_k: int = Field(5, description="Number of initial results")
    expansion_hops: int = Field(2, ge=1, le=3, description="Hops to expand context")
    include_reasoning_chain: bool = Field(True, description="Include reasoning derivations")


class ContextualRetrievalResponse(BaseModel):
    """Response from contextual retrieval."""
    primary_results: list[dict[str, Any]]
    expanded_context: dict[str, Any]
    reasoning_chains: list[dict[str, Any]]


@router.post("/traverse", summary="Multi-hop graph traversal")
async def traverse_graph(body: TraversalRequest) -> TraversalResponse:
    """
    Explore the graph using multi-hop traversal from a starting node.
    
    Returns all nodes within max_hops of the starting node, optionally
    filtered by node/edge types.
    """
    from ..dependencies import get_graph_store
    from ...knowledge_graph.schemas import NodeType, EdgeType
    
    store = get_graph_store()
    
    try:
        # Convert string types to enums
        node_types = None
        if body.node_types:
            node_types = [NodeType(t) for t in body.node_types]
        
        edge_types = None
        if body.edge_types:
            edge_types = [EdgeType(t) for t in body.edge_types]
        
        neighbors = store.get_neighbors(
            node_id=body.node_id,
            max_hops=body.max_hops,
            direction=body.direction,
            node_types=node_types,
            edge_types=edge_types,
        )
        
        return TraversalResponse(
            neighbors=[
                {
                    "id": n["node"].id,
                    "type": n["node"].type.value,
                    "label": n["node"].label,
                    "context": n["node"].context,
                    "distance": n["distance"],
                    "dsl_source": n["node"].dsl_source,
                }
                for n in neighbors
            ],
            total=len(neighbors),
            start_node=body.node_id,
            max_hops=body.max_hops,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Traversal failed: {exc}"
        ) from exc


@router.post("/find-path", summary="Find paths between two nodes")
async def find_path(body: PathFindRequest) -> PathFindResponse:
    """
    Find paths between two nodes in the graph.
    
    Can find shortest path or all paths (using APOC) between nodes.
    Useful for understanding reasoning chains and derivations.
    """
    from ..dependencies import get_graph_store
    
    store = get_graph_store()
    
    try:
        if body.find_all:
            paths = store.find_all_paths(
                source_id=body.source_id,
                target_id=body.target_id,
                max_hops=body.max_hops,
            )
        else:
            paths = store.find_paths(
                source_id=body.source_id,
                target_id=body.target_id,
                max_hops=body.max_hops,
            )
        
        shortest = min((p["length"] for p in paths), default=None)
        
        return PathFindResponse(
            paths=paths,
            total_paths=len(paths),
            shortest_length=shortest,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Path finding failed: {exc}"
        ) from exc


@router.post("/reasoning-chain", summary="Get reasoning chain from a node")
async def get_reasoning_chain(body: ReasoningChainRequest) -> ReasoningChainResponse:
    """
    Follow reasoning chains: axiom → deduction_rule → theorem.
    
    Traces the logical flow of reasoning through the knowledge graph,
    showing how axioms lead to theorems through deduction rules.
    """
    from ..dependencies import get_graph_store
    
    store = get_graph_store()
    
    try:
        chain = store.get_reasoning_chain(
            node_id=body.node_id,
            direction=body.direction,
            max_depth=body.max_depth,
        )
        
        return ReasoningChainResponse(
            start_node=chain["start_node"],
            direction=chain["direction"],
            axioms=chain["axioms"],
            deduction_rules=chain["deduction_rules"],
            theorems=chain["theorems"],
            entities=chain["entities"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reasoning chain traversal failed: {exc}"
        ) from exc


@router.post("/derivation", summary="Get derivation tree for a theorem")
async def get_derivation(body: DerivationRequest) -> DerivationResponse:
    """
    Get the full derivation tree for a theorem.
    
    Shows all axioms and rules that were used to derive the theorem,
    providing a complete explanation of how the conclusion was reached.
    """
    from ..dependencies import get_property_graphs
    
    graphs = get_property_graphs()
    
    try:
        # Use theorems graph for derivation explanation
        explanation = graphs["theorems"].get_derivation_explanation(body.theorem_id)
        
        return DerivationResponse(
            theorem_id=explanation["theorem_id"],
            supporting_axioms=explanation["supporting_axioms"],
            applied_rules=explanation["applied_rules"],
            intermediate_facts=explanation["intermediate_facts"],
            derivation_edges=explanation["derivation_edges"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Derivation lookup failed: {exc}"
        ) from exc


@router.post("/retrieve-contextual", summary="Retrieve with graph context expansion")
async def retrieve_contextual(body: ContextualRetrievalRequest) -> ContextualRetrievalResponse:
    """
    Retrieve entities with multi-hop graph context expansion.
    
    Combines vector similarity search with graph traversal to provide
    richer context for reasoning. This is the enhanced retrieval that
    leverages Neo4j's graph capabilities.
    """
    from ..dependencies import get_property_graphs
    
    graphs = get_property_graphs()
    
    try:
        # Choose which graph(s) to search
        if body.graph == "all":
            # Search all graphs and merge results
            all_results = {
                "primary_results": [],
                "expanded_context": {"nodes": [], "edges": []},
                "reasoning_chains": [],
            }
            
            for graph_name in ["axioms", "rules", "facts", "theorems"]:
                result = graphs[graph_name].retrieve_with_context(
                    query=body.query,
                    top_k=body.top_k,
                    expansion_hops=body.expansion_hops,
                    include_reasoning_chain=body.include_reasoning_chain,
                )
                all_results["primary_results"].extend(
                    [{**r, "graph": graph_name} for r in result["primary_results"]]
                )
                all_results["expanded_context"]["nodes"].extend(
                    result["expanded_context"].get("nodes", [])
                )
                all_results["expanded_context"]["edges"].extend(
                    result["expanded_context"].get("edges", [])
                )
                all_results["reasoning_chains"].extend(result["reasoning_chains"])
            
            # Sort and limit
            all_results["primary_results"].sort(
                key=lambda x: x.get("score", 0), reverse=True
            )
            all_results["primary_results"] = all_results["primary_results"][:body.top_k]
            
            # Deduplicate context nodes
            seen_ids = set()
            unique_nodes = []
            for node in all_results["expanded_context"]["nodes"]:
                if node["id"] not in seen_ids:
                    seen_ids.add(node["id"])
                    unique_nodes.append(node)
            all_results["expanded_context"]["nodes"] = unique_nodes
            
            return ContextualRetrievalResponse(**all_results)
        else:
            graph = graphs.get(body.graph)
            if not graph:
                raise HTTPException(status_code=400, detail=f"Unknown graph: {body.graph}")
            
            result = graph.retrieve_with_context(
                query=body.query,
                top_k=body.top_k,
                expansion_hops=body.expansion_hops,
                include_reasoning_chain=body.include_reasoning_chain,
            )
            
            return ContextualRetrievalResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Contextual retrieval failed: {exc}"
        ) from exc
