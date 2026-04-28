"""
Application configuration loaded from environment / .env file.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Google GenAI (replaces deprecated Gemini)
    google_api_key: str = ""
    
    # Legacy alias for backwards compatibility
    @property
    def gemini_api_key(self) -> str:
        return self.google_api_key

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "graphrag"
    postgres_user: str = "graphrag"
    postgres_password: str = "graphrag_secret"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "graphrag_secret"

    # Jira (optional)
    jira_url: str = ""
    jira_user: str = ""
    jira_token: str = ""

    # App
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    # RAG
    embedding_model: str = "text-embedding-004"
    llm_model: str = "gemini-2.0-flash"
    llm_temperature: float = 0.0
    chunk_size: int = 512
    chunk_overlap: int = 64

    # DSL / reasoning
    dsl_max_deduction_steps: int = 100
    dsl_simplify_before_answer: bool = True

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_async_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
