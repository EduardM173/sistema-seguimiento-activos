"""
Query routes — RAG + DSL reasoning pipeline.
"""
from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

router = APIRouter()


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


class QueryResponse(BaseModel):
    answer: str
    retrieved_chunks: int


@router.post("/", summary="Ask a question — RAG + DSL reasoning pipeline")
async def query(body: QueryRequest) -> QueryResponse:
    from ..dependencies import get_pipeline
    from ...dsl import EvaluationContext

    pipeline = get_pipeline()
    ctx = EvaluationContext()

    try:
        answer = await pipeline.query(body.question, dsl_context=ctx)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}") from exc

    results = pipeline.retrieve(body.question, top_k=body.top_k)
    return QueryResponse(answer=answer, retrieved_chunks=len(results))


@router.post("/retrieve", summary="Retrieve relevant document chunks without reasoning")
async def retrieve(body: QueryRequest) -> dict:
    from ..dependencies import get_pipeline

    pipeline = get_pipeline()
    results = pipeline.retrieve(body.question, top_k=body.top_k)
    return {
        "results": [
            {
                "node_id": r.node_id,
                "text": r.text[:500],
                "score": round(r.score, 4),
                "metadata": r.metadata,
            }
            for r in results
        ]
    }
