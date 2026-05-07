# Lawyer GPT (UK Legal Information Chatbot)

Lawyer GPT is a UK legal information chatbot that provides general legal information (not personalised legal advice). It retrieves relevant legal-document snippets and returns plain-language answers with citations.

## Features

- React chat UI with conversation history
- Node.js backend with retrieval + OpenAI generation
- Domain-aware retrieval (tenancy, employment, immigration, human rights, general)
- Safety refusal for personalised legal advice/case strategy
- Citations, confidence, and retrieved chunks in API response

## Tech Stack

- Frontend: React + Vite
- Backend API + AI: Node.js + Express + OpenAI Responses API
- Data source: `data/legal_documents/*.txt`

## Project Structure

```text
apps/
  frontend/react-chat-ui
  backend/node-api
archive/legacy/ai-service (legacy, not required for current runtime)
data/legal_documents
docs/
archive/legacy (backup only)
```

## Architecture

```text
React Chat UI
     |
     | HTTP
     v
Node.js + Express API
     |
     |-- Local retrieval from data/legal_documents
     |
     '-- OpenAI answer generation + citations
```

## Safety & Disclaimer

- Informational only (no personalised legal advice)
- Refuses case-specific action guidance
- Includes disclaimer text in answers

See `docs/ethics-safety.md` for policy context.

## Run Locally (Windows PowerShell)

### 1) Node API

```powershell
cd C:\Sital\Chatbot\apps\backend\node-api
npm install
npm run dev
```

Health check:

```text
http://127.0.0.1:3001/health
```

Reload legal docs after edits/additions:

```text
POST http://127.0.0.1:3001/api/admin/reload-docs
```

### 2) Frontend

```powershell
cd C:\Sital\Chatbot\apps\frontend\react-chat-ui
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

- `http://127.0.0.1:5173`

## Environment Variables

- Frontend: `apps/frontend/react-chat-ui/.env.example`
  - `VITE_BACKEND_NODE_URL=http://127.0.0.1:3001`
- Node API: `apps/backend/node-api/.env.example`
  - `PORT=3001`
  - `LEGAL_DOCS_DIR=../../../data/legal_documents`
  - `OPENAI_API_KEY=...` (required for OpenAI generation)
  - `OPENAI_MODEL=gpt-4o-mini`
  - `RAG_TOP_K=3`
  - `RAG_MIN_RELEVANCE_SCORE=0.45`

## Knowledge Base

Add public UK legal documents in:

```text
data/legal_documents
```

Restart Node API or call `/api/admin/reload-docs` after updates.

## Docs

- Ethics & safety: `docs/ethics-safety.md`
- Timeline: `docs/timeline.md`
- Structure notes: `docs/project-structure.md`
