import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HISTORY_PATH = process.env.CHAT_HISTORY_PATH || path.resolve("data", "chat-history.json");
const USERS_PATH = process.env.USERS_PATH || path.resolve("data", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT || 10);
const LEGAL_DOCS_DIR =
  process.env.LEGAL_DOCS_DIR || path.resolve("..", "..", "..", "data", "legal_documents");
const RAG_CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 400);
const RAG_CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 80);
const RAG_TOP_K = Number(process.env.RAG_TOP_K || 3);
const RAG_MIN_RELEVANCE_SCORE = Number(process.env.RAG_MIN_RELEVANCE_SCORE || 0.45);
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
const OPENAI_CONFIGURED = OPENAI_API_KEY.length > 0;

const DISCLAIMER = "This chatbot provides general legal information, not personalised legal advice.";
const PROMPT_TEMPLATE = `You are a legal information assistant for UK law topics.

Rules:
- Only use the provided context
- Do NOT provide legal advice
- If the answer is not in the context, say "I don't know"
- Use clear, simple language
- Keep the answer short and practical
- Mention key limits or conditions when present in context

Context:
{context}

Question:
{query}

Answer:`;

const GREETING_PATTERNS = [
  /^hi(\b|\s)/i,
  /^hello(\b|\s)/i,
  /^hey(\b|\s)/i,
  /^good\s+(morning|afternoon|evening)\b/i
];

const SMALL_TALK_PATTERNS = [
  /\bhow are you\b/i,
  /\bthank(s| you)?\b/i,
  /\bbye\b/i,
  /\bgoodbye\b/i,
  /\bsee you\b/i,
  /\bgood night\b/i,
  /\bnice to meet you\b/i
];

const ADVICE_PATTERNS = [
  /\bwhat should i do\b/i,
  /\bmy situation\b/i,
  /\bcan i sue\b/i,
  /\bi want to sue\b/i,
  /\bi need to sue\b/i,
  /\bi am going to sue\b/i,
  /\bi plan to sue\b/i,
  /\bsue my employe+r+\b/i,
  /\bshould i sue\b/i,
  /\bcan i take legal action\b/i,
  /\blegal advice\b/i,
  /\bshould i take action\b/i,
  /\bmy case\b/i
];

const PERSONAL_CONTEXT_PATTERNS = [
  /\b(i|my|me|we|our|us)\b/i,
  /\bmy employe+r+\b/i,
  /\bmy landlord\b/i,
  /\bmy tenant\b/i
];

const ACTION_REQUEST_PATTERNS = [
  /\bwhat should i do\b/i,
  /\bshould i\b/i,
  /\bcan i\b/i,
  /\bi want to\b/i,
  /\bi need to\b/i,
  /\bi plan to\b/i,
  /\bi am going to\b/i,
  /\btake action\b/i,
  /\bsue\b/i,
  /\bfile (a )?claim\b/i,
  /\breport\b/i,
  /\bappeal\b/i
];

let DOCS = [];
let DOC_COUNT = 0;
let TOKEN_DOC_FREQ = new Map();
let AVG_DOC_LENGTH = 0;

const LEGAL_INTENT_TERMS = [
  "law",
  "legal",
  "rights",
  "tenant",
  "landlord",
  "rent",
  "tenancy",
  "eviction",
  "employment",
  "employee",
  "worker",
  "dismissal",
  "wage",
  "contract",
  "visa",
  "immigration",
  "citizenship",
  "asylum",
  "human rights",
  "equality act",
  "article",
  "court",
  "tribunal",
  "notice",
  "deposit",
  "harassment",
  "discrimination",
  "redundancy"
];

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readHistory() {
  return readJsonFile(HISTORY_PATH, []);
}

function writeHistory(entries) {
  writeJsonFile(HISTORY_PATH, entries);
}

function readUsers() {
  return readJsonFile(USERS_PATH, []);
}

function writeUsers(users) {
  writeJsonFile(USERS_PATH, users);
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHmac(payload) {
  return crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
}

function createToken(user) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      plan: user.plan,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    })
  );
  const signature = signHmac(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || token.split(".").length !== 3) return null;
  const [header, body, signature] = token.split(".");
  const expected = signHmac(`${header}.${body}`);
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf-8"));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    authProvider: user.authProvider || "local",
    plan: user.plan || "free",
    createdAt: user.createdAt,
    usageByDate: user.usageByDate || {},
    conversations: user.conversations || []
  };
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = readUsers();
  const user = users.find((u) => u.id === payload.sub);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = user;
  req.users = users;
  return next();
}

