"""
Vision routes
=============
POST /vision/analyze  — Receive a photo of a physical asset, run Gemini Vision
                        to extract asset fields, check for duplicates via RAG,
                        and return a partial CreateAssetPayload.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Response schema ────────────────────────────────────────────────────────

class VisionAnalysisResponse(BaseModel):
    """Partial asset data extracted from a photo."""

    partial: dict[str, Any] = Field(
        default_factory=dict,
        description="Partial CreateAssetPayload fields identified in the image",
    )
    existing_asset_id: str | None = Field(
        None,
        description="ID of an existing asset that matches the photo, if found",
    )
    existing_asset_code: str | None = Field(
        None,
        description="Code of the existing matching asset, if found",
    )
    confidence: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Vision agent confidence score (0–1)",
    )
    notes: str = Field(
        "",
        description="Human-readable notes from the agent (Spanish)",
    )


# ── Endpoint ───────────────────────────────────────────────────────────────

_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/analyze",
    response_model=VisionAnalysisResponse,
    summary="Analyze asset photo",
    description=(
        "Upload a photo of a physical asset. "
        "Returns a partial CreateAssetPayload prefilled by the vision agent, "
        "plus a flag indicating whether a similar asset already exists."
    ),
)
async def analyze_asset_photo(
    image: UploadFile = File(..., description="Photo of the physical asset (JPEG/PNG/WebP, max 10 MB)"),
) -> VisionAnalysisResponse:
    # ── Validate input ───────────────────────────────────────────────────────
    content_type = image.content_type or "application/octet-stream"
    if content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{content_type}'. Allowed: {sorted(_ALLOWED_MIME_TYPES)}",
        )

    image_bytes = await image.read()
    if len(image_bytes) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large ({len(image_bytes) // 1024} KB). Max allowed: 10 MB.",
        )
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image file.",
        )

    # ── Run vision agent ─────────────────────────────────────────────────────
    try:
        from ...agents.vision_agent import VisionAgent  # lazy import

        agent = VisionAgent()
        result = await agent.analyze(image_bytes, mime_type=content_type)
    except RuntimeError as exc:
        logger.error("[/vision/analyze] Configuration error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        exc_text = str(exc)
        if status_code == status.HTTP_429_TOO_MANY_REQUESTS or "429 RESOURCE_EXHAUSTED" in exc_text:
            logger.warning("[/vision/analyze] Gemini quota exceeded: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Se excedio la cuota disponible de Gemini para analizar imagenes. Intente mas tarde o revise el plan/API key.",
            ) from exc
        logger.exception("[/vision/analyze] Unexpected error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing image.",
        ) from exc

    return VisionAnalysisResponse(
        partial=result.partial,
        existing_asset_id=result.existing_asset_id,
        existing_asset_code=result.existing_asset_code,
        confidence=result.confidence,
        notes=result.notes,
    )
