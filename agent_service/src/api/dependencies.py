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
    from ..pipeline import RAGPipeline  # lazy import — avoids import at startup
    return RAGPipeline()


@functools.lru_cache(maxsize=1)
def get_graph_store() -> Any:
    """Return the singleton Neo4j graph store for all graph operations."""
    from ..knowledge_graph import Neo4jGraphStore
    return Neo4jGraphStore()


@functools.lru_cache(maxsize=1)
def get_meta_graph() -> Any:
    from ..knowledge_graph import MetaGraph
    store = get_graph_store()
    return MetaGraph(store)


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
    """Return the PropertyGraphIndex instances for each domain."""
    from ..agents import (
        AxiomsGraph,
        DeductionRulesGraph,
        BusinessDomainGraph,
        TheoremsGraph,
    )
    from ..pipeline.embeddings import build_gemini_embedding
    
    store = get_graph_store()
    llm = get_llm()
    embed_model = build_gemini_embedding()
    

    return {
        "axioms": AxiomsGraph(graph_store=store, llm=llm, embed_model=embed_model),
        "rules": DeductionRulesGraph(graph_store=store, llm=llm, embed_model=embed_model),
        "facts": BusinessDomainGraph(graph_store=store, llm=llm, embed_model=embed_model),
        "theorems": TheoremsGraph(graph_store=store, llm=llm, embed_model=embed_model),
    }


@functools.lru_cache(maxsize=1)
def get_z3_engine() -> Any:
    """Return the singleton Z3 proof engine."""
    from ..agents import Z3ProofEngine
    return Z3ProofEngine(timeout_ms=settings.dsl_max_deduction_steps * 1000)


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
def get_reasoning_agent() -> Any:
    """Return the singleton ReasoningAgent instance."""
    from ..agents import ReasoningAgent
    
    graphs = get_property_graphs()
    llm = get_llm()
    z3_engine = get_z3_engine()
    
    return ReasoningAgent(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        z3_engine=z3_engine,
    )


@functools.lru_cache(maxsize=1)
def get_dual_retriever() -> Any:
    """Return a DualRetriever that combines vector search with Cypher traversal."""
    from ..pipeline.dual_retriever import DualRetriever

    graphs = get_property_graphs()
    driver = get_neo4j_driver()
    llm = get_llm()
    # Use the facts graph index as the primary vector index for dual retrieval
    return DualRetriever(
        property_graph_index=graphs["facts"].index,
        neo4j_driver=driver,
        llm=llm,
    )


@functools.lru_cache(maxsize=1)
def get_chat_reasoning_agent() -> Any:
    """Return the ChatReasoningAgent instance for RAG-enabled chat."""
    from ..agents import ChatReasoningAgent
    
    graphs = get_property_graphs()
    llm = get_llm()
    z3_engine = get_z3_engine()
    dual_retriever = get_dual_retriever()
    
    return ChatReasoningAgent(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        z3_engine=z3_engine,
        dual_retriever=dual_retriever,
    )


@functools.lru_cache(maxsize=1)
def get_user_state_agent() -> Any:
    """Return the UserStateAgent instance."""
    from ..agents import UserStateAgent
    llm = get_llm()
    return UserStateAgent(llm=llm)


@functools.lru_cache(maxsize=1)
def get_chat_ingestion_agent() -> Any:
    """Return the ChatIngestionAgent instance."""
    from ..agents import ChatIngestionAgent
    
    graphs = get_property_graphs()
    llm = get_llm()
    z3_engine = get_z3_engine()
    
    return ChatIngestionAgent(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        z3_engine=z3_engine,
    )


@functools.lru_cache(maxsize=1)
def get_document_ingestion_agent() -> Any:
    """Return the DocumentIngestionAgent instance."""
    from ..agents import DocumentIngestionAgent
    
    graphs = get_property_graphs()
    llm = get_llm()
    z3_engine = get_z3_engine()
    
    return DocumentIngestionAgent(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        z3_engine=z3_engine,
    )


@functools.lru_cache(maxsize=1)
def get_aop_validation_agent() -> Any:
    """Return the AOPValidationAgent instance."""
    from ..agents import AOPValidationAgent
    
    graphs = get_property_graphs()
    llm = get_llm()
    z3_engine = get_z3_engine()
    
    return AOPValidationAgent(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        z3_engine=z3_engine,
    )


@functools.lru_cache(maxsize=1)
def get_contradiction_resolver() -> Any:
    """Return the ContradictionResolver instance."""
    from ..agents import ContradictionResolver
    
    graphs = get_property_graphs()
    store = get_graph_store()
    llm = get_llm()
    z3_engine = get_z3_engine()
    
    return ContradictionResolver(
        llm=llm,
        axioms_graph=graphs["axioms"],
        rules_graph=graphs["rules"],
        domain_graph=graphs["facts"],
        theorems_graph=graphs["theorems"],
        graph_store=store,
        z3_engine=z3_engine,
    )


@functools.lru_cache(maxsize=1)
def get_deduction_rules_graph() -> Any:
    """Return the DeductionRulesGraph instance for registering deduction rules."""
    graphs = get_property_graphs()
    return graphs["rules"]