function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.sub) {
    req.user = null;
    req.users = null;
    return next();
  }

  const users = readUsers();
  const user = users.find((u) => u.id === payload.sub) || null;
  req.user = user;
  req.users = users;
  return next();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function incrementUsage(user) {
  const key = todayKey();
  user.usageByDate = user.usageByDate || {};
  user.usageByDate[key] = Number(user.usageByDate[key] || 0) + 1;
  return user.usageByDate[key];
}

function getUsage(user) {
  const key = todayKey();
  return Number(user.usageByDate?.[key] || 0);
}

function detectDomain(question) {
  const q = question.toLowerCase();
  if (/\b(visa|immigration|ilr|citizenship|asylum|skilled worker|graduate visa|student visa|visitor visa)\b/.test(q)) {
    return "immigration";
  }
  if (/\b(landlord|tenant|tenancy|rent|repairs|notice|eviction|private renting)\b/.test(q)) {
    return "tenancy";
  }
  if (/\b(work|worker|employee|employer|dismissal|wage|salary|holiday)\b/.test(q)) {
    return "employment";
  }
  if (/\b(article|human rights|equality act|freedom of expression|privacy)\b/.test(q)) {
    return "human_rights";
  }
  return "general";
}

const STOPWORDS = new Set([
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
  "uk",
  "law",
  "legal",
  "england"
]);

const DOMAIN_BY_SOURCE = {
  immigration: ["visa", "immigration", "citizenship", "ilr", "asylum", "eta"],
  employment: ["worker_rights", "employee_rights", "employment"],
  tenancy: ["tenant", "tenancy", "renting"],
  human_rights: ["human_rights", "hra_", "equality_act", "article10", "expression"]
};

function tokenize(text) {
  const tokens = text.toLowerCase().match(/[a-zA-Z0-9]{2,}/g) || [];
  return tokens.map(normalizeToken).filter(Boolean);
}

function normalizeToken(token) {
  if (!token) return "";
  let value = String(token).toLowerCase();
  if (value.length > 5 && value.endsWith("ing")) value = value.slice(0, -3);
  else if (value.length > 4 && value.endsWith("ed")) value = value.slice(0, -2);
  else if (value.length > 4 && value.endsWith("es")) value = value.slice(0, -2);
  else if (value.length > 3 && value.endsWith("s")) value = value.slice(0, -1);
  return value;
}

function buildTokenFreq(tokens) {
  const freq = new Map();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

const QUERY_EXPANSIONS = {
  tenant: ["rent", "landlord", "tenancy", "deposit", "eviction", "repair"],
  landlord: ["tenant", "rent", "tenancy", "eviction", "notice"],
  rent: ["tenant", "landlord", "tenancy", "deposit"],
  eviction: ["notice", "tenant", "landlord", "possession"],
  job: ["employment", "worker", "employee", "dismissal", "salary", "wage"],
  employee: ["worker", "employment", "dismissal", "redundancy", "holiday"],
  worker: ["employee", "employment", "wage", "holiday", "dismissal"],
  dismissal: ["redundancy", "employment", "tribunal", "notice"],
  visa: ["immigration", "citizenship", "asylum", "settlement", "ilr"],
  immigration: ["visa", "citizenship", "asylum", "ilr"],
  rights: ["entitlement", "protection", "duty"],
  discrimination: ["equality", "harassment", "protected"],
  equality: ["discrimination", "protected", "human", "rights"]
};

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const mapped = QUERY_EXPANSIONS[token] || [];
    for (const alias of mapped) {
      expanded.add(normalizeToken(alias));
    }
  }
  return [...expanded];
}

