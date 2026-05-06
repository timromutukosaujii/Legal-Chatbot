"""RAG pipeline with retrieval, generation, citations, and basic safety checks."""

from __future__ import annotations

from typing import Any, Dict, List

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from vector_db import VectorStoreManager


SYSTEM_PROMPT = (
    "You are a legal information assistant. Use the provided context to answer accurately. "
    "If context is insufficient, say what is missing. Do not claim to provide legal advice."
)


class RAGPipeline:
    """End-to-end retrieval-augmented generation pipeline."""

    def __init__(self, vector_store_manager: VectorStoreManager, top_k: int = 4) -> None:
        self.vector_store_manager = vector_store_manager
        self.retriever = vector_store_manager.as_retriever(k=top_k)
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", SYSTEM_PROMPT),
                (
                    "human",
                    "Question: {question}\n\n"
                    "Context:\n{context}\n\n"
                    "Return a concise answer grounded in the context.",
                ),
            ]
        )

    def _is_blocked(self, question: str) -> bool:
        """Simple guardrail for disallowed harmful requests."""
        blocked_terms = ["how to hurt", "build bomb", "kill someone", "evade police"]
        q = question.lower()
        return any(term in q for term in blocked_terms)

    @staticmethod
    def _format_context(chunks) -> str:
        return "\n\n".join(chunk.page_content for chunk in chunks)

    @staticmethod
    def _extract_sources(chunks) -> List[Dict[str, Any]]:
        sources: List[Dict[str, Any]] = []
        for idx, chunk in enumerate(chunks, start=1):
            src = chunk.metadata.get("source", "unknown")
            sources.append({"id": idx, "source": src})
        return sources

    def answer(self, question: str) -> Dict[str, Any]:
        """Generate answer with cited sources for the user question."""
        if self._is_blocked(question):
            return {
                "answer": "I cannot assist with harmful or illegal activity.",
                "sources": [],
            }

        chunks = self.retriever.invoke(question)
        context = self._format_context(chunks)

        chain = self.prompt | self.llm
        response = chain.invoke({"question": question, "context": context})

        return {
            "answer": response.content,
            "sources": self._extract_sources(chunks),
            "top_k": len(chunks),
        }
