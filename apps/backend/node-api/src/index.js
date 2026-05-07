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
const MIN_SIMILARITY_THRESHOLD = Number(process.env.RAG_MIN_SIMILARITY || 0.26);

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

function detectQueryTopics(question) {
  const q = String(question || "").toLowerCase();
  const topics = new Set();

  if (/\b(article\s*\d+|human rights|hra|echr|udhr)\b/i.test(q)) topics.add("human_rights");
  if (/\b(equality|discrimination)\b/i.test(q)) topics.add("equality");
  if (/\b(constitution|constitutional|separation of powers|supreme court|magna carta)\b/i.test(q)) {
    topics.add("constitutional");
  }
  if (/\b(privacy|data protection|private life)\b/i.test(q)) topics.add("privacy");

  return topics;
}

function topicLabelForChunk(chunk) {
  const meta = `${chunk?.metadata?.title || ""} ${chunk?.metadata?.topic || ""}`.toLowerCase();
  if (/\b(equality|discrimination)\b/i.test(meta)) return "equality";
  if (/\b(constitution|constitutional|separation of powers|supreme court|magna carta)\b/i.test(meta)) {
    return "constitutional";
  }
  if (/\b(privacy|data protection|uk gdpr)\b/i.test(meta)) return "privacy";
  if (/\b(human rights|hra|echr|udhr|article)\b/i.test(meta)) return "human_rights";
  return "general";
}

function chunkMatchesTopics(chunk, topics) {
  if (!topics.size) return true;
  const metaText = `${chunk?.metadata?.title || ""} ${chunk?.metadata?.topic || ""}`.toLowerCase();

  if (topics.has("human_rights")) {
    if (/\b(human rights|hra|echr|udhr|article)\b/i.test(metaText)) return true;
  }
  if (topics.has("equality")) {
    if (/\b(equality|discrimination)\b/i.test(metaText)) return true;
  }
  if (topics.has("constitutional")) {
    if (/\b(constitution|constitutional|separation of powers|supreme court|magna carta)\b/i.test(metaText)) return true;
  }
  if (topics.has("privacy")) {
    if (/\b(privacy|data protection)\b/i.test(metaText)) return true;
  }
  return false;
}

function filterRetrievedChunks(chunks, question) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const topics = detectQueryTopics(question);
  const topScore = Number(chunks[0]?.score || 0);
  const minScore = Math.max(MIN_SIMILARITY_THRESHOLD, topScore * 0.74);
  const strictEqualityOnly = topics.size === 1 && topics.has("equality");
  const allowPrivacy = topics.has("privacy");

  const filtered = chunks.filter((chunk) => {
    const scoreOk = Number(chunk?.score || 0) >= minScore;
    const topicOk = chunkMatchesTopics(chunk, topics);
    if (!scoreOk || !topicOk) return false;
    const label = topicLabelForChunk(chunk);
    // Hard exclusion: prevent privacy/data-protection sources from leaking into non-privacy answers.
    if (!allowPrivacy && label === "privacy") return false;
    if (strictEqualityOnly) {
      const meta = `${chunk?.metadata?.title || ""} ${chunk?.metadata?.topic || ""}`.toLowerCase();
      return /\b(equality|discrimination)\b/i.test(meta);
    }
    return true;
  });

  // Keep system resilient for narrow questions without re-introducing noisy sources.
  if (filtered.length > 0) return filtered;
  return chunks
    .filter((chunk) => Number(chunk?.score || 0) >= minScore)
    .filter((chunk) => (allowPrivacy ? true : topicLabelForChunk(chunk) !== "privacy"))
    .slice(0, 1);
}

function buildReasoning({ chunks, confidence, question }) {
  const topTopics = [...new Set((chunks || []).map((c) => c?.metadata?.title).filter(Boolean))].slice(0, 3);
  let confidenceReason = "weak or insufficient retrieval support";

  if (confidence === "high") {
    confidenceReason = "multiple strong legal matches retrieved with consistent topic alignment";
  } else if (confidence === "medium") {
    confidenceReason = "partially strong retrieval support from relevant legal materials";
  }

  return {
    retrievalMatches: Array.isArray(chunks) ? chunks.length : 0,
    topTopics,
    confidenceReason,
    queryTopics: [...detectQueryTopics(question)],
    minSimilarityThreshold: MIN_SIMILARITY_THRESHOLD
  };
}

function formatAnswerForReadability(answer) {
  const text = String(answer || "").trim();
  if (!text) return text;
  return text
    .replace(/\b\d\)\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function polishAnswerText(answer) {
  let text = String(answer || "").trim();
  if (!text) return text;
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\butilize\b/gi, "use");
  text = text.replace(/\bpersonalized\b/gi, "personalised");
  text = text.replace(/\blegal info\b/gi, "legal information");
  return text;
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
  suggestedFollowUps,
  reasoning = null
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
    reasoning,
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
    const retrievedFiltered = filterRetrievedChunks(retrievedRaw, message);
    const sufficient = hasSufficientSources(retrievedFiltered);
    const confidence = retrievalConfidence(retrievedFiltered);

    const retrievedChunks = retrievedFiltered.map((chunk) => ({
      source: chunk?.metadata?.source || chunk?.metadata?.title || "Unknown source",
      snippet: String(chunk?.text || "").slice(0, 260),
      score: chunk.score,
      text: chunk.text,
      metadata: chunk.metadata
    }));

    const citations = buildCitations(retrievedFiltered);
    const reasoning = buildReasoning({
      chunks: retrievedFiltered,
      confidence,
      question: message
    });

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
        suggestedFollowUps: buildFollowUps(retrievedFiltered),
        reasoning
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

    const contextBlocks = formatContextBlocks(retrievedFiltered);
    const memory = sanitizeHistoryForPrompt(getConversation(conversationId));

    let answer = await generateGroundedAnswer({
      message,
      contextBlocks,
      safetyInstruction: safetyTriggered ? ADVICE_DISCLAIMER : "",
      history: memory,
      confidence,
      reasoning
    });

    answer = toGeneralInfoStyle(answer);
    answer = formatAnswerForReadability(answer);
    answer = polishAnswerText(answer);

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
      suggestedFollowUps: buildFollowUps(retrievedFiltered),
      reasoning
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