function chunkWords(words, chunkSize, overlap) {
  if (!words.length) return [];
  const step = Math.max(1, chunkSize - overlap);
  const chunks = [];
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

function domainForSource(source) {
  const name = (source || "").toLowerCase();
  for (const [domain, markers] of Object.entries(DOMAIN_BY_SOURCE)) {
    if (markers.some((marker) => name.includes(marker))) {
      return domain;
    }
  }
  return "general";
}

function loadDocuments() {
  const chunks = [];
  const docFreq = new Map();
  let totalDocLength = 0;
  if (!fs.existsSync(LEGAL_DOCS_DIR)) {
    DOC_COUNT = 0;
    TOKEN_DOC_FREQ = new Map();
    AVG_DOC_LENGTH = 0;
    return chunks;
  }
  const entries = fs.readdirSync(LEGAL_DOCS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".txt") continue;
    const filePath = path.join(LEGAL_DOCS_DIR, entry.name);
    const content = fs.readFileSync(filePath, "utf-8");
    const words = content.split(/\s+/).filter(Boolean);
    const chunked = chunkWords(words, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP);
    chunked.forEach((wordChunk, idx) => {
      const chunkText = wordChunk.join(" ").trim();
      if (!chunkText) return;
      const matchTokens = tokenize(chunkText);
      const tokenFreq = buildTokenFreq(matchTokens);
      const uniqueTokens = new Set(matchTokens);
      uniqueTokens.forEach((token) => {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      });
      totalDocLength += matchTokens.length;
      chunks.push({
        source: entry.name,
        domain: domainForSource(entry.name),
        chunk_id: String(idx + 1),
        content: chunkText,
        match_tokens: matchTokens,
        token_freq: tokenFreq,
        length: matchTokens.length,
        snippet: chunkText.slice(0, 600)
      });
    });
  }
  DOC_COUNT = chunks.length;
  TOKEN_DOC_FREQ = docFreq;
  AVG_DOC_LENGTH = DOC_COUNT ? totalDocLength / DOC_COUNT : 0;
  return chunks;
}

