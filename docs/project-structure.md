# Project Structure

## Systematic Order

1. `apps/`: runnable application code only
2. `data/`: legal documents and evaluation inputs
3. `docs/`: project documentation and methodology
4. `db/`: schema and data-layer assets
5. `archive/`: legacy code kept only for reference
6. `release/`: packaging/export snapshots

## Active Application (Use This)

- `apps/frontend/react-chat-ui`: React chat UI.
- `apps/backend/node-api`: Express API with RAG retrieval and OpenAI generation.
- `data/legal_documents`: Retrieval source text files.

## Keep Root Clean

- Keep only top-level project files in root (`README.md`, `docker-compose.yml`, scripts, `.gitignore`).
- Do not keep generated logs, temporary outputs, or duplicate snapshots in root.
- Put historical code in `archive/` and distribution bundles in `release/`.
