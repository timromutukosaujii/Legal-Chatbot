# Project Structure

## Active Application (Use This)

- `apps/frontend/react-chat-ui`: React chat UI.
- `apps/backend/node-api`: Express API with RAG retrieval and OpenAI generation.
- `data/legal_documents`: Retrieval source text files.

## Support Files

- `db/schema.sql`: Draft schema for future database migration.
- `docs/ethics-safety.md`: Safety and policy notes.
- `docs/timeline.md`: Delivery timeline notes.

## Legacy / Archive

- `archive/legacy/ai-service`: Legacy Python service retained for reference.
- `archive/legacy/*`: Old scaffolds/prototypes.
- `release/*`: Snapshot/export bundles.

## Recommended Working Rule

For daily development, work mainly in:

1. `apps/frontend/react-chat-ui`
2. `apps/backend/node-api`
3. `data/legal_documents`
