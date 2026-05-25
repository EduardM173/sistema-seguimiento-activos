"""
Ingestion routes — Workflow A, B, C, D.
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter()


# ── Request / response models ─────────────────────────────────────────────────

class AOPIngestRequest(BaseModel):
    dsl_source: str
    metadata: dict[str, Any] = {}


class ConversationIngestRequest(BaseModel):
    conversation: list[dict[str, str]]
    resolved: bool | None = None
    metadata: dict[str, Any] = {}


class JiraIngestRequest(BaseModel):
    project_key: str
    max_results: int = 100


# ── Workflow A: Document ingestion ────────────────────────────────────────────

@router.post("/documents", summary="Workflow A — Ingest documents (PDF, images, XLS, …)")
async def ingest_documents(
    files: list[UploadFile] = File(...),
) -> dict:
    from ..dependencies import get_pipeline, get_graph_store, get_meta_graph, get_knowledge_registrar
    from ...ingestion import DocumentIngestionWorkflow
    from ...dsl import DSLTranslator

    pipeline = get_pipeline()
    store = get_graph_store()
    meta_graph = get_meta_graph()
    translator = pipeline.dsl_translator
    registrar = get_knowledge_registrar()

    workflow = DocumentIngestionWorkflow(store, meta_graph, translator, pipeline, registrar=registrar)

    # Write uploads to a temp dir
    with tempfile.TemporaryDirectory() as tmpdir:
        paths: list[Path] = []
        for upload in files:
            dest = Path(tmpdir) / (upload.filename or "upload")
            dest.write_bytes(await upload.read())
            paths.append(dest)

        results = await workflow.ingest(paths)

    return results


# ── Workflow B: Direct AOP ingestion ──────────────────────────────────────────

@router.post("/aop", summary="Workflow B — Ingest direct AOP / DSL source")
async def ingest_aop(body: AOPIngestRequest) -> dict:
    from ..dependencies import get_pipeline, get_graph_store, get_meta_graph, get_knowledge_registrar
    from ...ingestion import AOPIngestionWorkflow

    pipeline = get_pipeline()
    store = get_graph_store()
    meta_graph = get_meta_graph()
    registrar = get_knowledge_registrar()

    workflow = AOPIngestionWorkflow(store, meta_graph, pipeline, registrar=registrar)
    return workflow.ingest(body.dsl_source, metadata=body.metadata)


# ── Workflow C: Conversation ingestion ────────────────────────────────────────

@router.post("/conversation", summary="Workflow C — Ingest resolved customer conversation")
async def ingest_conversation(body: ConversationIngestRequest) -> dict:
    from ..dependencies import get_pipeline, get_graph_store, get_meta_graph, get_knowledge_registrar
    from ...ingestion import ConversationIngestionWorkflow

    pipeline = get_pipeline()
    store = get_graph_store()
    meta_graph = get_meta_graph()
    registrar = get_knowledge_registrar()

    workflow = ConversationIngestionWorkflow(store, meta_graph, pipeline.dsl_translator, pipeline, registrar=registrar)
    return await workflow.ingest(body.conversation, resolved=body.resolved, metadata=body.metadata)


# ── Workflow D: Jira ingestion ────────────────────────────────────────────────

@router.post("/jira", summary="Workflow D — Ingest Jira ticket history")
async def ingest_jira(body: JiraIngestRequest) -> dict:
    from ..dependencies import get_pipeline, get_graph_store, get_meta_graph, get_knowledge_registrar
    from ...ingestion import JiraIngestionWorkflow

    pipeline = get_pipeline()
    store = get_graph_store()
    meta_graph = get_meta_graph()
    registrar = get_knowledge_registrar()

    workflow = JiraIngestionWorkflow(store, meta_graph, pipeline.dsl_translator, pipeline, registrar=registrar)
    try:
        return await workflow.ingest_project(body.project_key, max_results=body.max_results)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ══════════════════════════════════════════════════════════════════════════════
# Agentic Ingestion Endpoints (New)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/aop-validate", summary="Validate and store AOP with contradiction checking")
async def validate_aop(body: AOPIngestRequest) -> dict:
    """
    Validate an AOP/DSL expression using the AOPValidationAgent.
    
    This performs:
    1. Local parsing and evaluation
    2. Z3 consistency checking against existing knowledge
    3. Storage if valid, or LLM correction if invalid
    """
    from ..dependencies import get_aop_validation_agent
    
    agent = get_aop_validation_agent()
    
    try:
        result = await agent.validate_and_store(
            body.dsl_source,
            metadata=body.metadata,
        )
        
        return {
            "status": result.status.value,
            "message": result.message,
            "theorems_deduced": result.theorems_deduced,
            "validation_errors": result.validation_errors,
            "contradiction_info": result.contradiction_info,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/conversation-agent", summary="Ingest conversation using agentic workflow")
async def ingest_conversation_agent(body: ConversationIngestRequest) -> dict:
    """
    Ingest a conversation using the ChatIngestionAgent.
    
    The agent will:
    1. Analyze the conversation for knowledge
    2. Retrieve context from PropertyGraphIndex stores
    3. Formalize and verify new knowledge
    4. Store validated information
    """
    from ..dependencies import get_chat_ingestion_agent
    
    agent = get_chat_ingestion_agent()
    
    try:
        result = await agent.process_conversation(
            body.conversation,
            metadata=body.metadata,
        )
        
        return {
            "status": result.status.value,
            "message": result.message,
            "entities_ingested": result.entities_ingested,
            "theorems_deduced": result.theorems_deduced,
            "contradiction_info": result.contradiction_info,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class DocumentAgentIngestRequest(BaseModel):
    content: str
    document_type: str = "text"
    metadata: dict[str, Any] = {}


@router.post("/document-agent", summary="Ingest document using agentic workflow")
async def ingest_document_agent(body: DocumentAgentIngestRequest) -> dict:
    """
    Ingest a document using the DocumentIngestionAgent.
    
    The agent runs autonomously to:
    1. Extract structured information from the document
    2. Request relevant axioms/rules/theorems for context
    3. Synthesize and validate new knowledge
    4. Store results without user intervention
    """
    from ..dependencies import get_document_ingestion_agent
    
    agent = get_document_ingestion_agent()
    
    try:
        result = await agent.ingest_document(
            body.content,
            document_type=body.document_type,
            metadata=body.metadata,
        )
        
        return {
            "status": result.status.value,
            "message": result.message,
            "entities_ingested": result.entities_ingested,
            "theorems_deduced": result.theorems_deduced,
            "contradiction_info": result.contradiction_info,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
