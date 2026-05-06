import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

import { loadLegalDocuments } from "./services/documentLoader.js";
import { chunkDocuments } from "./services/chunker.js";
import { Retriever } from "./services/retriever.js";
import {
  generateEmbedding,
  generateEmbeddingsForChunks,
  generateGroundedAnswer,
  hasOpenAIKey
} from "./services/openaiClient.js";
import { detectPersonalAdviceRequest, ADVICE_DISCLAIMER } from "./services/safety.js";
import { buildCitations, formatContextBlocks } from "./services/citations.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3001);
const LEGAL_DOCS_DIR =
  process.env.LEGAL_DOCS_DIR || path.resolve("..", "..", "..", "data", "legal_documents");
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 5);
const RAG_CHUNK_SIZE_WORDS = Number(process.env.RAG_CHUNK_SIZE_WORDS || 600);
const RAG_CHUNK_OVERLAP_WORDS = Number(process.env.RAG_CHUNK_OVERLAP_WORDS || 80);

const LEGAL_SCOPE_HINT =
  "This chatbot is limited to UK legal and human-rights public information in local sources.";

const state = {
  docsWarning: null,
  documents: [],
  chunks: [],
  retriever: new Retriever({ topK: RAG_TOP_K }),
  embeddingsEnabled: false
};

async function rebuildKnowledgeBase() {
  const { documents, warning } = loadLegalDocuments(LEGAL_DOCS_DIR);
  const chunks = chunkDocuments(documents, {
    chunkSizeWords: RAG_CHUNK_SIZE_WORDS,
    chunkOverlapWords: RAG_CHUNK_OVERLAP_WORDS
  });

  state.docsWarning = warning;
  state.documents = documents;
  state.chunks = chunks;
  state.retriever.setChunks(chunks);

  // Best-effort embedding mode. If unavailable, retriever falls back to keyword search.
  const embeddings = await generateEmbeddingsForChunks(chunks);
  state.retriever.setEmbeddings(embeddings);
  state.embeddingsEnabled = embeddings.size > 0;

  return {
    documents: documents.length,
    chunks: chunks.length,
    embeddingsEnabled: state.embeddingsEnabled,
    warning
  };
}

function isInLegalScope(message) {
  const q = String(message || "").toLowerCase();
  return /(uk|legal|law|rights|human rights|tenant|employment|visa|immigration|equality|tribunal|court)/i.test(
    q
  );
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "node-api",
    scope: "uk-legal-human-rights-rag",
    docsDir: LEGAL_DOCS_DIR,
    documents: state.documents.length,
    chunks: state.chunks.length,
    embeddingsEnabled: state.embeddingsEnabled,
    openaiConfigured: hasOpenAIKey(),
    warning: state.docsWarning
  });
});

app.post("/api/admin/reload-docs", async (_req, res) => {
  try {
    const stats = await rebuildKnowledgeBase();
    return res.json({ ok: true, ...stats, docsDir: LEGAL_DOCS_DIR });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Failed to reload documents." });
  }
});

app.post("/api/chat", async (req, res) => {
  const message = String(req.body?.message || req.body?.question || "").trim();
  const topK = Number(req.body?.topK || RAG_TOP_K);

  if (!message) {
    return res.status(400).json({ error: "`message` is required." });
  }

  if (!isInLegalScope(message)) {
    return res.json({
      answer: `${LEGAL_SCOPE_HINT} Please ask a UK legal or human-rights question.`,
      citations: [],
      retrievedChunks: [],
      retrieved_chunks: [],
      confidence: "Low",
      query_type: "legal_info",
      safetyTriggered: false
    });
  }

  if (!state.chunks.length) {
    return res.json({
      answer:
        "I cannot answer confidently from the provided legal sources because no dataset is loaded. Check data/legal_documents/.",
      citations: [],
      retrievedChunks: [],
      retrieved_chunks: [],
      confidence: "Low",
      query_type: "legal_info",
      safetyTriggered: false
    });
  }

  const safetyTriggered = detectPersonalAdviceRequest(message);

  let queryEmbedding = null;
  try {
    queryEmbedding = await generateEmbedding(message);
  } catch {
    queryEmbedding = null;
  }

  const retrievedChunks = state.retriever.retrieve(message, topK, queryEmbedding);
  const contextBlocks = formatContextBlocks(retrievedChunks);
  const citations = buildCitations(retrievedChunks);

  let answer = "I cannot answer confidently from the provided legal sources.";
  if (retrievedChunks.length > 0) {
    answer = await generateGroundedAnswer({
      message,
      contextBlocks,
      safetyInstruction: safetyTriggered ? ADVICE_DISCLAIMER : ""
    });
  }

  if (safetyTriggered) {
    answer = `${answer}\n\n${ADVICE_DISCLAIMER}`;
  }

  const normalizedRetrieved = retrievedChunks.map((chunk) => ({
    source: chunk?.metadata?.source || chunk?.metadata?.title || "Unknown source",
    snippet: String(chunk?.text || "").slice(0, 260),
    score: chunk.score,
    text: chunk.text,
    metadata: chunk.metadata
  }));

  return res.json({
    answer,
    citations,
    confidence: retrievedChunks.length ? "Medium" : "Low",
    query_type: "legal_info",
    queryType: "legal_info",
    retrievedChunks: normalizedRetrieved,
    retrieved_chunks: normalizedRetrieved,
    safetyTriggered
  });
});

rebuildKnowledgeBase()
  .then((stats) => {
    console.log("[startup] RAG KB loaded", stats);
    app.listen(PORT, () => {
      console.log(`Node API listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("[startup] Failed to initialize RAG knowledge base", error);
    app.listen(PORT, () => {
      console.log(`Node API listening on port ${PORT} (with empty knowledge base)`);
    });
  });
