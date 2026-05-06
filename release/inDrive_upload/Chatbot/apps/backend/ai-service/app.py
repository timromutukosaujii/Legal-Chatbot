"""Flask-compatible entrypoint for a modular RAG chatbot service.

This module wires together:
- environment loading
- vector store bootstrapping
- retrieval-augmented generation pipeline
- lightweight safety/disclaimer response handling
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from ingestion import ingest_documents
from rag_pipeline import RAGPipeline
from vector_db import VectorStoreManager


def load_env_file(env_path: str = ".env") -> None:
    """Load KEY=VALUE pairs from .env without adding extra dependencies.

    Values already present in the process environment are not overwritten.
    """
    path = Path(env_path)
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def create_pipeline() -> RAGPipeline:
    """Create and configure the RAG pipeline from environment variables."""
    load_env_file(os.getenv("ENV_FILE", ".env"))

    docs_path = os.getenv("RAG_DOCS_PATH", "../../../../../../data/legal_documents")
    db_provider = os.getenv("VECTOR_DB_PROVIDER", "faiss")
    persist_dir = os.getenv("VECTOR_DB_PATH", "./vector_store")
    top_k = int(os.getenv("RAG_TOP_K", "4"))

    vector_store_manager = VectorStoreManager(provider=db_provider, persist_dir=persist_dir)

    if not vector_store_manager.has_index():
        chunks = ingest_documents(docs_path=docs_path)
        vector_store_manager.build_from_documents(chunks)

    return RAGPipeline(vector_store_manager=vector_store_manager, top_k=top_k)


def _build_disclaimer_response(query: str) -> str:
    """Return a consistent legal-safety disclaimer for all responses."""
    base = (
        "This assistant provides general legal information only, not legal advice. "
        "For urgent, high-risk, or case-specific matters, speak to a qualified solicitor."
    )
    if any(token in query.lower() for token in ["urgent", "arrest", "deport", "eviction", "court"]):
        return f"{base} If there is immediate risk, contact emergency or legal aid services now."
    return base


def create_app() -> Any:
    """Create a Flask app.

    Flask is optional at import-time so this module remains importable in environments
    where only FastAPI is installed.
    """
    try:
        from flask import Flask, jsonify, request
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "Flask is required to run app.py. Install it with `pip install flask`."
        ) from exc

    app = Flask(__name__)
    pipeline = create_pipeline()

    @app.get("/health")
    def health() -> Any:
        return jsonify({"status": "ok"})

    @app.post("/chat")
    def chat() -> Any:
        payload: Dict[str, Any] = request.get_json(silent=True) or {}
        question = (payload.get("question") or "").strip()
        if not question:
            return jsonify({"error": "`question` is required"}), 400

        result = pipeline.answer(question)
        result["disclaimer"] = _build_disclaimer_response(question)
        return jsonify(result)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")), debug=False)
