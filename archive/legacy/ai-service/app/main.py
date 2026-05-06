from datetime import datetime, timezone
import json
from pathlib import Path
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

from .classifier import classify_query
from .generator import generate_answer
from .rag import TOP_K, load_documents, retrieve
from .safety import inject_disclaimer, is_advice_query, refusal_message

app = FastAPI(title="Legal Chatbot AI Service")
DOCS = []
LOG_PATH = Path(__file__).resolve().parents[1] / "logs" / "chat-events.jsonl"


class ChatRequest(BaseModel):
    question: str
    history: List[dict] = []
    domain: str = "general"


class Citation(BaseModel):
    source: str
    snippet: str | None = None


class RetrievedChunk(BaseModel):
    source: str
    snippet: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    confidence: str
    retrieved_chunks: List[RetrievedChunk]
    query_type: str


@app.on_event("startup")
def startup() -> None:
    global DOCS
    DOCS = load_documents()


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-service", "chunks": len(DOCS)}


def _confidence_from_chunks(chunks: List[dict]) -> str:
    if not chunks:
        return "Low"
    avg_score = sum(float(chunk.get("score", 0.0)) for chunk in chunks) / max(1, len(chunks))
    if avg_score >= 0.67:
        return "High"
    if avg_score >= 0.34:
        return "Medium"
    return "Low"


def _log_chat_event(
    question: str,
    answer: str,
    sources: List[dict],
    confidence: str,
    query_type: str,
) -> None:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "question": question,
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "query_type": query_type,
    }
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=True) + "\n")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    question = req.question.strip()
    if not question:
        return ChatResponse(
            answer="Please ask a question.",
            citations=[],
            confidence="Low",
            retrieved_chunks=[],
            query_type="legal_info",
        )

    history = req.history or []
    global DOCS
    if not DOCS:
        DOCS = load_documents()

    query_type = classify_query(question)

    if query_type == "greeting":
        answer = inject_disclaimer("Hello. I can help with UK legal information.")
        _log_chat_event(question, answer, [], "Low", query_type)
        return ChatResponse(
            answer=answer,
            citations=[],
            confidence="Low",
            retrieved_chunks=[],
            query_type=query_type,
        )

    if query_type == "advice_seeking" or is_advice_query(question):
        answer = inject_disclaimer(refusal_message())
        _log_chat_event(question, answer, [], "Low", query_type)
        return ChatResponse(
            answer=answer,
            citations=[],
            confidence="Low",
            retrieved_chunks=[],
            query_type="advice_seeking",
        )

    domain = (req.domain or "general").strip().lower()
    chunks = retrieve(question, DOCS, top_k=TOP_K, domain=domain)
    context = "\n".join(
        f"{chunk['source']} (chunk {chunk.get('chunk_id', '?')}): {chunk.get('snippet', '')}"
        for chunk in chunks
    )
    answer = inject_disclaimer(generate_answer(question, context, history))

    confidence = _confidence_from_chunks(chunks)
    citations = [{"source": chunk["source"], "snippet": chunk.get("snippet")} for chunk in chunks]
    retrieved_chunks = [
        {
            "source": chunk["source"],
            "snippet": chunk.get("snippet", ""),
            "score": float(chunk.get("score", 0.0)),
        }
        for chunk in chunks
    ]

    _log_chat_event(question, answer, citations, confidence, query_type)

    return ChatResponse(
        answer=answer,
        citations=[Citation(**c) for c in citations],
        confidence=confidence,
        retrieved_chunks=[RetrievedChunk(**c) for c in retrieved_chunks],
        query_type=query_type,
    )
