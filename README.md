# Adhikar: UK Constitutional and Human-Rights Legal Assistant

Adhikar is a retrieval-augmented legal information assistant focused on UK constitutional and human-rights law.  
It provides source-grounded explanations in plain English and does **not** provide personalised legal advice.

## Core Capabilities

- UK legal Q&A grounded in local legal text sources
- Intent-aware conversation flow (`casual`, `assistant_meta`, `legal_question`, `unsafe_advice`)
- Follow-up understanding for prompts like `summarize`, `explain it`, `bullet points`
- Response style control (`concise`, `bullet`, `detailed`, `overview`)
- Safety filtering for personalised legal-advice requests
- Citation support with concise source cards
- Modern responsive chat UI (light/dark mode, sidebar history, attachments)

## Academic Contribution Summary

This project demonstrates a practical applied AI pipeline combining:

- pre-trained LLM generation,
- retrieval-augmented generation (RAG),
- domain restriction and scope control,
- conversational memory and follow-up rewriting,
- safety refusal behavior for advice-seeking prompts,
- and source-grounded responses for explainability.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- LLM + Embeddings: OpenAI Responses API + OpenAI Embeddings API
- Knowledge base: local `.txt` legal documents in `data/legal_documents`

## Project Structure

```text
apps/
  frontend/react-chat-ui
  backend/node-api
data/legal_documents
docs
archive/legacy (backup/legacy only)
```

## System Architecture

```text
React Chat UI
    |
    | HTTP /api/chat
    v
Node API (Express)
    |
    |-- Intent + safety + follow-up handling
    |-- Local retrieval over legal_documents
    '-- OpenAI grounded answer generation
```

## Safety and Scope

- General legal information only
- No personalised legal advice
- No case-outcome prediction
- Unsafe legal-advice prompts are handled with safe refusal + general guidance
- Out-of-domain prompts are redirected as out-of-scope

For policy details, see [docs/ethics-safety.md](/c:/Sital/Chatbot/docs/ethics-safety.md).

## Run Locally (Windows PowerShell)

### Quick start (systematic dev workflow)

From project root:

```powershell
npm run dev:start
npm run dev:health
```

Stop services:

```powershell
npm run dev:stop
```

## 1) Start backend

```powershell
cd C:\Sital\Chatbot\apps\backend\node-api
npm install
node src/index.js
```

Health endpoint:

`http://127.0.0.1:3001/health`

## 2) Start frontend

```powershell
cd C:\Sital\Chatbot\apps\frontend\react-chat-ui
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Frontend URL:

`http://127.0.0.1:5174`

## 3) Update knowledge base docs

Place or edit files in:

`data/legal_documents`

Then reload:

- restart backend, or
- call `POST /api/admin/reload-docs`

## Environment Variables

Frontend (`apps/frontend/react-chat-ui/.env`):

- `VITE_BACKEND_NODE_URL=http://127.0.0.1:3001`

Backend (`apps/backend/node-api/.env`):

- `PORT=3001`
- `LEGAL_DOCS_DIR=../../../data/legal_documents`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-4o-mini`
- `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- `RAG_TOP_K=5`
- `RAG_MIN_SIMILARITY=0.26`

## Demo Tips

- Ask legal question: `What does Article 8 protect?`
- Ask follow-up: `summarize` or `bullet points`
- Ask assistant-meta: `How can you help me?`
- Ask unsafe advice: `Should I sue my employer?`

## Documentation

- Ethics and safety: [docs/ethics-safety.md](/c:/Sital/Chatbot/docs/ethics-safety.md)
- Timeline: [docs/timeline.md](/c:/Sital/Chatbot/docs/timeline.md)
- Project structure: [docs/project-structure.md](/c:/Sital/Chatbot/docs/project-structure.md)
