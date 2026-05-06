import crypto from "crypto";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

import { loadLegalDocuments } from "./services/documentLoader.js";
import { chunkDocuments } from "./services/chunker.js";
import { Retriever, hasSufficientSources, retrievalConfidence } from "./services/retriever.js";
import {
  generateEmbedding,
  generateEmbeddingsForChunks,
  generateGroundedAnswer,
  createStreamChunks,
  hasOpenAIKey
} from "./services/openaiClient.js";
import {
  detectPersonalAdviceRequest,
  ADVICE_DISCLAIMER,
  toGeneralInfoStyle
} from "./services/safety.js";
import { buildCitations, formatContextBlocks } from "./services/citations.js";
import { checkScope, OUT_OF_SCOPE_MESSAGE } from "./services/scopeChecker.js";
import {
  appendChatHistory,
  appendConversation,
  getConversation,
  sanitizeHistoryForPrompt
} from "./services/historyStore.js";
import { logComparisonEvent } from "./services/evalLogger.js";

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

const INSUFFICIENT_SOURCES_MESSAGE =
  "I could not find enough information in the legal knowledge base to answer this confidently.";

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

function detectAnswerType({ scope, safetyTriggered, citations, question }) {
  if (scope === "out_of_scope") return "out_of_scope";
  if (safetyTriggered) return "safety_refusal";
  if (!Array.isArray(citations) || citations.length === 0) return "insufficient_sources";

  const text = String(question || "").toLowerCase();
  if (/\b(human rights|echr|hra|udhr|article\s*\d+)\b/i.test(text)) {
    return "human_rights_explanation";
  }
  if (/\b(constitution|constitutional|separation of powers|supreme court|magna carta)\b/i.test(text)) {
    return "constitutional_information";
  }
  return "legal_information";
}

function buildFollowUps(retrievedChunks) {
  const topicText = (retrievedChunks || [])
    .map((c) => `${c?.metadata?.topic || ""} ${c?.metadata?.title || ""}`)
    .join(" ")
    .toLowerCase();

  if (topicText.includes("equality") || topicText.includes("discrimination")) {
    return [
      "In general, what counts as direct discrimination under the Equality Act 2010?",
      "What is the difference between direct and indirect discrimination?",
      "Where can I read the official Equality Act source?"
    ];
  }

  if (topicText.includes("constitutional") || topicText.includes("magna carta")) {
    return [
      "In general, what is judicial independence in the UK system?",
      "How did the Constitutional Reform Act 2005 change the Supreme Court structure?",
      "Where can I read the official constitutional source?"
    ];
  }

  return [
    "What does Article 8 protect?",
    "When can a public authority interfere with this right?",
    "Where can I read the official source?"
  ];
}

function makeResponse({
  conversationId,
  answer,
  citations,
  retrievedChunks,
  confidence,
  scope,
  answerType,
  safetyTriggered,
  suggestedFollowUps
}) {
  return {
    conversationId,
    answer,
    citations,
    retrievedChunks,
    confidence,
    scope,
    answerType,
    safetyTriggered,
    suggestedFollowUps,
    // Legacy compatibility for existing frontend components
    retrieved_chunks: retrievedChunks,
    query_type: answerType,
    queryType: answerType
  };
}

