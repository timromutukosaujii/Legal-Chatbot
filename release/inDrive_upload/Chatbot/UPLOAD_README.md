# Upload Package (inDrive)

This folder is cleaned for upload and excludes generated dependencies/caches.

## Included
- Source code (frontend + backend + AI service)
- Data documents
- Docs and evaluation files
- Config examples (`.env.example`)

## Excluded
- `node_modules`
- `.venv`
- `__pycache__`
- build outputs (`dist`)
- logs
- local archive/release folders

## Run After Download
1. Backend Node API:
   - `cd apps/backend/node-api`
   - `npm install`
   - `npm run dev`
2. Backend AI service:
   - `cd apps/backend/ai-service`
   - `python -m venv .venv`
   - `.\\.venv\\Scripts\\python -m pip install -r requirements.txt`
   - `.\\.venv\\Scripts\\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
3. Frontend:
   - `cd apps/frontend/react-chat-ui`
   - `npm install`
   - `npm run dev -- --host 0.0.0.0 --port 5173`

Open: `http://127.0.0.1:5173`
