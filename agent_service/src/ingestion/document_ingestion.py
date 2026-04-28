"""
Workflow A — Application Documentation Ingestion
=================================================
Supports: PDF, images (PNG/JPG), XLS/XLSX, DOCX, plain text, BPMN diagrams.

Steps:
  1. Load documents (multimodal where applicable)
  2. For images/diagrams → DSL translation via Gemini vision
  3. Extract entity relations → DSL axioms
  4. Index chunks in PGVector
  5. Persist DSL nodes in the knowledge graph
"""
from __future__ import annotations

import logging
import mimetypes
import uuid
from pathlib import Path
from typing import Any

from ..dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from ..knowledge_graph import Neo4jGraphStore, MetaGraph, GraphContextType, NodeType, EdgeType
from ..knowledge_graph.schemas import GraphContext
from ..pipeline.knowledge_registrar import KnowledgeRegistrar, RegistrationRequest

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff",
    ".xls", ".xlsx", ".csv",
    ".docx", ".doc",
    ".txt", ".md", ".rst",
    ".json", ".yaml", ".yml",
}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"}


class DocumentIngestionWorkflow:
    """
    Ingests application documentation (flow diagrams, BPMN, component charts,
    PDFs, spreadsheets) into the RAG pipeline and knowledge graph.
    """

    def __init__(
        self,
        store: Neo4jGraphStore,
        meta_graph: MetaGraph,
        dsl_translator: DSLTranslator,
        pipeline: Any,   # RAGPipeline — avoid circular import
        context_name: str = "system_entities",
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
            GraphContextType.SYSTEM_ENTITIES,
            "Application documentation — entities, diagrams, procedures",
        )

    def _get_registrar(self) -> KnowledgeRegistrar:
        if self._registrar is not None:
            return self._registrar
        from ..api.dependencies import get_knowledge_registrar
        return get_knowledge_registrar()

    async def ingest(self, paths: list[str | Path]) -> dict[str, Any]:
        """
        Ingest a list of file paths.  Returns a summary dict.
        """
        results = {"processed": [], "skipped": [], "dsl_nodes": 0, "vector_nodes": 0}

        for path in paths:
            path = Path(path)
            suffix = path.suffix.lower()

            if suffix not in SUPPORTED_EXTENSIONS:
                logger.warning("Unsupported file type: %s", path)
                results["skipped"].append(str(path))
                continue

            try:
                if suffix in IMAGE_EXTENSIONS:
                    await self._ingest_image(path, results)
                else:
                    await self._ingest_document(path, results)
                results["processed"].append(str(path))
            except Exception as exc:
                logger.error("Failed to ingest %s: %s", path, exc)
                results["skipped"].append(str(path))

        return results

    # ── Image / diagram ingestion ──────────────────────────────────────────────

    async def _ingest_image(self, path: Path, results: dict) -> None:
        image_bytes = path.read_bytes()
        mime = mimetypes.guess_type(str(path))[0] or "image/png"
        logger.info("Translating diagram image: %s", path.name)

        dsl_source = await self._translator.diagram_to_dsl(image_bytes, mime)
        await self._index_dsl_source(dsl_source, source_path=str(path), results=results)

    # ── Document ingestion (PDF, DOCX, XLS, text) ─────────────────────────────

    async def _ingest_document(self, path: Path, results: dict) -> None:
        text = self._extract_text(path)
        if not text.strip():
            logger.warning("No text extracted from %s", path)
            return

        # Try to parse as DSL first (user may supply DSL docs directly)
        try:
            nodes = self._dsl_parser.parse(text)
            if nodes:
                await self._index_dsl_source(text, source_path=str(path), results=results)
                return
        except Exception:
            pass

        # Otherwise, translate natural language to DSL, then index both
        dsl_source = await self._translator.from_natural_language(
            text, context_hint=f"banking app documentation from {path.name}"
        )
        vector_count = self._pipeline.ingest_text(
            text, metadata={"source": str(path), "context": self._context_name}
        )
        results["vector_nodes"] += vector_count

        await self._index_dsl_source(dsl_source, source_path=str(path), results=results)

    async def _index_dsl_source(self, dsl_source: str, source_path: str, results: dict) -> None:
        # Parse and evaluate DSL
        try:
            ast_nodes = self._dsl_parser.parse(dsl_source)
        except Exception as exc:
            logger.error("DSL parse error for %s: %s", source_path, exc)
            return

        ctx = EvaluationContext()
        self._dsl_evaluator.evaluate(ast_nodes, ctx)

        translator_local = DSLTranslator()
        registrar = self._get_registrar()

        for name, axiom in ctx.axioms.items():
            dsl_text = translator_local.to_dsl(axiom)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.AXIOM,
                context=self._context_name,
                label=name,
                source=source_path,
                origin="document",
            ))
            if reg.success:
                results["dsl_nodes"] += 1

        for name, rule in ctx.rules.items():
            dsl_text = translator_local.to_dsl(rule)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.RULE,
                context=self._context_name,
                label=name,
                source=source_path,
                origin="document",
            ))
            if reg.success:
                results["dsl_nodes"] += 1

        for name, proc in ctx.procedures.items():
            dsl_text = translator_local.to_dsl(proc)
            reg = registrar.register(RegistrationRequest(
                dsl_source=dsl_text,
                node_type=NodeType.PROCEDURE,
                context=self._context_name,
                label=name,
                source=source_path,
                origin="document",
            ))
            if reg.success:
                results["dsl_nodes"] += 1

    # ── Text extraction helpers ────────────────────────────────────────────────

    @staticmethod
    def _extract_text(path: Path) -> str:
        suffix = path.suffix.lower()

        if suffix == ".pdf":
            return DocumentIngestionWorkflow._extract_pdf(path)
        if suffix in (".xls", ".xlsx"):
            return DocumentIngestionWorkflow._extract_excel(path)
        if suffix in (".docx", ".doc"):
            return DocumentIngestionWorkflow._extract_docx(path)
        if suffix in (".csv",):
            return path.read_text(encoding="utf-8", errors="ignore")
        # Plain text / markdown / json / yaml
        return path.read_text(encoding="utf-8", errors="ignore")

    @staticmethod
    def _extract_pdf(path: Path) -> str:
        try:
            from pypdf import PdfReader  # type: ignore[import]
            reader = PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            logger.error("pypdf not installed — cannot extract PDF text")
            return ""

    @staticmethod
    def _extract_excel(path: Path) -> str:
        try:
            import openpyxl  # type: ignore[import]
            wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
            lines: list[str] = []
            for sheet in wb.worksheets:
                lines.append(f"Sheet: {sheet.title}")
                for row in sheet.iter_rows(values_only=True):
                    lines.append("\t".join(str(c) if c is not None else "" for c in row))
            return "\n".join(lines)
        except ImportError:
            logger.error("openpyxl not installed — cannot extract Excel text")
            return ""

    @staticmethod
    def _extract_docx(path: Path) -> str:
        try:
            from docx import Document as DocxDoc  # type: ignore[import]
            doc = DocxDoc(str(path))
            return "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            logger.error("python-docx not installed — cannot extract DOCX text")
            return ""
