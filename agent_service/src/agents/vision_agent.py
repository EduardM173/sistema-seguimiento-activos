"""
Vision Agent
============
Analyzes a photo of a physical asset using Gemini Vision API and returns:
 - A partial CreateAssetPayload (nombre, marca, modelo, numeroSerie, descripcion)
 - Whether a similar asset already exists in the system (via RAG search)
 - Confidence score and explanatory notes
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from google import genai
from google.genai import types as genai_types

from ..config import settings

logger = logging.getLogger(__name__)

VISION_SYSTEM_PROMPT = """Eres un asistente especializado en identificar activos físicos en imágenes para un 
sistema de seguimiento de activos empresariales.

Tu tarea es analizar la imagen proporcionada e identificar información del activo físico visible.

Devuelve ÚNICAMENTE un JSON válido con la siguiente estructura (omite los campos que no puedas determinar):
{
  "nombre": "nombre descriptivo del activo",
  "marca": "marca del fabricante (si es visible)",
  "modelo": "modelo específico (si es visible)",
  "numeroSerie": "número de serie (si es visible en la imagen)",
  "descripcion": "descripción breve del activo y su estado aparente",
  "tipo": "tipo de activo (laptop, monitor, impresora, silla, escritorio, etc.)",
  "confianza": 0.85
}

Reglas:
- Solo incluye información que puedas ver claramente en la imagen
- Si no puedes determinar un campo, omítelo del JSON
- El campo "confianza" (0.0 a 1.0) refleja cuán seguro estás de la identificación
- Responde SIEMPRE en español
- No incluyas explicaciones fuera del JSON
"""


@dataclass
class VisionAnalysisResult:
    partial: dict[str, Any] = field(default_factory=dict)
    existing_asset_id: str | None = None
    existing_asset_code: str | None = None
    confidence: float = 0.0
    notes: str = ""


class VisionAgent:
    def __init__(self) -> None:
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY is not configured")
        self._client = genai.Client(api_key=settings.google_api_key)

    async def analyze(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> VisionAnalysisResult:
        """Analyze image bytes and return partial asset data + duplicate check."""

        # ── Step 1: Gemini Vision analysis ──────────────────────────────────
        image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        user_prompt = "Identifica el activo en esta imagen y devuelve el JSON solicitado."

        try:
            response = self._client.models.generate_content(
                model=settings.llm_model,
                contents=[image_part, user_prompt],
                config=genai_types.GenerateContentConfig(
                    system_instruction=VISION_SYSTEM_PROMPT,
                    temperature=0.1,
                    max_output_tokens=1024,
                    response_mime_type="application/json",
                ),
            )
            raw_text = (response.text or "").strip()
            if not raw_text:
                logger.warning("[VisionAgent] Empty response from Gemini (safety filter or blocked content)")
                return VisionAnalysisResult(
                    notes="No se pudo procesar la imagen. Intente con otra foto más clara.",
                    confidence=0.0,
                )
            # Strip markdown code fences if the model still adds them
            if raw_text.startswith("```"):
                raw_text = "\n".join(raw_text.split("\n")[1:])
            if raw_text.endswith("```"):
                raw_text = "\n".join(raw_text.split("\n")[:-1])
            raw_text = raw_text.strip()

            vision_data = json.loads(raw_text)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("[VisionAgent] Could not parse Gemini response: %s | raw: %.200s", exc, raw_text if 'raw_text' in dir() else '(no text)')
            return VisionAnalysisResult(
                notes="No se pudo identificar el activo en la imagen.",
                confidence=0.0,
            )
        except Exception as exc:
            logger.error("[VisionAgent] Gemini Vision error: %s", exc)
            raise

        confidence = float(vision_data.pop("confianza", 0.5))
        asset_type = vision_data.pop("tipo", None)

        # Build partial payload (only backend-accepted fields)
        partial: dict[str, Any] = {}
        for key in ("nombre", "marca", "modelo", "numeroSerie", "descripcion"):
            if key in vision_data and vision_data[key]:
                partial[key] = str(vision_data[key])

        notes_parts: list[str] = []
        if asset_type:
            notes_parts.append(f"Se detectó: {asset_type}.")
        if not partial:
            notes_parts.append("No se encontraron datos identificables en la imagen.")

        # ── Step 2: RAG duplicate check ──────────────────────────────────────
        existing_id = None
        existing_code = None
        if partial.get("nombre") or partial.get("marca") or partial.get("modelo"):
            try:
                existing_id, existing_code = await self._find_existing(partial)
            except Exception as exc:
                logger.warning("[VisionAgent] RAG search failed: %s", exc)

        if existing_id:
            notes_parts.append(
                f"Se encontró un activo similar en el sistema (código: {existing_code})."
            )
        else:
            notes_parts.append("No se encontró un activo similar en el sistema.")

        return VisionAnalysisResult(
            partial=partial,
            existing_asset_id=existing_id,
            existing_asset_code=existing_code,
            confidence=confidence,
            notes=" ".join(notes_parts),
        )

    async def _find_existing(
        self, partial: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        """Search for a matching asset using the persistence layer (PostgreSQL)."""
        try:
            from ..persistence.chat_db import get_db_connection  # type: ignore

            query_terms = " ".join(
                filter(None, [partial.get("nombre"), partial.get("marca"), partial.get("modelo")])
            ).strip()
            if not query_terms:
                return None, None

            async with get_db_connection() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, codigo
                    FROM assets
                    WHERE to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(marca,'') || ' ' || coalesce(modelo,''))
                          @@ plainto_tsquery('spanish', $1)
                    LIMIT 1
                    """,
                    query_terms,
                )
                if row:
                    return str(row["id"]), str(row["codigo"])
        except Exception as exc:
            logger.debug("[VisionAgent] Fulltext search not available: %s", exc)

        return None, None
