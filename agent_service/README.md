# GraphRAG — Banking Documentation Assistant

A **LlamaIndex + Gemini** based RAG (Retrieval-Augmented Generation) pipeline
for banking customer-service support, featuring a **formal DSL reasoning layer**
that minimises AI non-determinism.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        FastAPI                          │
│  /ingest/documents  /ingest/aop  /ingest/conversation   │
│  /ingest/jira       /query       /admin                  │
└─────────────────┬───────────────────────────────────────┘
                  │
          ┌───────┴──────────┐
          │   RAG Pipeline   │
          │  (LlamaIndex)    │
          │  Gemini LLM +    │
          │  Gemini Embed    │
          └───────┬──────────┘
        ┌─────────┴──────────┐
        │                    │
 ┌──────┴──────┐    ┌────────┴────────┐
 │  PGVector   │    │   Knowledge     │
 │  Store      │    │   Graph         │
 │ (embeddings)│    │   (PostgreSQL)  │
 └─────────────┘    └───────┬─────────┘
                            │
                   ┌────────┴────────┐
                   │   Meta-Graph    │
                   │  (NetworkX +    │
                   │   PostgreSQL)   │
                   └─────────────────┘

          DSL Reasoning Layer
          ┌──────────────────────────┐
          │  Grammar  →  Parser      │
          │  Evaluator (simplifier)  │
          │  Translator (NL ↔ DSL)   │
          └──────────────────────────┘
```

### Technology Stack

| Component | Technology |
|---|---|
| LLM & Embedding | Google Gemini (via LlamaIndex) |
| Vector Store | PostgreSQL + pgvector |
| Graph Store | PostgreSQL (custom schema) + NetworkX |
| API | FastAPI |
| Containerisation | Docker + Docker Compose |
| Formal Reasoning | Custom DSL (Lark grammar) |
| Document Parsing | pypdf, openpyxl, python-docx, Pillow |

---

## DSL — Formal Reasoning Language

All logical deduction is performed over a **formal DSL** (Domain-Specific Language),
not natural language.  This eliminates model hallucinations in the reasoning path.

Natural language translation only happens _after_ the DSL expression has been
fully simplified into an AOP (Aspect-Oriented Procedure).

### DSL Constructs

| Construct | Syntax | Example |
|---|---|---|
| Axiom | `AXIOM <Name>: <expr>.` | `AXIOM A1: Authenticated(?u).` |
| Deduction rule | `RULE <Name>: IF <expr>; THEN <expr>.` | `RULE R1: IF HasAccount(?u); THEN CanLogin(?u).` |
| Procedure (AOP) | `PROCEDURE <Name> [PRECOND (<expr>)] BEGIN STEP <Name>: <expr>; … END.` | See example below |
| Substitution | `SUBST(<expr>, <var>, <replacement>).` | `SUBST(Foo(?x), ?x, "alice").` |
| Meta link | `META_LINK(<A>, <B>, <type>).` | `META_LINK(AuthService, UserDB, calls).` |
| Context shift | `SHIFT_CTX(<name>).` | `SHIFT_CTX(procedures).` |
| Context embed | `EMBED_CTX(<name>, <expr>).` | `EMBED_CTX(theorems, Derived(?x)).` |

### Logical Connectives

`AND`, `OR`, `NOT`, `IMPLIES`, `IFF`, `XOR`

### Quantifiers

`FORALL ?x. <expr>`,  `EXISTS ?x. <expr>`

### Pattern Matching

```dsl
MATCH <expr> WITH
| <pattern> ARROW <expr>
| ...
```

### AOP Procedure Example

```dsl
PROCEDURE LoginFlow
PRECOND (HasAccount(?u))
BEGIN
  STEP CheckCredentials: ValidatePassword(?u, ?pwd);
  STEP CheckNotBlocked:  NOT Blocked(?u);
  STEP IssueToken:       GenerateJWT(?u);
