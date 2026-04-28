"""
PropertyGraphIndex Managers
===========================
Manages multiple PropertyGraphIndex instances for different domains
of the symbolic logic deduction system:

- AxiomsGraph: Immutable logical axioms with syntactical deduction shortcuts
- DeductionRulesGraph: Mutable deduction rules (Hilbert-style)
- BusinessDomainGraph: Facts about entities, endpoints, screens, workflows
- TheoremsGraph: Deduced AOPs from applying axioms/rules to domain facts
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from datetime import datetime

from llama_index.core import PropertyGraphIndex, StorageContext, Settings as LISettings
from llama_index.core.indices.property_graph import (
    SimpleLLMPathExtractor,
    ImplicitPathExtractor,
)
from llama_index.core.schema import TextNode, NodeRelationship, RelatedNodeInfo
from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore

from ..config import settings
from ..knowledge_graph import Neo4jGraphStore, GraphContextType, NodeType, EdgeType
from ..knowledge_graph.schemas import GraphNode, GraphEdge
from ..pipeline.rich_embeddings import build_rich_embedding_text

logger = logging.getLogger(__name__)


@dataclass
class GraphEntity:
    """A triple representing a graph entity with relations."""
    subject: str
    predicate: str
    object: str
    properties: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


class PropertyGraphManager(ABC):
    """
    Abstract base class for PropertyGraphIndex management.
    
    Each domain graph inherits from this and implements domain-specific
    extraction, retrieval, and storage logic.
    """
    
    def __init__(
        self,
        graph_name: str,
        context_type: GraphContextType,
        description: str,
        graph_store: Neo4jGraphStore | None = None,
        llm: Any = None,
        embed_model: Any = None,
    ) -> None:
        self.graph_name = graph_name
        self.context_type = context_type
        self.description = description
        self._graph_store = graph_store or Neo4jGraphStore()
        self._llm = llm
        self._embed_model = embed_model
        self._index: PropertyGraphIndex | None = None
        self._storage_context: StorageContext | None = None
        
        # Initialize graph context in persistent store
        self._init_context()
    
    def _init_context(self) -> None:
        """Ensure the graph context exists in the persistent store."""
        from ..knowledge_graph.schemas import GraphContext
        ctx = GraphContext(
            name=self.graph_name,
            type=self.context_type,
            description=self.description,
        )
        self._graph_store.upsert_context(ctx)
        logger.info(f"Initialized PropertyGraph context: {self.graph_name}")
    
    @property
    def index(self) -> PropertyGraphIndex:
        """Lazily build and return the PropertyGraphIndex."""
        if self._index is None:
            self._index = self._build_index()
        return self._index
    
    def _build_index(self) -> PropertyGraphIndex:
        """Build the PropertyGraphIndex with Neo4j backend."""
        # Use configured LLM and embedding if not provided
        llm = self._llm or LISettings.llm
        embed_model = self._embed_model or LISettings.embed_model
        
        # Create Neo4j property graph store with database per graph
        graph_store = Neo4jPropertyGraphStore(
            username=settings.neo4j_user,
            password=settings.neo4j_password,
            url=settings.neo4j_uri,
            database="neo4j",  # Community edition only supports single database
        )
        
        # Build extractors based on domain
        extractors = self._get_extractors(llm)
        
        # Create storage context
        self._storage_context = StorageContext.from_defaults(
            property_graph_store=graph_store
        )
        
        # Build index from existing Neo4j data (mirrors working rag_example.py)
        index = PropertyGraphIndex.from_existing(
            property_graph_store=graph_store,
            storage_context=self._storage_context,
            llm=llm,
            embed_model=embed_model,
            kg_extractors=extractors,
        )
        
        logger.info(f"Built PropertyGraphIndex for {self.graph_name} with Neo4j backend (from_existing)")
        return index
    
    @abstractmethod
    def _get_extractors(self, llm: Any) -> list[Any]:
        """Return domain-specific extractors for graph construction."""
        pass
    
    def _load_from_persistent_store(self, index: PropertyGraphIndex) -> None:
        """Load existing nodes and edges from PostgreSQL into the index."""
        nodes = self._graph_store.get_nodes_by_context(self.graph_name)
        edges = self._graph_store.get_edges_by_context(self.graph_name)
        
        for node in nodes:
            if node.dsl_source:
                text_node = TextNode(
                    text=node.dsl_source,
                    id_=node.id,
                    metadata={
                        "type": node.type.value,
                        "label": node.label,
                        **node.properties,
                    },
                )
                index.insert_nodes([text_node])
        
        logger.info(f"Loaded {len(nodes)} nodes and {len(edges)} edges from persistent store")
    
    def retrieve(
        self,
        query: str,
        top_k: int = 10,
        include_relations: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Retrieve relevant entities and relations from the graph.
        
        Args:
            query: Natural language or DSL query
            top_k: Maximum number of results
            include_relations: Whether to include related entities
            
        Returns:
            List of retrieved entities with metadata
        """
        try:
            retriever = self.index.as_retriever(
                similarity_top_k=top_k,
                include_text=True,
            )
            results = retriever.retrieve(query)

            retrieved = []
            for r in results:
                item = {
                    "id": r.node_id,
                    "text": r.get_content(),
                    "score": r.get_score() or 0.0,
                    "metadata": r.metadata or {},
                }
                if include_relations:
                    item["relations"] = self._get_relations(r.node_id)
                retrieved.append(item)

            return retrieved
        except Exception as exc:
            # Fallback for sparse/empty embedding state in property graphs.
            # This keeps admin search endpoints functional even before vector
            # embeddings are fully populated for a graph.
            if "No embeddings to aggregate" not in str(exc):
                raise

            logger.warning(
                "Embedding retrieval unavailable for graph '%s'; falling back to text search",
                self.graph_name,
            )
            return self._fallback_text_retrieve(
                query=query,
                top_k=top_k,
                include_relations=include_relations,
            )

    async def aretrieve(
        self,
        query: str,
        top_k: int = 10,
        include_relations: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Async variant of retrieve() for agent tool execution inside async workflows.
        """
        try:
            retriever = self.index.as_retriever(
                similarity_top_k=top_k,
                include_text=True,
            )
            results = await retriever.aretrieve(query)

            retrieved = []
            for r in results:
                item = {
                    "id": r.node_id,
                    "text": r.get_content(),
                    "score": r.get_score() or 0.0,
                    "metadata": r.metadata or {},
                }
                if include_relations:
                    item["relations"] = self._get_relations(r.node_id)
                retrieved.append(item)

            return retrieved
        except Exception as exc:
            if "No embeddings to aggregate" not in str(exc):
                raise

            logger.warning(
                "Embedding async retrieval unavailable for graph '%s'; falling back to text search",
                self.graph_name,
            )
            return self._fallback_text_retrieve(
                query=query,
                top_k=top_k,
                include_relations=include_relations,
            )

    def _fallback_text_retrieve(
        self,
        query: str,
        top_k: int = 10,
        include_relations: bool = True,
    ) -> list[dict[str, Any]]:
        """Simple lexical fallback when embedding retrieval is unavailable."""
        nodes = self._graph_store.get_nodes_by_context(self.graph_name)
        query_terms = [t.lower() for t in query.split() if t.strip()]

        scored: list[tuple[float, GraphNode]] = []
        for node in nodes:
            text = (node.dsl_source or node.label or "").lower()
            if not text:
                continue

            # Score by count of matched query terms; fallback to 1.0 for broad match.
            matches = sum(1 for t in query_terms if t in text)
            if matches == 0:
                continue

            score = matches / max(len(query_terms), 1)
            scored.append((score, node))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_nodes = scored[:top_k]

        results: list[dict[str, Any]] = []
        for score, node in top_nodes:
            item = {
                "id": node.id,
                "text": node.dsl_source or node.label,
                "score": float(score),
                "metadata": node.properties or {},
            }
            if include_relations:
                item["relations"] = self._get_relations(node.id)
            results.append(item)

        return results
    
    def _get_relations(self, node_id: str) -> list[dict[str, Any]]:
        """Get relations for a specific node from the persistent store."""
        edges = self._graph_store.get_edges_by_source(node_id)
        return [
            {
                "type": e.type.value,
                "target_id": e.target_id,
                "properties": e.properties,
            }
            for e in edges
        ]
    
    def add_entity(
        self,
        entity: GraphEntity,
        node_type: NodeType,
    ) -> str:
        """
        Add an entity to the graph with relations.
        
        Returns the node ID.
        """
        # Create DSL representation
        dsl_source = f"{entity.subject} {entity.predicate} {entity.object}"
        
        # Persist to Neo4j via our graph store
        node = Neo4jGraphStore.new_node(
            node_type=node_type,
            label=entity.subject,
            context=self.graph_name,
            properties={
                "predicate": entity.predicate,
                "object": entity.object,
                **entity.properties,
            },
            dsl_source=dsl_source,
        )
        self._graph_store.upsert_node(node)
        
        # Build rich embedding text that encodes type, semantics, domain
        rich_text = build_rich_embedding_text(
            dsl_source=dsl_source,
            node_type=node_type.value,
            label=entity.subject,
            properties={
                "predicate": entity.predicate,
                "object": entity.object,
                **entity.properties,
            },
        )
        
        # Add to PropertyGraphIndex with rich embedding text
        text_node = TextNode(
            text=rich_text,
            id_=node.id,
            metadata={
                "type": node_type.value,
                "context": self.graph_name,
                "subject": entity.subject,
                "predicate": entity.predicate,
                "object": entity.object,
                "dsl_source": dsl_source,
                **entity.properties,
            },
        )
        try:
            self.index.insert_nodes([text_node])
        except Exception as exc:
            err = str(exc)
            # In some runtime paths (FastAPI + instrumentation), LlamaIndex can
            # throw loop-affinity errors. Data is already persisted in Neo4j, so
            # we log and continue to avoid failing write endpoints.
            loop_conflict = (
                "attached to a different loop" in err
                or "asyncio.run() cannot be called from a running event loop" in err
                or "got Future" in err and "different loop" in err
            )
            if not loop_conflict:
                raise
            logger.warning(
                "Skipped PropertyGraphIndex insert for node %s due to event-loop conflict: %s",
                node.id,
                err,
            )
        
        logger.info(f"Added entity to {self.graph_name}: {entity.subject}")
        return node.id
    
    def add_relation(
        self,
        source_id: str,
        target_id: str,
        relation_type: EdgeType,
        properties: dict[str, Any] | None = None,
    ) -> str:
        """Add a relation between two entities."""
        edge = Neo4jGraphStore.new_edge(
            source_id=source_id,
            target_id=target_id,
            edge_type=relation_type,
            properties=properties or {},
        )
        self._graph_store.upsert_edge(edge)
        
        logger.info(f"Added relation: {source_id} --{relation_type.value}--> {target_id}")
        return edge.id
    
    def query_subgraph(
        self,
        start_node_id: str,
        max_depth: int = 2,
    ) -> dict[str, Any]:
        """
        Query a subgraph starting from a specific node.
        
        Returns nodes and edges within max_depth hops.
        """
        visited_nodes = set()
        visited_edges = set()
        nodes_to_explore = [(start_node_id, 0)]
        
        result_nodes = []
        result_edges = []
        
        while nodes_to_explore:
            node_id, depth = nodes_to_explore.pop(0)
            
            if node_id in visited_nodes or depth > max_depth:
                continue
            
            visited_nodes.add(node_id)
            
            node = self._graph_store.get_node(node_id)
            if node:
                result_nodes.append(node)
            
            edges = self._graph_store.get_edges_by_source(node_id)
            for edge in edges:
                if edge.id not in visited_edges:
                    visited_edges.add(edge.id)
                    result_edges.append(edge)
                    nodes_to_explore.append((edge.target_id, depth + 1))
        
        return {
            "nodes": result_nodes,
            "edges": result_edges,
        }

    # ── Enhanced Multi-hop Retrieval ──────────────────────────────────────────

    def retrieve_with_context(
        self,
        query: str,
        top_k: int = 5,
        expansion_hops: int = 2,
        include_reasoning_chain: bool = True,
    ) -> dict[str, Any]:
        """
        Retrieve entities and expand their graph context using multi-hop traversal.
        
        Combines vector similarity search with graph exploration to provide
        richer context for reasoning.
        
        Args:
            query: Natural language or DSL query
            top_k: Number of initial results from vector search
            expansion_hops: How many hops to expand from each result
            include_reasoning_chain: Whether to trace reasoning lineage
            
        Returns:
            {
                "primary_results": [...],  # Direct vector search results
                "expanded_context": {...}, # Multi-hop neighborhood
                "reasoning_chains": [...], # Derivation chains (if applicable)
            }
        """
        # Step 1: Vector similarity search
        retriever = self.index.as_retriever(
            similarity_top_k=top_k,
            include_text=True,
        )
        results = retriever.retrieve(query)
        
        primary_results = []
        node_ids = []
        
        for r in results:
            primary_results.append({
                "id": r.node_id,
                "text": r.get_content(),
                "score": r.get_score() or 0.0,
                "metadata": r.metadata or {},
            })
            node_ids.append(r.node_id)
        
        # Step 2: Expand graph context using Neo4j multi-hop
        expanded_context = self._graph_store.expand_from_nodes(
            node_ids=node_ids,
            hops=expansion_hops,
        )
        
        # Step 3: Get reasoning chains for relevant node types
        reasoning_chains = []
        if include_reasoning_chain:
            for result in primary_results:
                node_type = result.get("metadata", {}).get("type", "")
                if node_type in ["axiom", "deduction_rule", "theorem"]:
                    chain = self._graph_store.get_reasoning_chain(
                        node_id=result["id"],
                        direction="forward" if node_type == "axiom" else "backward",
                        max_depth=4,
                    )
                    if chain.get("axioms") or chain.get("theorems"):
                        reasoning_chains.append({
                            "start_node": result["id"],
                            "chain": chain,
                        })
        
        return {
            "primary_results": primary_results,
            "expanded_context": expanded_context,
            "reasoning_chains": reasoning_chains,
        }

    def find_reasoning_path(
        self,
        source_id: str,
        target_id: str,
        max_hops: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Find reasoning paths between two nodes (e.g., axiom to theorem).
        
        Uses Neo4j path-finding to trace how knowledge derives from axioms
        through deduction rules to reach conclusions.
        
        Args:
            source_id: Starting node (e.g., axiom)
            target_id: Target node (e.g., theorem)
            max_hops: Maximum path length
            
        Returns:
            List of paths with nodes and edges explaining the derivation
        """
        return self._graph_store.find_all_paths(
            source_id=source_id,
            target_id=target_id,
            max_hops=max_hops,
        )

    def get_derivation_explanation(self, theorem_id: str) -> dict[str, Any]:
        """
        Get a structured explanation of how a theorem was derived.
        
        Traces backward through the graph to find all axioms and rules
        that support this theorem.
        
        Args:
            theorem_id: ID of the theorem node
            
        Returns:
            Derivation tree with supporting evidence
        """
        tree = self._graph_store.get_derivation_tree(theorem_id)
        
        # Enrich with DSL sources for formal reasoning
        enriched = {
            "theorem_id": theorem_id,
            "supporting_axioms": [],
            "applied_rules": [],
            "intermediate_facts": [],
            "derivation_edges": tree.get("edges", []),
        }
        
        for node in tree.get("supporting_nodes", []):
            node_type = node.get("type", "")
            entry = {
                "id": node["id"],
                "label": node["label"],
                "dsl_source": node.get("dsl_source"),
                "depth": node["depth"],
            }
            
            if node_type == "axiom":
                enriched["supporting_axioms"].append(entry)
            elif node_type == "deduction_rule":
                enriched["applied_rules"].append(entry)
            else:
                enriched["intermediate_facts"].append(entry)
        
        return enriched

    def find_related_concepts(
        self,
        node_id: str,
        hops: int = 2,
        node_types: list[NodeType] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Find concepts related to a given node within N hops.
        
        Useful for expanding context or finding related axioms/theorems.
        
        Args:
            node_id: Starting node ID
            hops: Number of hops to explore
            node_types: Filter by specific node types
            
        Returns:
            List of related nodes with distance info
        """
        neighbors = self._graph_store.get_neighbors(
            node_id=node_id,
            max_hops=hops,
            direction="both",
            node_types=node_types,
        )
        
        return [
            {
                "id": n["node"].id,
                "type": n["node"].type.value,
                "label": n["node"].label,
                "distance": n["distance"],
                "dsl_source": n["node"].dsl_source,
            }
            for n in neighbors
        ]


class AxiomsGraph(PropertyGraphManager):
    """
    PropertyGraphIndex for logical axioms.
    
    Stores immutable axioms with syntactical deduction shortcuts
    based on frequently observed deduction patterns.
    """
    
    def __init__(
        self,
        graph_store: Neo4jGraphStore | None = None,
        llm: Any = None,
        embed_model: Any = None,
    ) -> None:
        super().__init__(
            graph_name="axioms",
            context_type=GraphContextType.PROCEDURES,  # Axioms as part of procedures
            description="Immutable logical axioms with syntactical deduction shortcuts",
            graph_store=graph_store,
            llm=llm,
            embed_model=embed_model,
        )
    
    def _get_extractors(self, llm: Any) -> list[Any]:
        """Return axiom-specific extractors."""
        return [
            SimpleLLMPathExtractor(
                llm=llm,
                max_paths_per_chunk=10,
            ),
            ImplicitPathExtractor(),
        ]
    
    def add_axiom(
        self,
        name: str,
        expression: str,
        properties: dict[str, Any] | None = None,
    ) -> str:
        """Add an axiom to the graph."""
        entity = GraphEntity(
            subject=name,
            predicate="is_axiom",
            object=expression,
            properties=properties or {},
        )
        return self.add_entity(entity, NodeType.AXIOM)
    
    def add_deduction_shortcut(
        self,
        axiom_id: str,
        shortcut_name: str,
        result_pattern: str,
    ) -> str:
        """Add a syntactical deduction shortcut for an axiom."""
        entity = GraphEntity(
            subject=shortcut_name,
            predicate="shortcut_for",
            object=axiom_id,
            properties={"result_pattern": result_pattern},
        )
        node_id = self.add_entity(entity, NodeType.RULE)
        self.add_relation(node_id, axiom_id, EdgeType.DERIVED_FROM)
        return node_id


class DeductionRulesGraph(PropertyGraphManager):
    """
    PropertyGraphIndex for deduction rules.
    
    Stores mutable deduction rules adhering to formal logic
    (Hilbert-style deduction system).
    """
    
    def __init__(
        self,
        graph_store: Neo4jGraphStore | None = None,
        llm: Any = None,
        embed_model: Any = None,
    ) -> None:
        super().__init__(
            graph_name="deduction_rules",
            context_type=GraphContextType.PROCEDURES,
            description="Mutable Hilbert-style deduction rules",
            graph_store=graph_store,
            llm=llm,
            embed_model=embed_model,
        )
    
    def _get_extractors(self, llm: Any) -> list[Any]:
        """Return deduction rule extractors."""
        return [
            SimpleLLMPathExtractor(
                llm=llm,
                max_paths_per_chunk=10,
            ),
            ImplicitPathExtractor(),
        ]
    
    def rule_exists(self, name: str) -> bool:
        """Check if a rule with the given name already exists."""
        nodes = self._graph_store.get_nodes_by_context(self.graph_name)
        return any(n.label == name for n in nodes)
    
    def get_rule_by_name(self, name: str) -> str | None:
        """Get the ID of a rule by name, or None if not found."""
        nodes = self._graph_store.get_nodes_by_context(self.graph_name)
        for n in nodes:
            if n.label == name:
                return n.id
        return None
    
    def add_rule(
        self,
        name: str,
        premises: list[str],
        conclusion: str,
        properties: dict[str, Any] | None = None,
        skip_if_exists: bool = True,
    ) -> tuple[str, bool]:
        """
        Add a deduction rule to the graph.
        
        Args:
            name: Rule name (must be unique)
            premises: List of premise expressions
            conclusion: Conclusion expression
            properties: Additional properties
            skip_if_exists: If True, skip adding if rule already exists
            
        Returns:
            Tuple of (rule_id, was_created). was_created is False if rule already existed.
        """
        # Check if rule already exists
        existing_id = self.get_rule_by_name(name)
        if existing_id is not None:
            if skip_if_exists:
                logger.debug(f"Rule already exists, skipping: {name}")
                return existing_id, False
            else:
                # Update existing rule
                self.update_rule(existing_id, premises, conclusion)
                return existing_id, False
        
        dsl_repr = f"RULE {name}: " + " ".join(f"IF {p};" for p in premises) + f" THEN {conclusion}."
        
        entity = GraphEntity(
            subject=name,
            predicate="deduction_rule",
            object=dsl_repr,
            properties={
                "premises": premises,
                "conclusion": conclusion,
                **(properties or {}),
            },
        )
        return self.add_entity(entity, NodeType.RULE), True
    
    def update_rule(
        self,
        rule_id: str,
        premises: list[str] | None = None,
        conclusion: str | None = None,
    ) -> None:
        """Update an existing deduction rule."""
        node = self._graph_store.get_node(rule_id)
        if node is None:
            raise ValueError(f"Rule not found: {rule_id}")
        
        if premises is not None:
            node.properties["premises"] = premises
        if conclusion is not None:
            node.properties["conclusion"] = conclusion
        
        # Rebuild DSL source
        name = node.label
        p_list = node.properties.get("premises", [])
        c_str = node.properties.get("conclusion", "")
        node.dsl_source = f"RULE {name}: " + " ".join(f"IF {p};" for p in p_list) + f" THEN {c_str}."
        
        node.updated_at = datetime.utcnow()
        self._graph_store.upsert_node(node)
        
        logger.info(f"Updated deduction rule: {rule_id}")


class BusinessDomainGraph(PropertyGraphManager):
    """
    PropertyGraphIndex for business domain facts.
    
    Stores entities and properties about:
    - Microservices, endpoints, JSON schemas
    - Frontend screens, buttons, workflows
    - User app workflows and navigation
    """
    
    def __init__(
        self,
        graph_store: Neo4jGraphStore | None = None,
        llm: Any = None,
        embed_model: Any = None,
    ) -> None:
        super().__init__(
            graph_name="business_domain",
            context_type=GraphContextType.SYSTEM_ENTITIES,
            description="Facts about business entities: microservices, screens, workflows",
            graph_store=graph_store,
            llm=llm,
            embed_model=embed_model,
        )
    
    def _get_extractors(self, llm: Any) -> list[Any]:
        """Return business domain extractors."""
        return [
            SimpleLLMPathExtractor(
                llm=llm,
                max_paths_per_chunk=15,
            ),
            ImplicitPathExtractor(),
        ]
    
    def add_microservice(
        self,
        name: str,
        description: str,
        properties: dict[str, Any] | None = None,
    ) -> str:
        """Add a microservice entity."""
        entity = GraphEntity(
            subject=name,
            predicate="is_microservice",
            object=description,
            properties={"entity_type": "microservice", **(properties or {})},
        )
        return self.add_entity(entity, NodeType.ENTITY)
    
    def add_endpoint(
        self,
        microservice_id: str,
        path: str,
        method: str,
        request_schema: str | None = None,
        response_schema: str | None = None,
    ) -> str:
        """Add an endpoint to a microservice."""
        entity = GraphEntity(
            subject=f"{method} {path}",
            predicate="endpoint_of",
            object=microservice_id,
            properties={
                "entity_type": "endpoint",
                "method": method,
                "path": path,
                "request_schema": request_schema,
                "response_schema": response_schema,
            },
        )
        node_id = self.add_entity(entity, NodeType.ENTITY)
        self.add_relation(microservice_id, node_id, EdgeType.CONTAINS)
        return node_id
    
    def add_screen(
        self,
        name: str,
        description: str,
        properties: dict[str, Any] | None = None,
    ) -> str:
        """Add a screen entity."""
        entity = GraphEntity(
            subject=name,
            predicate="is_screen",
            object=description,
            properties={"entity_type": "screen", **(properties or {})},
        )
        return self.add_entity(entity, NodeType.ENTITY)
    
    def add_button(
        self,
        screen_id: str,
        name: str,
        action: str,
        position: str | None = None,
    ) -> str:
        """Add a button to a screen."""
        entity = GraphEntity(
            subject=name,
            predicate="button_on",
            object=screen_id,
            properties={
                "entity_type": "button",
                "action": action,
                "position": position,
            },
        )
        node_id = self.add_entity(entity, NodeType.ENTITY)
        self.add_relation(screen_id, node_id, EdgeType.CONTAINS)
        return node_id
    
    def add_workflow(
        self,
        name: str,
        steps: list[str],
        required_permissions: list[str] | None = None,
    ) -> str:
        """Add a user workflow."""
        entity = GraphEntity(
            subject=name,
            predicate="is_workflow",
            object=f"steps: {' -> '.join(steps)}",
            properties={
                "entity_type": "workflow",
                "steps": steps,
                "required_permissions": required_permissions or [],
            },
        )
        return self.add_entity(entity, NodeType.ENTITY)
    
    def add_fact(
        self,
        subject: str,
        predicate: str,
        object_: str,
        properties: dict[str, Any] | None = None,
    ) -> str:
        """Add a generic business fact as a triple."""
        entity = GraphEntity(
            subject=subject,
            predicate=predicate,
            object=object_,
            properties=properties or {},
        )
        return self.add_entity(entity, NodeType.ENTITY)


class TheoremsGraph(PropertyGraphManager):
    """
    PropertyGraphIndex for deduced theorems (AOPs).
    
    Stores theorems deduced by applying axioms and deduction rules
    to business domain facts through the valuation function.
    """
    
    def __init__(
        self,
        graph_store: Neo4jGraphStore | None = None,
        llm: Any = None,
        embed_model: Any = None,
    ) -> None:
        super().__init__(
            graph_name="theorems",
            context_type=GraphContextType.THEOREMS,
            description="Deduced theorems (AOPs) from formal reasoning",
            graph_store=graph_store,
            llm=llm,
            embed_model=embed_model,
        )
    
    def _get_extractors(self, llm: Any) -> list[Any]:
        """Return theorem extractors."""
        return [
            SimpleLLMPathExtractor(
                llm=llm,
                max_paths_per_chunk=10,
            ),
            ImplicitPathExtractor(),
        ]
    
    def add_theorem(
        self,
        name: str,
        statement: str,
        proof_trace: list[str],
        used_axioms: list[str] | None = None,
        used_rules: list[str] | None = None,
        applies_to: list[str] | None = None,
    ) -> str:
        """Add a deduced theorem to the graph."""
        entity = GraphEntity(
            subject=name,
            predicate="is_theorem",
            object=statement,
            properties={
                "proof_trace": proof_trace,
                "used_axioms": used_axioms or [],
                "used_rules": used_rules or [],
                "applies_to": applies_to or [],
            },
        )
        node_id = self.add_entity(entity, NodeType.THEOREM)
        
        # Create relations to used axioms and rules
        for axiom_id in (used_axioms or []):
            self.add_relation(node_id, axiom_id, EdgeType.DERIVED_FROM)
        for rule_id in (used_rules or []):
            self.add_relation(node_id, rule_id, EdgeType.USES)
        
        return node_id
    
    def add_aop(
        self,
        name: str,
        procedure_dsl: str,
        proof_trace: list[str],
        used_axioms: list[str] | None = None,
        used_rules: list[str] | None = None,
        domain_facts_used: list[str] | None = None,
    ) -> str:
        """Add a deduced AOP (Abstract Operational Procedure)."""
        entity = GraphEntity(
            subject=name,
            predicate="is_aop",
            object=procedure_dsl,
            properties={
                "proof_trace": proof_trace,
                "used_axioms": used_axioms or [],
                "used_rules": used_rules or [],
                "domain_facts_used": domain_facts_used or [],
            },
        )
        node_id = self.add_entity(entity, NodeType.PROCEDURE)
        
        # Create relations
        for axiom_id in (used_axioms or []):
            self.add_relation(node_id, axiom_id, EdgeType.DERIVED_FROM)
        for rule_id in (used_rules or []):
            self.add_relation(node_id, rule_id, EdgeType.USES)
        for fact_id in (domain_facts_used or []):
            self.add_relation(node_id, fact_id, EdgeType.RELATED_TO)
        
        return node_id