function retrieve(question, docs, topK = RAG_TOP_K, domain = "general") {
  const rawQueryTokens = tokenize(question);
  const expandedTokens = expandQueryTokens(rawQueryTokens);
  const filteredQueryTokens = expandedTokens.filter((token) => !STOPWORDS.has(token));
  const queryTokens = new Set(filteredQueryTokens.length ? filteredQueryTokens : expandedTokens);
  if (!Array.isArray(docs) || docs.length === 0) return [];

  if (!queryTokens.size) {
    return docs.slice(0, topK).map((doc) => ({
      source: doc.source,
      chunk_id: doc.chunk_id,
      snippet: (doc.snippet || "").slice(0, 300),
      score: 0
    }));
  }

  const k1 = 1.2;
  const b = 0.75;
  const scored = [];
  for (const doc of docs) {
    const tokenFreq = doc.token_freq || buildTokenFreq(doc.match_tokens || tokenize(doc.content || ""));
    if (!tokenFreq.size) continue;
    const docTokens = new Set(tokenFreq.keys());
    let overlap = 0;
    let bm25 = 0;
    queryTokens.forEach((token) => {
      if (docTokens.has(token)) {
        overlap += 1;
        const tf = tokenFreq.get(token) || 0;
        const df = TOKEN_DOC_FREQ.get(token) || 0;
        const idf = Math.log(1 + (DOC_COUNT - df + 0.5) / (df + 0.5));
        const docLen = doc.length || 1;
        const denom = tf + k1 * (1 - b + b * (docLen / Math.max(1, AVG_DOC_LENGTH)));
        bm25 += idf * ((tf * (k1 + 1)) / Math.max(0.0001, denom));
      }
    });
    if (!overlap) continue;
    const coverage = overlap / Math.max(1, queryTokens.size);
    const precision = overlap / Math.max(1, docTokens.size);
    const bm25Normalized = bm25 / Math.max(1, queryTokens.size);
    const domainBoost = domain !== "general" && doc.domain === domain ? 0.08 : 0;
    const score = Number((0.5 * coverage + 0.2 * precision + 0.3 * bm25Normalized + domainBoost).toFixed(3));
    scored.push({
      source: doc.source,
      chunk_id: doc.chunk_id,
      snippet: (doc.snippet || "").slice(0, 300),
      score
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function classifyQuery(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return "legal_info";
  const hasGreeting = GREETING_PATTERNS.some((pattern) => pattern.test(q));
  const hasSmallTalk = SMALL_TALK_PATTERNS.some((pattern) => pattern.test(q));
  if ((hasGreeting || hasSmallTalk) && !isLikelyLegalQuestion(q) && q.split(/\s+/).length <= 12) {
    return "greeting";
  }
  if (ADVICE_PATTERNS.some((pattern) => pattern.test(q))) return "advice_seeking";
  return "legal_info";
}

function isLikelyLegalQuestion(query) {
  const q = (query || "").toLowerCase();
  if (!q.trim()) return false;
  return LEGAL_INTENT_TERMS.some((term) => q.includes(term));
}

function smallTalkResponse(query) {
  const q = (query || "").toLowerCase();
  if (/\bthank(s| you)?\b/i.test(q)) {
    return "You're welcome. I can help with UK legal information whenever you're ready.";
  }
  if (/\bhow are you\b/i.test(q)) {
    return "I'm here and ready to help with UK legal information questions.";
  }
  if (/\bbye\b|\bgoodbye\b|\bsee you\b|\bgood night\b/i.test(q)) {
    return "Goodbye. Come back anytime if you want help with UK legal information.";
  }
  if (/\bgood\s+(morning|afternoon|evening)\b/i.test(q)) {
    return "Hello. I can help with UK legal information.";
  }
  return "Hello. I can help with UK legal information.";
}

function isAdviceQuery(query) {
  const q = (query || "").toLowerCase();
  return ADVICE_PATTERNS.some((pattern) => pattern.test(q)) || isPersonalActionAdviceRequest(q);
}

function hasPersonalContext(query) {
  return PERSONAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(query || ""));
}

function hasActionRequest(query) {
  return ACTION_REQUEST_PATTERNS.some((pattern) => pattern.test(query || ""));
}

function isPersonalActionAdviceRequest(query) {
  return hasPersonalContext(query) && hasActionRequest(query);
}

function isIDontKnowAnswer(answer) {
  const lower = String(answer || "").toLowerCase();
  return lower.startsWith("i don't know") || lower.startsWith("i do not know");
}

function looksLikeProceduralPersonalAdvice(answer) {
  const lower = String(answer || "").toLowerCase();
  const adviceMarkers = [
    "consider the following steps",
    "gather evidence",
    "file a claim",
    "raise a grievance",
    "you should",
    "you can sue",
    "consult with a solicitor"
  ];
  return adviceMarkers.some((marker) => lower.includes(marker));
}

function refusalMessage() {
  return (
    "I can provide general legal information, but I cannot advise on your specific case or actions. " +
    "Please contact an official advice service or qualified legal professional for personalised support."
  );
}

function injectDisclaimer(answer) {
  if (typeof answer !== "string" || !answer.trim()) return DISCLAIMER;
  if (answer.toLowerCase().includes(DISCLAIMER.toLowerCase())) return answer;
  return `${answer} ${DISCLAIMER}`;
}

function buildPrompt(query, context) {
  return PROMPT_TEMPLATE.replace("{context}", context || "No relevant context found.").replace("{query}", query);
}

function buildGeneralLegalPrompt(query) {
  return `You are a UK legal information assistant.

Rules:
- Provide general legal information only, never personalised legal advice.
- Be clear about uncertainty and jurisdiction limits.
- If unsure, say what is uncertain and point to official UK sources to verify.
- Keep the answer practical and concise.

Question:
${query}

Answer:`;
}

function withHistory(prompt, history) {
  const recent = [];
  for (const msg of (history || []).slice(-6)) {
    const role = msg?.role;
    const text = (msg?.text || "").trim();
    if ((role === "user" || role === "assistant") && text) {
      recent.push(`${role === "user" ? "User" : "Assistant"}: ${text}`);
    }
  }
  if (!recent.length) return prompt;
  return `Conversation history:\n${recent.join("\n")}\n\n${prompt}`;
}

function extractiveFallback(context) {
  if (!context || context.trim() === "No relevant context found.") {
    return "I don't know";
  }
  const lines = context
    .split("\n")
    .map((line) => line.trim().replace(/^\uFEFF/, ""))
    .filter(Boolean);
  const points = [];

  const cleanPoint = (text) => {
    let cleaned = text.replace(/^\uFEFF/, "").trim().replace(/^[ .;-]+|[ .;-]+$/g, "");
    cleaned = cleaned.replace(/\s+/g, " ");
    cleaned = cleaned.replace(/\bSummary \(general information\)\b/gi, "").trim().replace(/^[ .;-]+|[ .;-]+$/g, "");
    const replacements = [
      [/\bunlawful wage deductions\b/gi, "unfair pay deductions"],
      [/\bstatutory minimum paid holiday\b/gi, "minimum paid holiday"],
      [/\bstatutory sick pay\b/gi, "sick pay"],
      [/\bstatutory redundancy pay\b/gi, "redundancy pay"],
      [/\bstatutory family[â€‘-]related pay\/leave\b/gi, "family leave and pay"],
      [/\bprotections such as\b/gi, "extra rights like"]
    ];
    for (const [pattern, replacement] of replacements) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    cleaned = cleaned.replace(/\badditional extra rights like\b/gi, "extra rights like");
    if (cleaned.length > 180) {
      let cut = cleaned.lastIndexOf(",", 170);
      if (cut < 80) cut = cleaned.lastIndexOf(" ", 170);
      if (cut > 0) cleaned = `${cleaned.slice(0, cut).trim().replace(/[ ,.;]+$/g, "")}.`;
    }
    return cleaned;
  };

  for (const line of lines) {
    const colonIndex = line.indexOf(": ");
    const snippet = colonIndex >= 0 ? line.slice(colonIndex + 2).trim() : line;
    if (!snippet) continue;
    const rawParts = snippet
      .split(" - ")
      .map((part) => part.trim())
      .filter(Boolean);
    const parts =
      rawParts.length > 1
        ? rawParts
        : snippet
            .split(/(?<=[.!?])\s+/)
            .map((part) => part.trim())
            .filter(Boolean);

    for (const part of parts) {
      const clean = cleanPoint(part);
      if (clean.length < 20) continue;
      const lower = clean.toLowerCase();
      if (lower.includes("employment status")) continue;
      if (clean.endsWith(" di") || clean.endsWith(" ap") || clean.endsWith(" r")) continue;
      if (points.some((existing) => existing.toLowerCase() === lower)) continue;
      points.push(clean);
      if (points.length >= 4) break;
    }
    if (points.length >= 4) break;
  }

  if (!points.length) return "I don't know";
  const priority = points.filter((p) =>
    ["entitled to", "have all worker rights", "additional protections"].some((term) =>
      p.toLowerCase().includes(term)
    )
  );
  const ordered = [...priority, ...points.filter((p) => !priority.includes(p))].slice(0, 3);
  return `Here is a simple summary from official UK sources:\n${ordered.map((p) => `- ${p}`).join("\n")}`;
}

function extractOpenAIText(responseJson) {
  if (typeof responseJson?.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }
  if (!Array.isArray(responseJson?.output)) return "";
  const chunks = [];
  for (const item of responseJson.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const contentItem of item.content) {
      const text = contentItem?.text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) return "";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) return "";
    const data = await response.json();
    return extractOpenAIText(data);
  } catch {
    return "";
  }
}

async function generateAnswer(query, context, history = []) {
  const prompt = withHistory(buildPrompt(query, context), history);
  const answer = await callOpenAI(prompt);
  if (answer) return answer;

  return extractiveFallback(context);
}

async function generateGeneralLegalAnswer(query, history = []) {
  const prompt = withHistory(buildGeneralLegalPrompt(query), history);
  const answer = await callOpenAI(prompt);
  if (answer) return answer;

  return "I don't know based on the current legal documents loaded in this system.";
}

function confidenceFromChunks(chunks) {
  if (!Array.isArray(chunks) || !chunks.length) return "Low";
  const avg = chunks.reduce((sum, chunk) => sum + Number(chunk?.score || 0), 0) / chunks.length;
  if (avg >= 0.67) return "High";
  if (avg >= 0.34) return "Medium";
  return "Low";
}

async function runLocalAi({ question, normalizedHistory, domain }) {
  if (!DOCS.length) {
    DOCS = loadDocuments();
  }
  const queryType = classifyQuery(question);
  if (queryType === "greeting") {
    return {
      answer: injectDisclaimer(smallTalkResponse(question)),
      citations: [],
      confidence: "Low",
      retrieved_chunks: [],
      query_type: queryType
    };
  }
  if (queryType === "advice_seeking" || isAdviceQuery(question)) {
    return {
      answer: injectDisclaimer(refusalMessage()),
      citations: [],
      confidence: "Low",
      retrieved_chunks: [],
      query_type: "advice_seeking"
    };
  }

  const chunks = retrieve(question, DOCS, RAG_TOP_K, domain);
  if (!chunks.length) {
    return {
      answer: injectDisclaimer(await generateGeneralLegalAnswer(question, normalizedHistory)),
      citations: [],
      confidence: "Low",
      retrieved_chunks: [],
      query_type: queryType
    };
  }
  const topScore = Number(chunks[0]?.score || 0);
  if (topScore < RAG_MIN_RELEVANCE_SCORE) {
    return {
      answer: injectDisclaimer(await generateGeneralLegalAnswer(question, normalizedHistory)),
      citations: [],
      confidence: "Low",
      retrieved_chunks: [],
      query_type: queryType
    };
  }
  const context = chunks
    .map((chunk) => `${chunk.source} (chunk ${chunk.chunk_id || "?"}): ${chunk.snippet || ""}`)
    .join("\n");
  let answerText = await generateAnswer(question, context, normalizedHistory);
  if (isIDontKnowAnswer(answerText)) {
    const fallback = extractiveFallback(context);
    if (!isIDontKnowAnswer(fallback)) {
      answerText = fallback;
    }
  }
  if (
    isPersonalActionAdviceRequest(question) ||
    (hasPersonalContext(question) && looksLikeProceduralPersonalAdvice(answerText))
  ) {
    answerText = refusalMessage();
  }
  const answer = injectDisclaimer(answerText);
  const citations = chunks.map((chunk) => ({
    source: chunk.source,
    snippet: chunk.snippet || ""
  }));
  const retrievedChunks = chunks.map((chunk) => ({
    source: chunk.source,
    snippet: chunk.snippet || "",
    score: Number(chunk.score || 0)
  }));
  return {
    answer,
    citations,
    confidence: confidenceFromChunks(chunks),
    retrieved_chunks: retrievedChunks,
    query_type: queryType
  };
}

const DOMAIN_TERMS = {
  tenancy: {
    include: ["tenant", "landlord", "rent", "tenancy", "private renting", "repair", "notice", "eviction"],
    exclude: ["visa", "immigration", "skilled worker", "graduate visa", "student visa", "citizenship", "ilr"]
  },
  employment: {
    include: ["worker", "employee", "employer", "wage", "salary", "dismissal", "holiday", "employment"],
    exclude: ["visa", "immigration"]
  },
  human_rights: {
    include: ["human rights", "article", "freedom", "expression", "privacy", "equality act", "hra"],
    exclude: []
  },
  immigration: {
    include: ["visa", "immigration", "citizenship", "ilr", "asylum", "skilled worker", "graduate"],
    exclude: []
  }
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textHasTerm(text, term) {
  const normalized = term.trim().toLowerCase().replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`\\b${escapeRegex(normalized).replace(/\\\\s\+/g, "\\s+")}\\b`, "i");
  return pattern.test(text);
}

function relevanceScore(citations, domain) {
  if (!Array.isArray(citations) || citations.length === 0) return 0;
  const rules = DOMAIN_TERMS[domain];
  if (!rules) return 1;

  let score = 0;
  for (const c of citations) {
    const text = `${c?.source || ""} ${c?.snippet || ""}`.toLowerCase();
    const hasInclude = rules.include.some((t) => textHasTerm(text, t));
    const hasExclude = rules.exclude.some((t) => textHasTerm(text, t));
    if (hasInclude && !hasExclude) score += 1;
  }
  return score / citations.length;
}

function citationMatchesDomain(citation, domain) {
  const rules = DOMAIN_TERMS[domain];
  if (!rules) return true;
  const text = `${citation?.source || ""} ${citation?.snippet || ""}`.toLowerCase();
  const hasInclude = rules.include.some((t) => textHasTerm(text, t));
  const hasExclude = rules.exclude.some((t) => textHasTerm(text, t));
  return hasInclude && !hasExclude;
}

function filterCitationsByDomain(citations, domain) {
  if (domain === "general" || !Array.isArray(citations)) return citations || [];
  return citations.filter((c) => citationMatchesDomain(c, domain));
}

function buildFocusedQuestion(question, domain) {
  if (domain === "tenancy") {
    return `${question}\n\nFocus only on UK tenancy and private renting rights.`;
  }
  if (domain === "employment") {
    return `${question}\n\nFocus only on UK worker and employment rights.`;
  }
  if (domain === "human_rights") {
    return `${question}\n\nFocus only on UK human rights and Equality Act context. Prefer Article-based rights explanations.`;
  }
  if (domain === "immigration") {
    return `${question}\n\nFocus only on UK visa, immigration, settlement, and citizenship rules.`;
  }
  return question;
}

function noRelevantSourcesMessage(domain) {
  if (domain === "tenancy") {
    return "I could not find sufficiently relevant tenancy/private-renting sources for that question. Please rephrase and I will retry with a narrower tenancy focus.";
  }
  if (domain === "employment") {
    return "I could not find sufficiently relevant UK employment-rights sources for that question. Please rephrase and I will retry with a narrower work-rights focus.";
  }
  if (domain === "human_rights") {
    return "I could not find sufficiently relevant UK human-rights sources for that question. Please rephrase and I will retry with a narrower human-rights focus.";
  }
  if (domain === "immigration") {
    return "I could not find sufficiently relevant UK immigration/visa sources for that question. Please rephrase and I will retry with a narrower immigration focus.";
  }
  return "I could not find sufficiently relevant sources for that question. Please rephrase and try again.";
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "node-api",
    build: "local-rag-openai-v1",
    chunks: DOCS.length,
    docs_dir: LEGAL_DOCS_DIR,
    openai_configured: OPENAI_CONFIGURED
  });
});

