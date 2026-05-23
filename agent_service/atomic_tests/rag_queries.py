from llama_index.core import PropertyGraphIndex, VectorStoreIndex
from llama_index.graph_stores.neo4j import Neo4jPropertyGraphStore, Neo4jGraphStore
from llama_index.core.indices.property_graph import DynamicLLMPathExtractor
from llama_index.core.indices.property_graph import LLMSynonymRetriever
# from llama_index.core.

from llama_index.core.readers import SimpleDirectoryReader
from llama_index.core.extractors import SummaryExtractor
from llama_index.core import StorageContext
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding as genai_embedding
from llama_index.llms.google_genai import GoogleGenAI as genai

import pydantic
from typing import List
from llama_index.core.schema import TransformComponent
from os import getenv

import traceback

import logging

logging.getLogger("llama_index").setLevel(logging.DEBUG)

neo4j_username = getenv("NEO4J_USER", "")
neo4j_password = getenv("NEO4J_PASSWORD", "")
neo4j_uri = getenv("NEO4J_URI", "")

embedding_model = getenv("EMBEDDING_MODEL", "")
llm_model = getenv("LLM_MODEL", " ")
api_key = getenv("GOOGLE_API_KEY", "")

llm = genai(model = llm_model, api_key = api_key)
embedding = genai_embedding(model_name = embedding_model, api_key = api_key)

print(neo4j_username)
print(neo4j_password)
print(neo4j_uri)
print(embedding_model)
print(llm_model)
print(api_key)


graph_store = Neo4jPropertyGraphStore(
    username=neo4j_username,
    password=neo4j_password,
    url=neo4j_uri
)

# context = StorageContext.

extractors: List[TransformComponent] = [
    DynamicLLMPathExtractor(
        llm=llm,
        allowed_entity_props=["name", "age", "power_level", "function"],
        allowed_entity_types=["Character", "Tool", "Protocol", "Event"],
        max_triplets_per_chunk=40
        ),
    ]
try:
    storage_context = StorageContext.from_defaults(persist_dir="./atomic_tests/context_storage_persistence")
    print("StorageContext restored")
except Exception as e:
    storage_context = StorageContext.from_defaults()
    print("New Storage Context Created")

index = PropertyGraphIndex.from_existing(
    llm=llm,
    property_graph_store=graph_store,
    kg_extractors=extractors,
    embed_model=embedding,
    storage_context=storage_context
)

document = SimpleDirectoryReader(input_files=["./atomic_tests/rag_document_data.txt"]).load_data()
print("document data fetched")


index.storage_context.persist(persist_dir="./atomic_tests/context_storage_persistence")
print("document data inserted")

query_engine = index.as_query_engine(
    llm=genai(model=llm_model, api_key=api_key),
)

res = query_engine.query("¿En qué se convierte el pájaro &8081 al final de la historia?")

print(res)