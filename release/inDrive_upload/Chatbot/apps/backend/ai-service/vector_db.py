"""Vector database abstraction for FAISS/Chroma via LangChain.

This wrapper keeps the rest of the system independent from a specific backend.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings


class VectorStoreManager:
    """Manage vector index lifecycle and retrieval backend selection."""

    def __init__(self, provider: str = "faiss", persist_dir: str = "./vector_store") -> None:
        self.provider = provider.lower()
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)

        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required for embedding generation.")

        self.embeddings = OpenAIEmbeddings(
            api_key=api_key,
            model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        )
        self._store = None

    def has_index(self) -> bool:
        """Best-effort check for existing persisted index files."""
        if self.provider == "chroma":
            return any(self.persist_dir.glob("*.sqlite3")) or any(self.persist_dir.glob("index/*"))
        return any(self.persist_dir.glob("*.faiss")) or any(self.persist_dir.glob("*.pkl"))

    def build_from_documents(self, docs: List[Document]) -> None:
        """Create and persist an index from document chunks."""
        if not docs:
            return

        if self.provider == "chroma":
            from langchain_chroma import Chroma

            self._store = Chroma.from_documents(
                documents=docs,
                embedding=self.embeddings,
                persist_directory=str(self.persist_dir),
            )
        else:
            from langchain_community.vectorstores import FAISS

            self._store = FAISS.from_documents(docs, self.embeddings)
            self._store.save_local(str(self.persist_dir))

    def load(self) -> None:
        """Load an existing vector store from disk."""
        if self.provider == "chroma":
            from langchain_chroma import Chroma

            self._store = Chroma(
                persist_directory=str(self.persist_dir),
                embedding_function=self.embeddings,
            )
        else:
            from langchain_community.vectorstores import FAISS

            self._store = FAISS.load_local(
                folder_path=str(self.persist_dir),
                embeddings=self.embeddings,
                allow_dangerous_deserialization=True,
            )

    def as_retriever(self, k: int = 4):
        """Expose a LangChain retriever configured for top-k nearest neighbors."""
        if self._store is None:
            self.load()
        return self._store.as_retriever(search_kwargs={"k": k})
