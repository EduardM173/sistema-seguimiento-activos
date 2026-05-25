"""
Shared dependency injection for FastAPI routes.
"""
from __future__ import annotations

import functools
from typing import Any

from ..config import settings


@functools.lru_cache(maxsize=1)
def get_pipeline() -> Any:
    """Return the singleton RAGPipeline instance."""
    from ..pipeline import RAGPipeline
    return RAGPipeline()


@functools.lru_cache(maxsize=1)
def get_graph_store() -> Any:
    """Return the singleton Neo4j graph store."""
    from ..knowledge_graph import Neo4jGraphStore
    return Neo4jGraphStore()


@functools.lru_cache(maxsize=1)
def get_llm() -> Any:
    """Return the singleton LLM instance."""
    from llama_index.llms.google_genai import GoogleGenAI
    from google.genai.types import GenerateContentConfig, ThinkingConfig
    return GoogleGenAI(
        model=settings.llm_model,
        api_key=settings.google_api_key,
        temperature=settings.llm_temperature,
        generation_config=GenerateContentConfig(
            thinking_config=ThinkingConfig(thinking_budget=512),
        ),
    )


@functools.lru_cache(maxsize=1)
def get_property_graphs() -> dict[str, Any]:
    """Return the PropertyGraphIndex instances (BusinessDomainGraph only)."""
    from ..agents import BusinessDomainGraph
    from ..pipeline.embeddings import build_gemini_embedding

    store = get_graph_store()
    llm = get_llm()
    embed_model = build_gemini_embedding()

    return {
        "facts": BusinessDomainGraph(graph_store=store, llm=llm, embed_model=embed_model),
    }


@functools.lru_cache(maxsize=1)
def get_neo4j_driver() -> Any:
    """Return the singleton Neo4j driver for direct queries."""
    from neo4j import GraphDatabase
    return GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )


@functools.lru_cache(maxsize=1)
def get_knowledge_registrar() -> Any:
    """Return the singleton KnowledgeRegistrar instance."""
    from ..pipeline.knowledge_registrar import KnowledgeRegistrar
    return KnowledgeRegistrar(
        graph_store=get_graph_store(),
        property_graphs=get_property_graphs(),
        rag_pipeline=get_pipeline(),
    )


@functools.lru_cache(maxsize=1)
def get_chat_reasoning_agent() -> Any:
    """Return the ChatReasoningAgent instance for RAG-enabled chat."""
    from ..agents import ChatReasoningAgent

    graphs = get_property_graphs()
    llm = get_llm()

    return ChatReasoningAgent(
        llm=llm,
        domain_graph=graphs["facts"],
    )


@functools.lru_cache(maxsize=1)
def get_user_state_agent() -> Any:
    """Return the UserStateAgent instance."""
    from ..agents import UserStateAgent
    llm = get_llm()
    return UserStateAgent(llm=llm)


@functools.lru_cache(maxsize=1)
def get_deeplink_agent() -> Any:
    """Return the DeeplinkAgent instance."""
    from ..agents import DeeplinkAgent
    llm = get_llm()
    return DeeplinkAgent(llm=llm)