function sendStreamedResponse(res, payload) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chunks = createStreamChunks(payload.answer, 90);
  for (const delta of chunks) {
    res.write(`event: answer_delta\n`);
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }

  res.write(`event: done\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  res.end();
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
  const conversationId = String(req.body?.conversationId || crypto.randomUUID());
  const topK = Number(req.body?.topK || RAG_TOP_K);
  const stream = Boolean(req.body?.stream);

  if (!message) {
    return res.status(400).json({ error: "`message` is required." });
  }

  try {
    const scopeCheck = checkScope(message);
    const safetyTriggered = detectPersonalAdviceRequest(message);

    if (!scopeCheck.inScope) {
      const payload = makeResponse({
        conversationId,
        answer: OUT_OF_SCOPE_MESSAGE,
        citations: [],
        retrievedChunks: [],
        confidence: "low",
        scope: "out_of_scope",
        answerType: "out_of_scope",
        safetyTriggered,
        suggestedFollowUps: []
      });
      logComparisonEvent({
        question: message,
        retrievedSourceTitles: [],
        confidence: payload.confidence,
        answerType: payload.answerType,
        safetyTriggered,
        scope: payload.scope
      });
      return stream ? sendStreamedResponse(res, payload) : res.json(payload);
    }

    if (!state.chunks.length) {
      const payload = makeResponse({
        conversationId,
        answer: INSUFFICIENT_SOURCES_MESSAGE,
        citations: [],
        retrievedChunks: [],
        confidence: "low",
        scope: "in_scope",
        answerType: "insufficient_sources",
        safetyTriggered,
        suggestedFollowUps: []
      });
      logComparisonEvent({
        question: message,
        retrievedSourceTitles: [],
        confidence: payload.confidence,
        answerType: payload.answerType,
        safetyTriggered,
        scope: payload.scope
      });
      return stream ? sendStreamedResponse(res, payload) : res.json(payload);
    }

    let queryEmbedding = null;
    try {
      queryEmbedding = await generateEmbedding(message);
    } catch {
      queryEmbedding = null;
    }

    const retrievedRaw = state.retriever.retrieve(message, topK, queryEmbedding);
    const sufficient = hasSufficientSources(retrievedRaw);
    const confidence = retrievalConfidence(retrievedRaw);

    const retrievedChunks = retrievedRaw.map((chunk) => ({
      source: chunk?.metadata?.source || chunk?.metadata?.title || "Unknown source",
      snippet: String(chunk?.text || "").slice(0, 260),
      score: chunk.score,
      text: chunk.text,
      metadata: chunk.metadata
    }));

    const citations = buildCitations(retrievedRaw);

    if (!sufficient) {
      const payload = makeResponse({
        conversationId,
        answer: INSUFFICIENT_SOURCES_MESSAGE,
        citations: [],
        retrievedChunks,
        confidence: "low",
        scope: "in_scope",
        answerType: "insufficient_sources",
        safetyTriggered,
        suggestedFollowUps: buildFollowUps(retrievedRaw)
      });
      logComparisonEvent({
        question: message,
        retrievedSourceTitles: citations.map((c) => c.title),
        confidence: payload.confidence,
        answerType: payload.answerType,
        safetyTriggered,
        scope: payload.scope
      });
      return stream ? sendStreamedResponse(res, payload) : res.json(payload);
    }

    const contextBlocks = formatContextBlocks(retrievedRaw);
    const memory = sanitizeHistoryForPrompt(getConversation(conversationId));

    let answer = await generateGroundedAnswer({
      message,
      contextBlocks,
      safetyInstruction: safetyTriggered ? ADVICE_DISCLAIMER : "",
      history: memory
    });

    answer = toGeneralInfoStyle(answer);

    if (safetyTriggered) {
      answer = `In general, the source states:\n${answer}\n\n${ADVICE_DISCLAIMER}`;
    }

    const answerType = detectAnswerType({
      scope: "in_scope",
      safetyTriggered,
      citations,
      question: message
    });

    const payload = makeResponse({
      conversationId,
      answer,
      citations,
      retrievedChunks,
      confidence,
      scope: "in_scope",
      answerType,
      safetyTriggered,
      suggestedFollowUps: buildFollowUps(retrievedRaw)
    });

    appendConversation(conversationId, message, answer);
    appendChatHistory({
      conversationId,
      question: message,
      answer,
      confidence,
      answerType,
      scope: payload.scope,
      safetyTriggered,
      citations: citations.map((c) => ({ title: c.title, source: c.source, topic: c.topic, url: c.url })),
      ts: new Date().toISOString()
    });

    logComparisonEvent({
      question: message,
      retrievedSourceTitles: citations.map((c) => c.title),
      confidence,
      answerType,
      safetyTriggered,
      scope: payload.scope
    });

    return stream ? sendStreamedResponse(res, payload) : res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Chat processing failed.",
      detail: error.message || "Unexpected server error"
    });
  }
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
