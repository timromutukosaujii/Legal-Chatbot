import os
import re
from pathlib import Path
from typing import Dict, List

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "legal_documents"
DATA_DIR = Path(os.getenv("LEGAL_DOCS_DIR", DEFAULT_DATA_DIR))

CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "80"))
TOP_K = int(os.getenv("RAG_TOP_K", "3"))


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z]{2,}", text.lower())


def _chunk_tokens(tokens: List[str], chunk_size: int, overlap: int) -> List[List[str]]:
    if not tokens:
        return []
    step = max(1, chunk_size - overlap)
    chunks = []
    for i in range(0, len(tokens), step):
        chunk = tokens[i : i + chunk_size]
        if not chunk:
            continue
        chunks.append(chunk)
        if i + chunk_size >= len(tokens):
            break
    return chunks


def load_documents() -> List[Dict[str, str]]:
    chunks: List[Dict[str, str]] = []
    if not DATA_DIR.exists():
        return chunks

    for path in DATA_DIR.glob("*.txt"):
        content = path.read_text(encoding="utf-8", errors="ignore")
        tokens = _tokenize(content)
        for idx, token_chunk in enumerate(_chunk_tokens(tokens, CHUNK_SIZE, CHUNK_OVERLAP), start=1):
            snippet = " ".join(token_chunk)[:600]
            chunks.append(
                {
                    "source": path.name,
                    "chunk_id": str(idx),
                    "content": " ".join(token_chunk),
                    "snippet": snippet,
                }
            )
    return chunks


def retrieve(query: str, docs: List[Dict[str, str]], top_k: int = TOP_K) -> List[Dict[str, str]]:
    query_tokens = set(_tokenize(query))
    if not docs:
        return []
    if not query_tokens:
        return [
            {
                "source": doc["source"],
                "chunk_id": doc.get("chunk_id"),
                "snippet": doc.get("snippet", "")[:300],
                "score": 0.0,
            }
            for doc in docs[:top_k]
        ]

    scored = []
    for doc in docs:
        doc_tokens = set(_tokenize(doc.get("content", "")))
        if not doc_tokens:
            continue
        overlap = len(query_tokens.intersection(doc_tokens))
        score = overlap / max(1, len(query_tokens))
        scored.append(
            {
                "source": doc["source"],
                "chunk_id": doc.get("chunk_id"),
                "snippet": doc.get("snippet", "")[:300],
                "score": round(score, 3),
            }
        )

    scored.sort(key=lambda d: d["score"], reverse=True)
    return scored[:top_k]
