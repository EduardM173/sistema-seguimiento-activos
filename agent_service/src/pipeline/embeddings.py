"""
Google GenAI Embedding Helper
=============================
Wraps the LlamaIndex GoogleGenAIEmbedding with settings from config.

Note: This replaces the deprecated llama-index-embeddings-gemini package.
Use llama-index-embeddings-google-genai instead.
"""
from __future__ import annotations

import logging

from ..config import settings

logger = logging.getLogger(__name__)


def build_gemini_embedding():
    """
    Build and return a LlamaIndex-compatible Google GenAI embedding model.

    Lazily imports llama-index-embeddings-google-genai so the module can be
    imported without the package installed (e.g. in lightweight tests).
    
    Note: Function name kept for backwards compatibility.
    """
    try:
        from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
        embedding = GoogleGenAIEmbedding(
            model_name=settings.embedding_model,
            api_key=settings.google_api_key,
        )
        logger.info("Google GenAI embedding model loaded: %s", settings.embedding_model)
        return embedding
    except ImportError as exc:
        logger.error(
            "llama-index-embeddings-google-genai not installed. "
            "Run: pip install llama-index-embeddings-google-genai"
        )
        raise RuntimeError("Google GenAI embedding package not available") from exc


def build_google_genai_embedding():
    """Alias for build_gemini_embedding (new name)."""
    return build_gemini_embedding()