app.post("/api/admin/reload-docs", (_req, res) => {
  DOCS = loadDocuments();
  return res.json({ ok: true, chunks: DOCS.length, docs_dir: LEGAL_DOCS_DIR });
});

app.post("/api/auth/register", (req, res) => {
  const name = (req.body?.name || "").trim();
  const email = (req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password || "";

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: "Name, email, and password (min 6 chars) are required." });
  }

  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "Email already registered." });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    authProvider: "local",
    passwordHash: hashPassword(password, salt),
    salt,
    plan: "free",
    usageByDate: {},
    conversations: [],
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);

  const token = createToken(user);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = (req.body?.email || "").trim().toLowerCase();
  const password = req.body?.password || "";

  const users = readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
  if (user.authProvider === "google" || !user.passwordHash || !user.salt) {
    return res.status(401).json({ error: "Use Google sign-in for this account." });
  }

  const expectedHash = hashPassword(password, user.salt);
  if (expectedHash !== user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = createToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/google", async (req, res) => {
  const credential = String(req.body?.credential || "").trim();
  if (!credential) {
    return res.status(400).json({ error: "Google credential is required." });
  }

  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) {
      return res.status(401).json({ error: "Invalid Google token." });
    }
    const tokenInfo = await verifyRes.json();

    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    if (clientId && tokenInfo.aud !== clientId) {
      return res.status(401).json({ error: "Google token audience mismatch." });
    }
    if (String(tokenInfo.email_verified) !== "true") {
      return res.status(401).json({ error: "Google email is not verified." });
    }

    const email = String(tokenInfo.email || "").trim().toLowerCase();
    const name = String(tokenInfo.name || tokenInfo.given_name || "Google User").trim();
    const googleSub = String(tokenInfo.sub || "").trim();
    if (!email || !googleSub) {
      return res.status(401).json({ error: "Google profile is incomplete." });
    }

    const users = readUsers();
    let user = users.find((u) => u.googleSub === googleSub || u.email === email);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        name,
        email,
        authProvider: "google",
        googleSub,
        passwordHash: null,
        salt: null,
        plan: "free",
        usageByDate: {},
        conversations: [],
        createdAt: new Date().toISOString()
      };
      users.push(user);
    } else {
      user.authProvider = "google";
      user.googleSub = googleSub;
      if (!user.name) user.name = name;
    }

    writeUsers(users);
    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch {
    return res.status(500).json({ error: "Failed to verify Google sign-in." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = req.user;
  const usageToday = getUsage(user);
  return res.json({
    user: sanitizeUser(user),
    usage: {
      today: usageToday,
      limit: user.plan === "free" ? FREE_DAILY_LIMIT : null,
      remaining: user.plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - usageToday) : null
    }
  });
});

