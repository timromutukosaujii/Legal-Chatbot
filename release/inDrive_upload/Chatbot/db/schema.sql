-- Starter schema for future PostgreSQL + pgvector integration.

CREATE TABLE IF NOT EXISTS legal_documents (
  id SERIAL PRIMARY KEY,
  source_title TEXT NOT NULL,
  source_url TEXT,
  chunk_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
