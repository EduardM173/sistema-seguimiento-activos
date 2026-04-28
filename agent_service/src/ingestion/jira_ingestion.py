"""
Workflow D — Jira Ticket History Ingestion
==========================================
Fetches resolved Jira tickets, infers which bugs have been fixed,
updates the knowledge graph accordingly, and indexes the fix
descriptions as DSL theorems / procedure updates.
"""
from __future__ import annotations

import logging
from typing import Any

from ..dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from ..knowledge_graph import Neo4jGraphStore, MetaGraph, GraphContextType, NodeType, EdgeType
from ..knowledge_graph.schemas import GraphNode
from ..pipeline.knowledge_registrar import KnowledgeRegistrar, RegistrationRequest

logger = logging.getLogger(__name__)


class JiraIngestionWorkflow:
    """
    Ingests Jira ticket history to keep the knowledge graph up-to-date
    with known bugs and their fixes.

    Jira credentials are read from :class:`~src.config.Settings`.
    """

    def __init__(
        self,
        store: Neo4jGraphStore,
        meta_graph: MetaGraph,
        dsl_translator: DSLTranslator,
        pipeline: Any,
        context_name: str = "jira",
        registrar: KnowledgeRegistrar | None = None,
    ) -> None:
        self._store = store
        self._meta_graph = meta_graph
        self._translator = dsl_translator
        self._pipeline = pipeline
        self._context_name = context_name
        self._registrar = registrar
        self._dsl_parser = DSLParser()
        self._dsl_evaluator = DSLEvaluator()

        self._meta_graph.ensure_context(
            context_name,
            GraphContextType.JIRA,
            "Bug / feature fix history from Jira",
        )

    def _get_registrar(self) -> KnowledgeRegistrar:
        if self._registrar is not None:
            return self._registrar
        from ..api.dependencies import get_knowledge_registrar
        return get_knowledge_registrar()

    async def ingest_project(
        self,
        project_key: str,
        max_results: int = 100,
    ) -> dict[str, Any]:
        """
        Fetch resolved issues from a Jira project and ingest them.

        Requires ``JIRA_URL``, ``JIRA_USER``, and ``JIRA_TOKEN`` env vars.
        """
        from ..config import settings

        if not all([settings.jira_url, settings.jira_user, settings.jira_token]):
            raise RuntimeError(
                "Jira credentials not configured. "
                "Set JIRA_URL, JIRA_USER, and JIRA_TOKEN in your .env file."
            )

        issues = self._fetch_jira_issues(
            jira_url=settings.jira_url,
            jira_user=settings.jira_user,
            jira_token=settings.jira_token,
            project_key=project_key,
            max_results=max_results,
        )

        return await self._ingest_issues(issues)

    async def ingest_issues(self, issues: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Ingest a pre-fetched list of issue dicts (unit-test friendly).

        Each issue dict should have at minimum:
          ``id``, ``key``, ``summary``, ``status``, ``resolution``, ``description``
        """
        return await self._ingest_issues(issues)

    # ── Internal ──────────────────────────────────────────────────────────────

    @staticmethod
    def _fetch_jira_issues(
        jira_url: str,
        jira_user: str,
        jira_token: str,
        project_key: str,
        max_results: int,
    ) -> list[dict[str, Any]]:
        try:
            from jira import JIRA  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError("jira package not installed. Run: pip install jira") from exc

        client = JIRA(server=jira_url, basic_auth=(jira_user, jira_token))
        jql = f"project = {project_key} AND resolution = Done ORDER BY updated DESC"
        raw_issues = client.search_issues(jql, maxResults=max_results, fields="summary,description,status,resolution,comment")

        issues: list[dict[str, Any]] = []
        for issue in raw_issues:
            fields = issue.fields
            description = getattr(fields, "description", "") or ""
            comments = []
            if hasattr(fields, "comment") and fields.comment:
                comments = [c.body for c in fields.comment.comments]

            issues.append({
                "id": issue.id,
                "key": issue.key,
                "summary": fields.summary,
                "status": str(fields.status),
                "resolution": str(fields.resolution) if fields.resolution else "",
                "description": description,
                "comments": comments,
            })

        logger.info("Fetched %d resolved issues from Jira project %s", len(issues), project_key)
        return issues

    async def _ingest_issues(self, issues: list[dict[str, Any]]) -> dict[str, Any]:
        results: dict[str, Any] = {"ingested": 0, "dsl_nodes": 0, "vector_nodes": 0, "errors": []}

        for issue in issues:
            try:
                await self._ingest_single_issue(issue, results)
            except Exception as exc:
                logger.error("Failed to ingest Jira issue %s: %s", issue.get("key"), exc)
                results["errors"].append(f"{issue.get('key')}: {exc}")

        return results

    async def _ingest_single_issue(self, issue: dict[str, Any], results: dict) -> None:
        summary = issue.get("summary", "")
        description = issue.get("description", "") or ""
        comments = "\n".join(issue.get("comments", []))
        full_text = f"Issue: {summary}\n\n{description}\n\nComments:\n{comments}"

        # Translate to DSL theorem
        dsl_source = await self._translator.from_natural_language(
            full_text,
            context_hint=f"Jira bug fix: {summary}. Resolution: {issue.get('resolution', 'Done')}",
        )

        # Register ticket node via the unified registrar
        registrar = self._get_registrar()
        ticket_reg = registrar.register(RegistrationRequest(
            dsl_source=dsl_source,
            node_type=NodeType.JIRA_TICKET,
            context=self._context_name,
            label=issue.get("key", ""),
            source=f"jira:{issue.get('key', '')}",
            origin="document",
            description=summary,
            extra_properties={
                "summary": summary,
                "status": issue.get("status", ""),
                "resolution": issue.get("resolution", ""),
                "jira_id": issue.get("id", ""),
            },
        ))
        if ticket_reg.success:
            results["ingested"] += 1

        # Try to parse and store DSL nodes derived from the fix description
        try:
            ast_nodes = self._dsl_parser.parse(dsl_source)
            ctx = EvaluationContext()
            self._dsl_evaluator.evaluate(ast_nodes, ctx)

            for name, axiom_expr in ctx.axioms.items():
                dsl_text = self._translator.to_dsl(axiom_expr)
                theorem_reg = registrar.register(RegistrationRequest(
                    dsl_source=dsl_text,
                    node_type=NodeType.THEOREM,
                    context=self._context_name,
                    label=f"{issue.get('key')}_{name}",
                    source=f"jira:{issue.get('key', '')}",
                    origin="document",
                    depends_on_facts=[ticket_reg.node_id] if ticket_reg.success else [],
                ))
                if theorem_reg.success:
                    # Also add a semantic RESOLVES edge from ticket → theorem
                    edge = Neo4jGraphStore.new_edge(
                        ticket_reg.node_id, theorem_reg.node_id, EdgeType.RESOLVES
                    )
                    self._store.upsert_edge(edge)
                    results["dsl_nodes"] += 1

        except Exception as exc:
            logger.warning("DSL parse failed for Jira issue %s: %s", issue.get("key"), exc)

        # Index in vector store
        vector_count = self._pipeline.ingest_text(
            full_text,
            metadata={
                "context": self._context_name,
                "type": "jira_ticket",
                "jira_key": issue.get("key", ""),
                "resolution": issue.get("resolution", ""),
            },
        )
        results["vector_nodes"] += vector_count
