"""
Dual Retriever for Deduction Context
=====================================
Combines VectorContextRetriever (semantic similarity) with a
Text-to-Cypher retriever (graph dependency traversal) so the
reasoning agent gets both relevant embeddings AND structural
graph dependencies during deduction.
"""
from __future__ import annotations

import logging
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)


class DualRetriever:
    """
    Merges vector similarity results with Cypher-based graph traversal.

    Usage during deduction:
      1. Vector retriever fetches semantically close DSL statements.
      2. Text-to-Cypher retriever finds structural dependencies
         (DERIVED_FROM, USES, IMPLEMENTS, etc.) for those results.
      3. Results are de-duplicated, scored, and returned in rank order.
    """

    def __init__(
        self,
        property_graph_index: Any,
        neo4j_driver: Any,
        llm: Any,
        embed_model: Any | None = None,
        vector_top_k: int = 10,
        cypher_expansion_hops: int = 2,
    ) -> None:
        self._index = property_graph_index
        self._driver = neo4j_driver
        self._llm = llm
        self._embed_model = embed_model
        self._vector_top_k = vector_top_k
        self._cypher_hops = cypher_expansion_hops

    # ── Public API ────────────────────────────────────────────────────────

    async def aretrieve(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[dict[str, Any]]:
        """
        Retrieve context using both vector search and Cypher traversal.

        Returns a merged, deduplicated list of result dicts:
          { id, text, score, metadata, source: "vector"|"cypher"|"both" }
        """
        k = top_k or self._vector_top_k

        # 1. Vector similarity search
        vector_results = await self._vector_retrieve(query, k)

        # 2. Cypher structural expansion from vector hits
        seed_ids = [r["id"] for r in vector_results if r.get("id")]
        cypher_results = self._cypher_expand(seed_ids, query)

        # 3. Merge and deduplicate
        return self._merge(vector_results, cypher_results)

    def retrieve(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[dict[str, Any]]:
        """Sync variant of aretrieve."""
        k = top_k or self._vector_top_k
        vector_results = self._vector_retrieve_sync(query, k)
        seed_ids = [r["id"] for r in vector_results if r.get("id")]
        cypher_results = self._cypher_expand(seed_ids, query)
        return self._merge(vector_results, cypher_results)

    # ── Vector retrieval ──────────────────────────────────────────────────

    async def _vector_retrieve(self, query: str, top_k: int) -> list[dict[str, Any]]:
        try:
            retriever = self._index.as_retriever(
                similarity_top_k=top_k,
                include_text=True,
            )
            results = await retriever.aretrieve(query)
            return [
                {
                    "id": r.node_id,
                    "text": r.get_content(),
                    "score": r.get_score() or 0.0,
                    "metadata": r.metadata or {},
                    "source": "vector",
                }
                for r in results
            ]
        except Exception as exc:
            logger.warning("Vector retrieval failed: %s", exc)
            return []

    def _vector_retrieve_sync(self, query: str, top_k: int) -> list[dict[str, Any]]:
        try:
            retriever = self._index.as_retriever(
                similarity_top_k=top_k,
                include_text=True,
            )
            results = retriever.retrieve(query)
            return [
                {
                    "id": r.node_id,
                    "text": r.get_content(),
                    "score": r.get_score() or 0.0,
                    "metadata": r.metadata or {},
                    "source": "vector",
                }
                for r in results
            ]
        except Exception as exc:
            logger.warning("Vector retrieval (sync) failed: %s", exc)
            return []

    # ── Cypher-based retrieval ────────────────────────────────────────────

    def _cypher_expand(
        self,
        seed_ids: list[str],
        query: str,
    ) -> list[dict[str, Any]]:
        """
        Expand seed nodes via Cypher to find structural dependencies.

        Traverses DERIVED_FROM, USES, IMPLEMENTS, RELATED_TO, CONTAINS
        relationships up to `cypher_hops` hops.
        """
        if not seed_ids or self._driver is None:
            return []

        results: list[dict[str, Any]] = []
        try:
            with self._driver.session() as session:
                # Multi-hop dependency expansion with parameterized query
                cypher = """
                UNWIND $seed_ids AS seedId
                MATCH (start)
                WHERE start.id = seedId OR elementId(start) = seedId
                CALL apoc.path.expandConfig(start, {
                    maxLevel: $max_hops,
                    relationshipFilter: "DERIVED_FROM|USES|IMPLEMENTS|RELATED_TO|CONTAINS|PART_OF",
                    uniqueness: "NODE_GLOBAL"
                })
                YIELD path
                WITH last(nodes(path)) AS neighbor, length(path) AS distance
                WHERE neighbor <> start
                RETURN DISTINCT
                    neighbor.id AS id,
                    neighbor.label AS label,
                    neighbor.dsl_source AS dsl_source,
                    neighbor.type AS type,
                    labels(neighbor) AS labels,
                    distance
                ORDER BY distance ASC
                LIMIT 20
                """
                try:
                    records = session.run(
                        cypher,
                        seed_ids=seed_ids,
                        max_hops=self._cypher_hops,
                    )
                    for rec in records:
                        text = rec["dsl_source"] or rec["label"] or ""
                        if text:
                            # Score decreases with distance
                            score = max(0.0, 1.0 - (rec["distance"] * 0.2))
                            results.append({
                                "id": rec["id"] or "",
                                "text": text,
                                "score": score,
                                "metadata": {
                                    "type": rec["type"] or "",
                                    "label": rec["label"] or "",
                                    "graph_distance": rec["distance"],
                                    "neo4j_labels": rec["labels"],
                                },
                                "source": "cypher",
                            })
                except Exception:
                    # APOC may not be installed; fall back to simple expansion
                    results = self._cypher_expand_simple(session, seed_ids)
        except Exception as exc:
            logger.warning("Cypher expansion failed: %s", exc)

        return results

    def _cypher_expand_simple(
        self,
        session: Any,
        seed_ids: list[str],
    ) -> list[dict[str, Any]]:
        """Fallback expansion without APOC — plain variable-length match."""
        results: list[dict[str, Any]] = []
        cypher = """
        UNWIND $seed_ids AS seedId
        MATCH (start)-[r*1..3]-(neighbor)
        WHERE (start.id = seedId OR elementId(start) = seedId)
          AND neighbor <> start
        WITH DISTINCT neighbor, min(length(r)) AS distance
        RETURN
            neighbor.id AS id,
            neighbor.label AS label,
            neighbor.dsl_source AS dsl_source,
            neighbor.type AS type,
            distance
        ORDER BY distance ASC
        LIMIT 20
        """
        try:
            records = session.run(cypher, seed_ids=seed_ids)
            for rec in records:
                text = rec["dsl_source"] or rec["label"] or ""
                if text:
                    score = max(0.0, 1.0 - (rec["distance"] * 0.2))
                    results.append({
                        "id": rec["id"] or "",
                        "text": text,
                        "score": score,
                        "metadata": {
                            "type": rec["type"] or "",
                            "label": rec["label"] or "",
                            "graph_distance": rec["distance"],
                        },
                        "source": "cypher",
                    })
        except Exception as exc:
            logger.warning("Simple Cypher expansion failed: %s", exc)
        return results

    # ── Natural language to Cypher ────────────────────────────────────────

    async def _nl_to_cypher(self, query: str) -> list[dict[str, Any]]:
        """
        Translate natural language to Cypher and execute.
        Used when the query implies specific graph patterns.
        """
        prompt = f"""Convert this question into a Neo4j Cypher query.
The graph contains nodes with labels: GraphNode, Axiom, Rule, Fact, Theorem, Procedure, Entity.
Node properties: id, label, type, dsl_source, context, created_at.
Edge types: DERIVED_FROM, USES, IMPLEMENTS, RELATED_TO, CONTAINS, PART_OF, META_LINK.

Question: {query}

Return ONLY the Cypher query. Limit results to 15. Include RETURN with id, label, dsl_source, type.
"""
        try:
            response = await self._llm.acomplete(prompt)
            cypher = str(response.text).strip()
            # Basic safety: only allow read queries
            upper = cypher.upper()
            if any(kw in upper for kw in ("DELETE", "CREATE", "MERGE", "SET ", "REMOVE", "DROP")):
                logger.warning("LLM generated write Cypher — rejected")
                return []

            with self._driver.session() as session:
                records = session.run(cypher)
                results = []
                for rec in records:
                    data = dict(rec)
                    text = data.get("dsl_source") or data.get("label") or str(data)
                    results.append({
                        "id": data.get("id", ""),
                        "text": text,
                        "score": 0.8,
                        "metadata": {k: v for k, v in data.items() if k != "dsl_source"},
                        "source": "cypher_nl",
                    })
                return results
        except Exception as exc:
            logger.warning("NL-to-Cypher retrieval failed: %s", exc)
            return []

    # ── Merge ─────────────────────────────────────────────────────────────

    @staticmethod
    def _merge(
        vector_results: list[dict[str, Any]],
        cypher_results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Deduplicate and merge two result lists, keeping higher score."""
        seen: dict[str, dict[str, Any]] = {}

        for r in vector_results:
            key = r.get("id") or r.get("text", "")
            if key in seen:
                if r["score"] > seen[key]["score"]:
                    seen[key] = r
                seen[key]["source"] = "both"
            else:
                seen[key] = r

        for r in cypher_results:
            key = r.get("id") or r.get("text", "")
            if key in seen:
                # Boost score when found by both methods
                seen[key]["score"] = min(1.0, seen[key]["score"] + 0.1)
                seen[key]["source"] = "both"
            else:
                seen[key] = r

        merged = sorted(seen.values(), key=lambda x: x["score"], reverse=True)
        return merged
