# Lawyer GPT (UK Legal Information Chatbot)

Lawyer GPT is a UK legal information chatbot that provides **general information** (not legal advice). It retrieves from public documents and returns plain‑language answers with references shown separately.

## Features

- Friendly chat UI with suggestions and disclaimer
- Chat history + multiple sessions (stored in browser)
- Follow‑up questions supported by passing recent history
- Safety: refuses personalised legal advice
- References shown in a separate section

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript, React (Vite)
- **API Gateway:** Node.js + Express
- **AI Service:** Python + FastAPI

## Project Structure

```
apps/
  frontend/react-chat-ui
  backend/node-api
  backend/ai-service
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
     | request
     v
Python AI Service (FastAPI)
     |
     |-- Document retrieval
     |
     '-- Answer + references
```

## Safety & Disclaimer

- Informational only, no personalised legal advice
- Refuses case‑specific strategy requests
- References shown separately from answers

See `docs/ethics-safety.md` for details.

## Run Locally (Windows PowerShell)

### 1) AI Service (FastAPI)

```powershell
cd C:\Sital\Chatbot\apps\backend\ai-service
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Check health:

```
http://127.0.0.1:8000/health
```

### 2) Node API

```powershell
cd C:\Sital\Chatbot\apps\backend\node-api
npm install
npm run dev
```

Check health:

```
http://127.0.0.1:3001/health
```

### 3) Frontend

```powershell
cd C:\Sital\Chatbot\apps\frontend\react-chat-ui
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

- `http://127.0.0.1:5173`

## Environment Variables

- **Frontend:** `apps/frontend/react-chat-ui/.env.example`
  - `VITE_BACKEND_NODE_URL=http://127.0.0.1:3001`
- **Node API:** `apps/backend/node-api/.env.example`
  - `AI_SERVICE_URL=http://127.0.0.1:8000`
- **AI Service (optional):**
  - `LEGAL_DOCS_DIR` to override the document path

## Knowledge Base

Add public UK legal documents in:

```
data/legal_documents
```

Restart the AI service after updating documents.

## Evaluation

Basic evaluation script:

```powershell
python apps/backend/ai-service/scripts/evaluate.py
```

## Docs

- Ethics & safety: `docs/ethics-safety.md`
- Timeline: `docs/timeline.md`
- Structure notes: `docs/project-structure.md`