END.
```

---

## Ingestion Workflows

### Workflow A — Application Documentation

Ingests: PDF, images (PNG/JPG/BMP/TIFF/GIF), XLS/XLSX, DOCX, Markdown, JSON/YAML.

- Flow diagrams and BPMN images → Gemini vision → DSL PROCEDURE
- Text documents → Natural language → DSL translation
- Entity relations extracted and stored in `system_entities` graph context

### Workflow B — Direct AOP Ingestion

User provides DSL source text directly.  Parsed, evaluated, and indexed.

### Workflow C — Conversation Learning

Customer-service conversations are ingested if they show resolution signals
(e.g. "thanks", "that worked", "issue fixed").  Successful conversations are
translated to DSL PROCEDUREs and indexed in the `conversations` context.

### Workflow D — Jira Ticket History

Resolved Jira tickets are fetched, translated to DSL theorems/axioms,
and stored in the `jira` context.  Keeps the knowledge graph updated
with known bug fixes.

---

## Knowledge Graph Structure

The graph is organised into **contexts** (sub-graphs), linked by a **meta-graph**:

| Context | Type | Contents |
|---|---|---|
| `system_entities` | SYSTEM_ENTITIES | Microservices, endpoints, users, components |
| `procedures` | PROCEDURES | AOP / DSL procedure definitions |
| `theorems` | THEOREMS | Deduced theorems |
| `conversations` | CONVERSATIONS | Learned procedures from chat |
| `jira` | JIRA | Bug/fix history |
| `meta` | META | Meta-graph (context nodes and edges) |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 2. Start the stack

```bash
docker compose up --build
```

The API is available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### 3. Ingest documentation

```bash
# Workflow A — ingest a PDF and a BPMN diagram
curl -X POST http://localhost:8000/ingest/documents \
  -F "files=@docs/api-reference.pdf" \
  -F "files=@diagrams/login-flow.png"

# Workflow B — ingest AOP directly
curl -X POST http://localhost:8000/ingest/aop \
  -H "Content-Type: application/json" \
  -d '{
    "dsl_source": "PROCEDURE LoginFlow BEGIN STEP auth: Authenticated(?u); END.",
    "metadata": {"source": "manual"}
  }'

# Workflow C — ingest a resolved conversation
curl -X POST http://localhost:8000/ingest/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "conversation": [
      {"role": "user", "content": "How do I reset my PIN?"},
      {"role": "agent", "content": "Go to Settings > Security > Change PIN."},
      {"role": "user", "content": "Thanks, that worked!"}
    ]
  }'

# Workflow D — ingest Jira tickets
curl -X POST http://localhost:8000/ingest/jira \
  -H "Content-Type: application/json" \
  -d '{"project_key": "BANK", "max_results": 50}'
```

### 4. Query

```bash
curl -X POST http://localhost:8000/query/ \
  -H "Content-Type: application/json" \
  -d '{"question": "How does the login flow work?", "top_k": 5}'
```

---

## Development

### Run locally (no Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # and fill in values

# Start PostgreSQL (e.g. via docker)
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=graphrag \
  -e POSTGRES_PASSWORD=graphrag_secret \
  -e POSTGRES_DB=graphrag \
  pgvector/pgvector:pg16

# Apply schema
psql -h localhost -U graphrag -d graphrag -f migrations/init.sql

# Run the API
uvicorn src.main:app --reload
```

### Run tests

```bash
pytest tests/ -v
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/ingest/documents` | Workflow A — document ingestion |
| POST | `/ingest/aop` | Workflow B — direct AOP/DSL ingestion |
| POST | `/ingest/conversation` | Workflow C — conversation ingestion |
| POST | `/ingest/jira` | Workflow D — Jira ticket ingestion |
| POST | `/query/` | RAG + DSL reasoning query |
| POST | `/query/retrieve` | Raw vector retrieval |
| GET | `/admin/contexts` | List graph contexts |
| GET | `/admin/contexts/{name}/nodes` | List nodes in a context |
| GET | `/admin/meta-graph` | Inspect meta-graph structure |
| POST | `/admin/dsl/parse` | Parse DSL source |
| POST | `/admin/dsl/simplify` | Parse and simplify DSL expression |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key |
| `POSTGRES_HOST` | `db` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `graphrag` | Database name |
| `POSTGRES_USER` | `graphrag` | Database user |
| `POSTGRES_PASSWORD` | `graphrag_secret` | Database password |
| `LLM_MODEL` | `models/gemini-1.5-pro` | Gemini model for reasoning |
| `EMBEDDING_MODEL` | `models/text-embedding-004` | Gemini embedding model |
| `LLM_TEMPERATURE` | `0.0` | LLM temperature (0 = deterministic) |
| `CHUNK_SIZE` | `512` | Document chunk size (tokens) |
| `CHUNK_OVERLAP` | `64` | Chunk overlap (tokens) |
| `DSL_MAX_DEDUCTION_STEPS` | `100` | Max DSL simplification steps |
| `JIRA_URL` | — | Jira instance URL (Workflow D) |
| `JIRA_USER` | — | Jira username (Workflow D) |
| `JIRA_TOKEN` | — | Jira API token (Workflow D) |