app.post("/api/auth/plan", requireAuth, (req, res) => {
  const requestedPlan = (req.body?.plan || "").toLowerCase();
  if (!["free", "pro"].includes(requestedPlan)) {
    return res.status(400).json({ error: "Plan must be free or pro." });
  }

  const user = req.user;
  user.plan = requestedPlan;
  writeUsers(req.users);
  const token = createToken(user);
  return res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/conversations", requireAuth, (req, res) => {
  const conversations = req.user.conversations || [];
  return res.json({ conversations });
});

app.post("/api/conversations", requireAuth, (req, res) => {
  const id = (req.body?.id || crypto.randomUUID()).trim();
  const title = (req.body?.title || "New chat").trim();
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

  const conversations = req.user.conversations || [];
  const index = conversations.findIndex((c) => c.id === id);
  const payload = {
    id,
    title,
    messages,
    updatedAt: Date.now()
  };

  if (index >= 0) {
    conversations[index] = payload;
  } else {
    conversations.unshift(payload);
  }

  req.user.conversations = conversations.slice(0, 50);
  writeUsers(req.users);
  return res.json({ ok: true, conversation: payload });
});

app.delete("/api/conversations/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  req.user.conversations = (req.user.conversations || []).filter((c) => c.id !== id);
  writeUsers(req.users);
  return res.json({ ok: true });
});

