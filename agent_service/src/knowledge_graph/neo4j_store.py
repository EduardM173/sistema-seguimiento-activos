"""
Neo4j-backed Graph Store
========================
Provides graph storage and querying via Neo4j.
This is the single source of truth for all graph data.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from neo4j import GraphDatabase, Driver

from ..config import settings
from .schemas import GraphNode, GraphEdge, GraphContext, NodeType, EdgeType, GraphContextType

logger = logging.getLogger(__name__)


class Neo4jGraphStore:
    """
    Graph store backed by Neo4j.
    
    All graph data (contexts, nodes, edges) is stored in Neo4j.
    This replaces PostgreSQL for graph storage.
    """

    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
    ) -> None:
        self._uri = uri or settings.neo4j_uri
        self._user = user or settings.neo4j_user
        self._password = password or settings.neo4j_password
        self._driver: Driver | None = None

    @property
    def driver(self) -> Driver:
        """Lazy-load the Neo4j driver."""
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self._uri,
                auth=(self._user, self._password),
            )
        return self._driver

    def close(self) -> None:
        """Close the driver connection."""
        if self._driver:
            self._driver.close()
            self._driver = None

    # ── Contexts ──────────────────────────────────────────────────────────────

    def upsert_context(self, ctx: GraphContext) -> GraphContext:
        """Create or update a graph context."""
        with self.driver.session() as session:
            session.run(
                """
                MERGE (c:GraphContext {name: $name})
                SET c.type = $type,
                    c.description = $description,
                    c.parent_context = $parent_context,
                    c.created_at = $created_at
                """,
                name=ctx.name,
                type=ctx.type.value,
                description=ctx.description,
                parent_context=ctx.parent_context,
                created_at=ctx.created_at.isoformat(),
            )
        logger.info(f"Upserted context: {ctx.name}")
        return ctx

    def get_context(self, name: str) -> GraphContext | None:
        """Get a context by name."""
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (c:GraphContext {name: $name})
                RETURN c.name, c.type, c.description, c.parent_context, c.created_at
                """,
                name=name,
            )
            record = result.single()
            if record is None:
                return None
            return GraphContext(
                name=record[0],
                type=GraphContextType(record[1]),
                description=record[2] or "",
                parent_context=record[3],
                created_at=datetime.fromisoformat(record[4]) if record[4] else datetime.utcnow(),
            )

    def list_contexts(self) -> list[GraphContext]:
        """List all graph contexts."""
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (c:GraphContext)
                RETURN c.name, c.type, c.description, c.parent_context, c.created_at
                ORDER BY c.name
                """
            )
            contexts = []
            for record in result:
                contexts.append(GraphContext(
                    name=record[0],
                    type=GraphContextType(record[1]) if record[1] else GraphContextType.CUSTOM,
                    description=record[2] or "",
                    parent_context=record[3],
                    created_at=datetime.fromisoformat(record[4]) if record[4] else datetime.utcnow(),
                ))
            return contexts

    # ── Nodes ─────────────────────────────────────────────────────────────────

    # Map NodeType → additional Neo4j label
    _TYPE_LABELS = {
        "axiom": "Axiom",
        "rule": "Rule",
        "theorem": "Theorem",
        "procedure": "Procedure",
        "entity": "Entity",
        "fact": "Fact",
        "document": "Document",
        "conversation": "Conversation",
        "jira_ticket": "JiraTicket",
        "context": "Context",
    }

    def upsert_node(self, node: GraphNode) -> GraphNode:
        """Create or update a graph node with proper type labels and properties."""
        import json

        # Determine the type-specific Neo4j label
        type_label = self._TYPE_LABELS.get(node.type.value, "KnowledgeItem")

        # Flatten key properties as first-class Neo4j fields.
        # Everything else goes into a `_raw_properties` JSON field for
        # lossless round-trip.
        props = node.properties or {}
        flat = {
            "id": node.id,
            "type": node.type.value,
            "context": node.context,
            "label": node.label,
            "dsl_source": node.dsl_source,
            "created_at": node.created_at.isoformat(),
            "updated_at": node.updated_at.isoformat(),
            # Promote common metadata
            "source": props.get("source", ""),
            "origin": props.get("origin", ""),
            "confidence": props.get("confidence", 1.0),
            "description": props.get("description", ""),
            "status": props.get("status", "active"),
        }
        # Optional fields
        if props.get("session_id"):
            flat["session_id"] = props["session_id"]
        if props.get("z3_validated") is not None:
            flat["z3_validated"] = bool(props["z3_validated"])
        if props.get("predicates"):
            flat["predicates"] = props["predicates"]
        if props.get("entities"):
            flat["entities"] = props["entities"]

        # Keep the full JSON for anything not flattened
        flat["_raw_properties"] = json.dumps(props)

        with self.driver.session() as session:
            # MERGE on :GraphNode, then ADD the type-specific label
            session.run(
                f"""
                MERGE (n:GraphNode {{id: $id}})
                SET n:{type_label},
                    n += $props
                """,
                id=node.id,
                props=flat,
            )
        return node

    @staticmethod
    def _parse_properties(raw_props: str | None, legacy_props: str | None = None) -> dict:
        """Parse properties from _raw_properties (preferred) or legacy properties field."""
        import json
        for val in (raw_props, legacy_props):
            if val:
                try:
                    return json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    continue
        return {}

    def get_node(self, node_id: str) -> GraphNode | None:
        """Get a node by ID."""
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (n:GraphNode {id: $id})
                RETURN n.id, n.type, n.context, n.label,
                       n._raw_properties, n.properties,
                       n.dsl_source, n.created_at, n.updated_at
                """,
                id=node_id,
            )
            record = result.single()
            if record is None:
                return None
            return GraphNode(
                id=record[0],
                type=NodeType(record[1]),
                context=record[2],
                label=record[3] or "",
                properties=self._parse_properties(record[4], record[5]),
                dsl_source=record[6],
                created_at=datetime.fromisoformat(record[7]) if record[7] else datetime.utcnow(),
                updated_at=datetime.fromisoformat(record[8]) if record[8] else datetime.utcnow(),
            )

    def get_nodes_by_context(self, context: str) -> list[GraphNode]:
        """Get all nodes in a context."""
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (n:GraphNode {context: $context})
                RETURN n.id, n.type, n.context, n.label,
                       n._raw_properties, n.properties,
                       n.dsl_source, n.created_at, n.updated_at
                ORDER BY n.created_at
                """,
                context=context,
            )
            nodes = []
            for record in result:
                nodes.append(GraphNode(
                    id=record[0],
                    type=NodeType(record[1]),
                    context=record[2],
                    label=record[3] or "",
                    properties=self._parse_properties(record[4], record[5]),
                    dsl_source=record[6],
                    created_at=datetime.fromisoformat(record[7]) if record[7] else datetime.utcnow(),
                    updated_at=datetime.fromisoformat(record[8]) if record[8] else datetime.utcnow(),
                ))
            return nodes

    def delete_node(self, node_id: str) -> None:
        """Delete a node and its relationships."""
        with self.driver.session() as session:
            session.run(
                """
                MATCH (n:GraphNode {id: $id})
                DETACH DELETE n
                """,
                id=node_id,
            )

    # ── Edges ─────────────────────────────────────────────────────────────────

    def upsert_edge(self, edge: GraphEdge) -> GraphEdge:
        """Create or update an edge between nodes."""
        import json
        with self.driver.session() as session:
            session.run(
                """
                MATCH (src:GraphNode {id: $source_id})
                MATCH (tgt:GraphNode {id: $target_id})
                MERGE (src)-[r:GRAPH_EDGE {id: $id}]->(tgt)
                SET r.type = $type,
                    r.properties = $properties,
                    r.created_at = $created_at
                """,
                id=edge.id,
                source_id=edge.source_id,
                target_id=edge.target_id,
                type=edge.type.value,
                properties=json.dumps(edge.properties),
                created_at=edge.created_at.isoformat(),
            )
        return edge

    def get_edges_by_source(self, source_id: str) -> list[GraphEdge]:
        """Get all edges from a source node."""
        import json
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (src:GraphNode {id: $source_id})-[r:GRAPH_EDGE]->(tgt)
                RETURN r.id, src.id, tgt.id, r.type, r.properties, r.created_at
                """,
                source_id=source_id,
            )
            edges = []
            for record in result:
                edges.append(GraphEdge(
                    id=record[0],
                    source_id=record[1],
                    target_id=record[2],
                    type=EdgeType(record[3]),
                    properties=json.loads(record[4]) if record[4] else {},
                    created_at=datetime.fromisoformat(record[5]) if record[5] else datetime.utcnow(),
                ))
            return edges

    def get_edges_by_target(self, target_id: str) -> list[GraphEdge]:
        """Get all edges to a target node."""
        import json
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (src)-[r:GRAPH_EDGE]->(tgt:GraphNode {id: $target_id})
                RETURN r.id, src.id, tgt.id, r.type, r.properties, r.created_at
                """,
                target_id=target_id,
            )
            edges = []
            for record in result:
                edges.append(GraphEdge(
                    id=record[0],
                    source_id=record[1],
                    target_id=record[2],
                    type=EdgeType(record[3]),
                    properties=json.loads(record[4]) if record[4] else {},
                    created_at=datetime.fromisoformat(record[5]) if record[5] else datetime.utcnow(),
                ))
            return edges

    def get_edges_by_context(self, context: str) -> list[GraphEdge]:
        """Get all edges where source node is in the given context."""
        import json
        with self.driver.session() as session:
            result = session.run(
                """
                MATCH (src:GraphNode {context: $context})-[r:GRAPH_EDGE]->(tgt)
                RETURN r.id, src.id, tgt.id, r.type, r.properties, r.created_at
                """,
                context=context,
            )
            edges = []
            for record in result:
                edges.append(GraphEdge(
                    id=record[0],
                    source_id=record[1],
                    target_id=record[2],
                    type=EdgeType(record[3]),
                    properties=json.loads(record[4]) if record[4] else {},
                    created_at=datetime.fromisoformat(record[5]) if record[5] else datetime.utcnow(),
                ))
            return edges

    # ── Static helpers ────────────────────────────────────────────────────────

    @staticmethod
    def new_node(
        node_type: NodeType,
        label: str,
        context: str = "default",
        properties: dict[str, Any] | None = None,
        dsl_source: str | None = None,
    ) -> GraphNode:
        """Factory for creating new GraphNode instances."""
        now = datetime.utcnow()
        return GraphNode(
            id=str(uuid.uuid4()),
            type=node_type,
            context=context,
            label=label,
            properties=properties or {},
            dsl_source=dsl_source,
            created_at=now,
            updated_at=now,
        )

    @staticmethod
    def new_edge(
        source_id: str,
        target_id: str,
        edge_type: EdgeType,
        properties: dict[str, Any] | None = None,
    ) -> GraphEdge:
        """Factory for creating new GraphEdge instances."""
        return GraphEdge(
            id=str(uuid.uuid4()),
            source_id=source_id,
            target_id=target_id,
            type=edge_type,
            properties=properties or {},
            created_at=datetime.utcnow(),
        )

    # ── Multi-hop Traversal ───────────────────────────────────────────────────

    def get_neighbors(
        self,
        node_id: str,
        max_hops: int = 2,
        direction: str = "both",
        node_types: list[NodeType] | None = None,
        edge_types: list[EdgeType] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get all nodes within N hops of a starting node.
        
        Args:
            node_id: Starting node ID
            max_hops: Maximum traversal depth (1-5)
            direction: 'outgoing', 'incoming', or 'both'
            node_types: Filter by node types (optional)
            edge_types: Filter by edge types (optional)
            
        Returns:
            List of nodes with their distance and path info
        """
        import json
        max_hops = min(max(1, max_hops), 5)  # Clamp to [1, 5]
        
        # Build direction pattern
        if direction == "outgoing":
            rel_pattern = "-[r:GRAPH_EDGE*1..{}]->"
        elif direction == "incoming":
            rel_pattern = "<-[r:GRAPH_EDGE*1..{}]-"
        else:
            rel_pattern = "-[r:GRAPH_EDGE*1..{}]-"
        rel_pattern = rel_pattern.format(max_hops)
        
        # Build type filters
        where_clauses = []
        if node_types:
            type_values = [t.value for t in node_types]
            where_clauses.append("neighbor.type IN $node_types")
        if edge_types:
            edge_values = [e.value for e in edge_types]
            where_clauses.append("ALL(rel IN r WHERE rel.type IN $edge_types)")
        
        where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        query = f"""
            MATCH (start:GraphNode {{id: $node_id}}){rel_pattern}(neighbor:GraphNode)
            {where_clause}
            RETURN DISTINCT neighbor.id, neighbor.type, neighbor.label, neighbor.context,
                   neighbor.properties, neighbor.dsl_source, length(r) as distance
            ORDER BY distance, neighbor.label
        """
        
        with self.driver.session() as session:
            result = session.run(
                query,  # type: ignore[arg-type]
                node_id=node_id,
                node_types=[t.value for t in node_types] if node_types else [],
                edge_types=[e.value for e in edge_types] if edge_types else [],
            )
            neighbors = []
            for record in result:
                neighbors.append({
                    "node": GraphNode(
                        id=record[0],
                        type=NodeType(record[1]),
                        label=record[2] or "",
                        context=record[3] or "default",
                        properties=json.loads(record[4]) if record[4] else {},
                        dsl_source=record[5],
                    ),
                    "distance": record[6],
                })
            return neighbors

    def find_paths(
        self,
        source_id: str,
        target_id: str,
        max_hops: int = 4,
        edge_types: list[EdgeType] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Find all paths between two nodes up to max_hops.
        
        Args:
            source_id: Starting node ID
            target_id: Ending node ID
            max_hops: Maximum path length
            edge_types: Filter by relationship types (optional)
            
        Returns:
            List of paths with nodes and relationships
        """
        import json
        max_hops = min(max(1, max_hops), 6)
        
        # Use APOC for efficient path finding if available, fallback to native
        query = """
            MATCH path = shortestPath(
                (start:GraphNode {id: $source_id})-[r:GRAPH_EDGE*1..%d]-(end:GraphNode {id: $target_id})
            )
            RETURN [n IN nodes(path) | {
                id: n.id, type: n.type, label: n.label, context: n.context
            }] as nodes,
            [rel IN relationships(path) | {
                type: rel.type, source: startNode(rel).id, target: endNode(rel).id
            }] as edges,
            length(path) as length
            ORDER BY length
            LIMIT 10
        """ % max_hops
        
        with self.driver.session() as session:
            result = session.run(
                query,  # type: ignore[arg-type]
                source_id=source_id,
                target_id=target_id,
            )
            paths = []
            for record in result:
                paths.append({
                    "nodes": record[0],
                    "edges": record[1],
                    "length": record[2],
                })
            return paths

    def find_all_paths(
        self,
        source_id: str,
        target_id: str,
        max_hops: int = 4,
    ) -> list[dict[str, Any]]:
        """
        Find ALL paths (not just shortest) between two nodes using APOC.
        
        Args:
            source_id: Starting node ID
            target_id: Ending node ID
            max_hops: Maximum path length
            
        Returns:
            List of all paths with nodes and relationships
        """
        max_hops = min(max(1, max_hops), 5)
        
        query = """
            MATCH (start:GraphNode {id: $source_id}), (end:GraphNode {id: $target_id})
            CALL apoc.path.expandConfig(start, {
                endNodes: [end],
                minLevel: 1,
                maxLevel: $max_hops,
                uniqueness: 'NODE_PATH'
            })
            YIELD path
            RETURN [n IN nodes(path) | {
                id: n.id, type: n.type, label: n.label, context: n.context
            }] as nodes,
            [rel IN relationships(path) | {
                type: rel.type, source: startNode(rel).id, target: endNode(rel).id
            }] as edges,
            length(path) as length
            ORDER BY length
            LIMIT 20
        """
        
        with self.driver.session() as session:
            try:
                result = session.run(
                    query,
                    source_id=source_id,
                    target_id=target_id,
                    max_hops=max_hops,
                )
                paths = []
                for record in result:
                    paths.append({
                        "nodes": record[0],
                        "edges": record[1],
                        "length": record[2],
                    })
                return paths
            except Exception as e:
                logger.warning(f"APOC path expansion failed, falling back: {e}")
                return self.find_paths(source_id, target_id, max_hops)

    # ── Reasoning Chain Traversal ─────────────────────────────────────────────

    def get_reasoning_chain(
        self,
        node_id: str,
        direction: str = "forward",
        max_depth: int = 5,
    ) -> dict[str, Any]:
        """
        Follow reasoning chains: axiom → deduction_rule → theorem.
        
        Args:
            node_id: Starting node (axiom, rule, or theorem)
            direction: 'forward' (axiom→theorem) or 'backward' (theorem→axiom)
            max_depth: Maximum chain length
            
        Returns:
            Reasoning chain with nodes grouped by type and connections
        """
        import json
        max_depth = min(max(1, max_depth), 10)
        
        # Define the reasoning relationship types
        reasoning_edges = [
            EdgeType.DERIVED_FROM.value,
            EdgeType.USES.value,
            EdgeType.RELATED_TO.value,
            EdgeType.IMPLEMENTS.value,
        ]
        
        if direction == "forward":
            rel_pattern = "-[r:GRAPH_EDGE*1..{}]->"
        else:
            rel_pattern = "<-[r:GRAPH_EDGE*1..{}]-"
        rel_pattern = rel_pattern.format(max_depth)
        
        query = f"""
            MATCH (start:GraphNode {{id: $node_id}}){rel_pattern}(n:GraphNode)
            WHERE ALL(rel IN r WHERE rel.type IN $edge_types)
            WITH n, length(r) as depth
            RETURN n.id, n.type, n.label, n.context, n.properties, n.dsl_source, depth
            ORDER BY depth, n.type
        """
        
        with self.driver.session() as session:
            result = session.run(
                query,  # type: ignore[arg-type]
                node_id=node_id,
                edge_types=reasoning_edges,
            )
            
            chain = {
                "start_node": node_id,
                "direction": direction,
                "axioms": [],
                "deduction_rules": [],
                "theorems": [],
                "entities": [],
                "other": [],
            }
            
            for record in result:
                node_data = {
                    "id": record[0],
                    "type": record[1],
                    "label": record[2] or "",
                    "context": record[3] or "default",
                    "properties": json.loads(record[4]) if record[4] else {},
                    "dsl_source": record[5],
                    "depth": record[6],
                }
                
                # Categorize by node type
                node_type = record[1]
                if node_type == NodeType.AXIOM.value:
                    chain["axioms"].append(node_data)
                elif node_type == NodeType.RULE.value:
                    chain["deduction_rules"].append(node_data)
                elif node_type == NodeType.THEOREM.value:
                    chain["theorems"].append(node_data)
                elif node_type == NodeType.ENTITY.value:
                    chain["entities"].append(node_data)
                else:
                    chain["other"].append(node_data)
            
            return chain

    def get_derivation_tree(self, theorem_id: str) -> dict[str, Any]:
        """
        Get the full derivation tree for a theorem (backward reasoning).
        Shows what axioms and rules were used to derive it.
        
        Args:
            theorem_id: ID of the theorem node
            
        Returns:
            Tree structure with all supporting nodes and edges
        """
        import json
        
        query = """
            MATCH path = (theorem:GraphNode {id: $theorem_id})<-[:GRAPH_EDGE*1..6]-(support:GraphNode)
            WHERE support.type IN ['axiom', 'deduction_rule', 'entity']
            WITH support, relationships(path) as rels, length(path) as depth
            RETURN DISTINCT support.id, support.type, support.label, support.context,
                   support.dsl_source, depth,
                   [r IN rels | {type: r.type, from: startNode(r).id, to: endNode(r).id}] as edges
            ORDER BY depth
        """
        
        with self.driver.session() as session:
            result = session.run(query, theorem_id=theorem_id)
            
            tree = {
                "theorem_id": theorem_id,
                "supporting_nodes": [],
                "edges": [],
            }
            seen_edges = set()
            
            for record in result:
                tree["supporting_nodes"].append({
                    "id": record[0],
                    "type": record[1],
                    "label": record[2] or "",
                    "context": record[3] or "default",
                    "dsl_source": record[4],
                    "depth": record[5],
                })
                
                for edge in record[6]:
                    edge_key = (edge["from"], edge["to"], edge["type"])
                    if edge_key not in seen_edges:
                        tree["edges"].append(edge)
                        seen_edges.add(edge_key)
            
            return tree

    def expand_from_nodes(
        self,
        node_ids: list[str],
        hops: int = 2,
        include_types: list[NodeType] | None = None,
    ) -> dict[str, Any]:
        """
        Expand subgraph from multiple starting nodes.
        Useful for context-aware retrieval.
        
        Args:
            node_ids: List of starting node IDs
            hops: Number of hops to expand
            include_types: Filter result nodes by type
            
        Returns:
            Subgraph with all reachable nodes and edges
        """
        import json
        hops = min(max(1, hops), 4)
        
        type_filter = ""
        if include_types:
            type_values = [t.value for t in include_types]
            type_filter = "AND n.type IN $type_values"
        
        query = f"""
            UNWIND $node_ids as startId
            MATCH (start:GraphNode {{id: startId}})-[r:GRAPH_EDGE*1..{hops}]-(n:GraphNode)
            {type_filter}
            WITH DISTINCT n
            OPTIONAL MATCH (n)-[e:GRAPH_EDGE]-(connected:GraphNode)
            WHERE connected.id IN $node_ids OR connected IN collect(n)
            RETURN n.id, n.type, n.label, n.context, n.properties, n.dsl_source,
                   collect(DISTINCT {{
                       source: startNode(e).id,
                       target: endNode(e).id,
                       type: e.type
                   }}) as local_edges
        """
        
        with self.driver.session() as session:
            result = session.run(
                query,  # type: ignore[arg-type]
                node_ids=node_ids,
                type_values=[t.value for t in include_types] if include_types else [],
            )
            
            subgraph = {
                "nodes": [],
                "edges": [],
            }
            seen_edges = set()
            
            for record in result:
                subgraph["nodes"].append({
                    "id": record[0],
                    "type": record[1],
                    "label": record[2] or "",
                    "context": record[3] or "default",
                    "properties": json.loads(record[4]) if record[4] else {},
                    "dsl_source": record[5],
                })
                
                for edge in record[6]:
                    if edge["source"] and edge["target"]:
                        edge_key = (edge["source"], edge["target"], edge["type"])
                        if edge_key not in seen_edges:
                            subgraph["edges"].append(edge)
                            seen_edges.add(edge_key)
            
            return subgraph
