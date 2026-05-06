import os
import re
from pathlib import Path
from typing import Dict, List

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "legal_documents"
DATA_DIR = Path(os.getenv("LEGAL_DOCS_DIR", DEFAULT_DATA_DIR))

CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "80"))
TOP_K = int(os.getenv("RAG_TOP_K", "3"))
STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "what",
    "when",
    "where",
    "which",
    "how",
    "can",
    "could",
    "should",
    "would",
    "about",
    "do",
    "is",
    "to",
    "of",
    "on",
    "in",
    "at",
    "it",
    "into",
    "have",
    "has",
    "had",
    "are",
    "was",
    "were",
    "your",
    "my",
    "their",
    "our",
    "you",
    "they",
    "does",
    "did",
    "rights",
    "right",
}

DOMAIN_BY_SOURCE = {
    "immigration": ["visa", "immigration", "citizenship", "ilr", "asylum", "eta"],
    "employment": ["worker_rights", "employee_rights", "employment"],
    "tenancy": ["tenant", "tenancy", "renting"],
    "human_rights": ["human_rights", "hra_", "equality_act", "article10", "expression"],
}


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z0-9]{2,}", text.lower())


def _chunk_words(words: List[str], chunk_size: int, overlap: int) -> List[List[str]]:
    if not words:
        return []
    step = max(1, chunk_size - overlap)
    chunks = []
    for i in range(0, len(words), step):
        chunk = words[i : i + chunk_size]
        if not chunk:
            continue
        chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
    return chunks


def _domain_for_source(source: str) -> str:
    name = (source or "").lower()
    for domain, markers in DOMAIN_BY_SOURCE.items():
        if any(marker in name for marker in markers):
            return domain
    return "general"


def load_documents() -> List[Dict[str, str]]:
    chunks: List[Dict[str, str]] = []
    if not DATA_DIR.exists():
        return chunks

    for path in DATA_DIR.glob("*.txt"):
        content = path.read_text(encoding="utf-8", errors="ignore")
        words = content.split()
        for idx, word_chunk in enumerate(_chunk_words(words, CHUNK_SIZE, CHUNK_OVERLAP), start=1):
            chunk_text = " ".join(word_chunk).strip()
            if not chunk_text:
                continue
            snippet = chunk_text[:600]
            chunks.append(
                {
                    "source": path.name,
                    "domain": _domain_for_source(path.name),
                    "chunk_id": str(idx),
                    "content": chunk_text,
                    "match_tokens": _tokenize(chunk_text),
                    "snippet": snippet,
                }
            )
    return chunks


def retrieve(
    query: str,
    docs: List[Dict[str, str]],
    top_k: int = TOP_K,
    domain: str = "general",
) -> List[Dict[str, str]]:
    raw_query_tokens = _tokenize(query)
    filtered_query_tokens = [token for token in raw_query_tokens if token not in STOPWORDS]
    query_tokens = set(filtered_query_tokens or raw_query_tokens)
    if not docs:
        return []
    scoped_docs = docs
    if domain and domain != "general":
        matching = [doc for doc in docs if doc.get("domain") == domain]
        if matching:
            scoped_docs = matching
    if not query_tokens:
        return [
            {
                "source": doc["source"],
                "chunk_id": doc.get("chunk_id"),
                "snippet": doc.get("snippet", "")[:300],
                "score": 0.0,
            }
            for doc in scoped_docs[:top_k]
        ]

    scored = []
    for doc in scoped_docs:
        doc_tokens = set(doc.get("match_tokens") or _tokenize(doc.get("content", "")))
        if not doc_tokens:
            continue
        overlap = len(query_tokens.intersection(doc_tokens))
        if overlap == 0:
            continue
        coverage = overlap / max(1, len(query_tokens))
        precision = overlap / max(1, len(doc_tokens))
        score = (0.8 * coverage) + (0.2 * precision)
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
