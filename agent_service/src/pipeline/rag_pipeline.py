"""
RAG Pipeline
============
Orchestrates:
  1. Document ingestion → chunking → embedding → PGVector store
  2. Query flow: retrieve relevant chunks → DSL deduction → NL answer
  3. DSL reasoning layer between retrieval and answer generation
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from ..config import settings
from ..dsl import DSLParser, DSLEvaluator, EvaluationContext, DSLTranslator
from .retrieval import RetrievalResult

logger = logging.getLogger(__name__)


class RAGPipeline:
    """
    Central RAG orchestrator.

    Wires together:
      - GeminiEmbedding  (embedding model)
      - GeminiLLM        (reasoning model)
      - PGVectorStore    (vector index backed by PostgreSQL)
      - DSLParser + DSLEvaluator  (deterministic reasoning)
      - DSLTranslator    (DSL ↔ natural language)
    """

    def __init__(self) -> None:
        self._llm = self._build_llm()
        self._embed = self._build_embedding()
        self._vector_store = self._build_vector_store()
        self._index = self._build_index()
        self._dsl_parser = DSLParser()
        self._dsl_evaluator = DSLEvaluator(max_steps=settings.dsl_max_deduction_steps)
        self._dsl_translator = DSLTranslator(llm=self._llm)

    # ── Builder methods ───────────────────────────────────────────────────────

    def _build_llm(self) -> Any:
        try:
            from llama_index.llms.google_genai import GoogleGenAI
            llm = GoogleGenAI(
                model=settings.llm_model,
                api_key=settings.google_api_key,
                temperature=settings.llm_temperature,
            )
            logger.info("Google GenAI LLM loaded: %s  (temp=%.2f)", settings.llm_model, settings.llm_temperature)
            return llm
        except ImportError as exc:
            logger.error("llama-index-llms-google-genai not installed")
            raise RuntimeError("Google GenAI LLM package not available") from exc

    def _build_embedding(self) -> Any:
        from .embeddings import build_gemini_embedding
        return build_gemini_embedding()

    def _build_vector_store(self) -> Any:
        try:
            from llama_index.vector_stores.postgres import PGVectorStore  # type: ignore[import]
            store = PGVectorStore.from_params(
                host=settings.postgres_host,
                port=str(settings.postgres_port),
                database=settings.postgres_db,
                user=settings.postgres_user,
                password=settings.postgres_password,
                table_name="document_embeddings",
                embed_dim=768,  # text-embedding-004 dimension
            )
            logger.info("PGVectorStore connected (table=document_embeddings)")
            return store
        except ImportError as exc:
            logger.error("llama-index-vector-stores-postgres not installed")
            raise RuntimeError("PGVector package not available") from exc

    def _build_index(self) -> Any:
        try:
            from llama_index.core import VectorStoreIndex, StorageContext  # type: ignore[import]
            from llama_index.core import Settings as LISettings  # type: ignore[import]
            LISettings.llm = self._llm
            LISettings.embed_model = self._embed
            LISettings.chunk_size = settings.chunk_size
            LISettings.chunk_overlap = settings.chunk_overlap

            storage_ctx = StorageContext.from_defaults(vector_store=self._vector_store)
            index = VectorStoreIndex.from_vector_store(
                vector_store=self._vector_store,
                storage_context=storage_ctx,
            )
            logger.info("VectorStoreIndex created")
            return index
        except ImportError as exc:
            logger.error("llama-index-core not installed")
            raise RuntimeError("LlamaIndex core package not available") from exc

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def ingest_documents(self, paths: list[str | Path]) -> int:
        """
        Load documents from *paths*, chunk, embed, and index them.
        Returns the number of nodes inserted.
        """
        from llama_index.core import SimpleDirectoryReader  # type: ignore[import]
        from llama_index.core.node_parser import SentenceSplitter  # type: ignore[import]

        str_paths = [str(p) for p in paths]
        docs = SimpleDirectoryReader(input_files=str_paths).load_data()

        splitter = SentenceSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        nodes = splitter.get_nodes_from_documents(docs)
        self._index.insert_nodes(nodes)
        logger.info("Ingested %d nodes from %d documents", len(nodes), len(docs))
        return len(nodes)

    def ingest_text(self, text: str, metadata: dict[str, Any] | None = None) -> int:
        """Ingest raw text (e.g. a DSL source or AOP) into the vector index."""
        from llama_index.core import Document  # type: ignore[import]
        from llama_index.core.node_parser import SentenceSplitter  # type: ignore[import]

        doc = Document(text=text, metadata=metadata or {})
        splitter = SentenceSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        nodes = splitter.get_nodes_from_documents([doc])
        self._index.insert_nodes(nodes)
        logger.info("Ingested %d nodes from raw text", len(nodes))
        return len(nodes)

    async def aingest_text(self, text: str, metadata: dict[str, Any] | None = None) -> int:
        """
        Async version of ingest_text.

        Use this when bridging from a worker thread back to the main event loop via
        ``anyio.from_thread.run(pipeline.aingest_text(...))``.  Running the insertion
        on the event loop that owns the asyncpg connection pool avoids the
        "Future attached to a different loop" error.
        """
        from llama_index.core import Document  # type: ignore[import]
        from llama_index.core.node_parser import SentenceSplitter  # type: ignore[import]

        doc = Document(text=text, metadata=metadata or {})
        splitter = SentenceSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        nodes = splitter.get_nodes_from_documents([doc])

        # Prefer the native async path; fall back to sync (covered by nest_asyncio).
        if hasattr(self._index, "async_insert_nodes"):
            await self._index.async_insert_nodes(nodes)
        elif hasattr(self._index, "ainsert_nodes"):
            await self._index.ainsert_nodes(nodes)
        else:
            self._index.insert_nodes(nodes)

        logger.info("Async ingested %d nodes from raw text", len(nodes))
        return len(nodes)

    # ── Query ─────────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int = 5) -> list[RetrievalResult]:
        """Retrieve *top_k* chunks most relevant to *query*."""
        retriever = self._index.as_retriever(similarity_top_k=top_k)
        nodes = retriever.retrieve(query)
        return [
            RetrievalResult(
                node_id=n.node_id,
                text=n.get_content(),
                score=n.get_score() or 0.0,
                metadata=n.metadata or {},
            )
            for n in nodes
        ]

    async def query(self, user_question: str, dsl_context: EvaluationContext | None = None) -> str:
        """
        Full RAG + DSL reasoning pipeline:
          1. Retrieve relevant document chunks.
          2. Extract DSL expressions from retrieved context.
          3. Run DSL evaluator (deduction / simplification).
          4. Translate final AOP expression to natural language.
          5. Return answer.
        """
        results = self.retrieve(user_question)
        if not results:
            return "I could not find relevant information to answer your question."

        ctx = dsl_context or EvaluationContext()

        # Try to parse any DSL snippets from retrieved nodes
        for result in results:
            try:
                nodes = self._dsl_parser.parse(result.text)
                self._dsl_evaluator.evaluate(nodes, ctx)
            except Exception:
                # Non-DSL text is acceptable — store as raw context
                pass

        # Assemble a concise DSL/text summary for the LLM
        context_text = "\n\n".join(
            f"[{r.score:.3f}] {r.text[:800]}" for r in results
        )

        if settings.dsl_simplify_before_answer and ctx.contexts.get(ctx.active_ctx):
            # Translate the last simplified DSL statement to NL
            last_expr = ctx.contexts[ctx.active_ctx][-1]
            try:
                return await self._dsl_translator.to_natural_language(last_expr)
            except Exception:
                pass  # fallback to LLM answer below

        # Fallback: pass context to LLM for a direct answer
        prompt = (
            f"You are a helpful banking support assistant. "
            f"Use ONLY the following context to answer the user's question.\n\n"
            f"Context:\n{context_text}\n\n"
            f"Question: {user_question}\n"
            f"Answer:"
        )
        response = await self._llm.acomplete(prompt)
        return response.text.strip()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def dsl_parser(self) -> DSLParser:
        return self._dsl_parser

    @property
    def dsl_evaluator(self) -> DSLEvaluator:
        return self._dsl_evaluator

    @property
    def dsl_translator(self) -> DSLTranslator:
        return self._dsl_translator
