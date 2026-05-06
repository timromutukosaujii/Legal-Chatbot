"""Document ingestion pipeline for RAG.

Responsibilities:
- read raw files from disk
- split documents into semantic chunks
- return LangChain Document objects for embedding
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def _iter_text_files(root: Path) -> Iterable[Path]:
    """Yield text-like files that are suitable for lightweight ingestion."""
    allowed = {".txt", ".md", ".csv", ".json"}
    for file_path in root.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in allowed:
            yield file_path


def _load_documents(root: Path) -> List[Document]:
    """Load files into LangChain Document objects with source metadata."""
    documents: List[Document] = []
    for file_path in _iter_text_files(root):
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        if not text.strip():
            continue
        documents.append(Document(page_content=text, metadata={"source": str(file_path)}))
    return documents


def ingest_documents(
    docs_path: str,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> List[Document]:
    """Ingest and chunk documents for downstream embedding.

    Args:
        docs_path: Root folder containing source files.
        chunk_size: Max characters per chunk.
        chunk_overlap: Overlap between adjacent chunks to preserve context.
    """
    root = Path(docs_path)
    if not root.exists():
        raise FileNotFoundError(f"Document path does not exist: {docs_path}")

    raw_documents = _load_documents(root)
    if not raw_documents:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(raw_documents)