app.post("/api/chat", optionalAuth, async (req, res) => {
  const question = (req.body?.question || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const sessionId = (req.body?.sessionId || "").trim() || null;
  if (!question) {
    return res.status(400).json({ error: "Question is required." });
  }

  const user = req.user || null;
  if (user) {
    const usageToday = getUsage(user);
    if (user.plan === "free" && usageToday >= FREE_DAILY_LIMIT) {
      return res.status(402).json({
        error: "Daily limit reached",
        detail: "Upgrade to continue using the service.",
        usage: {
          today: usageToday,
          limit: FREE_DAILY_LIMIT,
          remaining: 0
        }
      });
    }
  }

  try {
    const normalizedHistory = history
      .map((msg) => {
        const role = msg?.role === "assistant" ? "assistant" : "user";
        const content = String(msg?.content || msg?.text || "").trim();
        if (!content) return null;
        return {
          role,
          text: content,
          content
        };
      })
      .filter(Boolean);

    const domain = detectDomain(question);
    let data;
    try {
      data = await runLocalAi({ question, normalizedHistory, domain });
    } catch (err) {
      return res.status(500).json({ error: "AI processing error", detail: err.message });
    }

    let citations = data.citations || data.sources || [];
    if (domain !== "general") {
      const filtered = filterCitationsByDomain(citations, domain);
      if (filtered.length > 0) {
        citations = filtered;
        data = { ...data, citations: filtered };
      }
    }
    if (domain !== "general" && citations.length > 0 && relevanceScore(citations, domain) < 0.35) {
      try {
        const retryData = await runLocalAi({
          question: buildFocusedQuestion(question, domain),
          normalizedHistory,
          domain
        });
        const rawRetryCitations = retryData.citations || retryData.sources || [];
        const retryCitations = filterCitationsByDomain(rawRetryCitations, domain);
        if (retryCitations.length > 0 && relevanceScore(retryCitations, domain) >= 0.35) {
          data = retryData;
          citations = retryCitations;
          data = { ...data, citations: retryCitations };
        } else if (!citations.length) {
          data = {
            ...retryData,
            answer: noRelevantSourcesMessage(domain),
            citations: [],
            confidence: "Low",
            query_type: "legal_info",
            retrieved_chunks: []
          };
          citations = [];
        }
      } catch {
        // Keep original data if retry fails.
      }
    }

    let usagePayload = null;
    if (user) {
      const newUsage = incrementUsage(user);
      writeUsers(req.users);
      usagePayload = {
        today: newUsage,
        limit: user.plan === "free" ? FREE_DAILY_LIMIT : null,
        remaining: user.plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - newUsage) : null
      };
    }
    if (
      domain !== "tenancy" &&
      typeof data.answer === "string" &&
      /focused tenancy information/i.test(data.answer)
    ) {
      data.answer = noRelevantSourcesMessage(domain);
    }
    const confidence = data.confidence || data.confidence_label || "Low";
    const rawRetrievedChunks = data.retrieved_chunks || citations;
    const retrievedChunks = filterCitationsByDomain(rawRetrievedChunks, domain);
    const queryType = data.query_type || "legal_info";

    const stored = readHistory();
    stored.push({
      ts: new Date().toISOString(),
      userId: user ? user.id : null,
      sessionId,
      question,
      answer: data.answer,
      citations,
      confidence,
      query_type: queryType,
      retrieved_chunks: retrievedChunks
    });
    writeHistory(stored);

    return res.json({
      ...data,
      citations,
      confidence,
      query_type: queryType,
      retrieved_chunks: retrievedChunks,
      ...(usagePayload ? { usage: usagePayload } : {})
    });
  } catch {
    return res.status(500).json({ error: "Failed to process chat request." });
  }
});

DOCS = loadDocuments();

if (!OPENAI_CONFIGURED) {
  console.warn("[startup] OPENAI_API_KEY is not set. Falling back to extractive/local responses.");
}

app.listen(PORT, () => {
  console.log(`Node API listening on port ${PORT} with ${DOCS.length} chunks`);
});
