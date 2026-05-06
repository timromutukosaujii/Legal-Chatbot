# Project Structure

## Active Application (Use This)

- `apps/frontend/react-chat-ui`: React chat interface (desktop + mobile).
- `apps/backend/node-api`: Node.js + Express + Socket.io API gateway.
- `apps/backend/ai-service`: FastAPI RAG/LLM backend.
- `data/legal_documents`: UK legal source summaries used by retrieval.

## Backward-Compatible Shortcuts

- `frontend` -> `apps/frontend`
- `backend-node` -> `apps/backend/node-api`
- `ai-backend` -> `apps/backend/ai-service`
- `llm-service` -> `archive/legacy/llm-service`
- `api-gateway` -> `archive/legacy/api-gateway`

## Documentation

- `docs/methodology`: FYP write-up documents.
- `docs/ethics-safety.md`: safety and policy notes.

## Supporting/Experimental Modules

- `archive/legacy/frontend-scaffold`: older frontend scaffold.
- `archive/legacy/api-gateway`: alternate gateway prototype.
- `archive/legacy/llm-service`: alternate Python service prototype.

## Recommended Working Rule

For daily development, run and edit only:

1. `apps/frontend/react-chat-ui`
2. `apps/backend/node-api`
3. `apps/backend/ai-service`
