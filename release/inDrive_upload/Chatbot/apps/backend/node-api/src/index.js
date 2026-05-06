import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const HISTORY_PATH = process.env.CHAT_HISTORY_PATH || path.resolve("data", "chat-history.json");
const USERS_PATH = process.env.USERS_PATH || path.resolve("data", "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT || 10);

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
  if (/\b(landlord|tenant|tenancy|rent|repairs|notice|eviction|private renting)\b/.test(q)) {
    return "tenancy";
  }
  if (/\b(work|worker|employee|employer|dismissal|wage|salary|holiday)\b/.test(q)) {
    return "employment";
  }
  if (/\b(article|human rights|equality act|freedom of expression|privacy)\b/.test(q)) {
    return "human_rights";
  }
  if (/\b(visa|immigration|ilr|citizenship|asylum|skilled worker|graduate visa)\b/.test(q)) {
    return "immigration";
  }
  return "general";
}

const DOMAIN_TERMS = {
  tenancy: {
    include: ["tenant", "landlord", "rent", "tenancy", "private renting", "repair", "notice", "eviction"],
    exclude: ["visa", "immigration", "skilled worker", "graduate visa", "student visa", "citizenship", "ilr"]
  },
  employment: {
    include: ["worker", "employee", "employer", "work", "wage", "dismissal", "holiday", "employment"],
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

function buildFocusedQuestion(question, domain) {
  if (domain === "tenancy") {
    return `${question}\n\nFocus only on UK tenancy and private renting rights. Ignore visa and immigration topics.`;
  }
  if (domain === "employment") {
    return `${question}\n\nFocus only on UK worker and employment rights. Ignore visa and immigration topics unless explicitly asked.`;
  }
  if (domain === "human_rights") {
    return `${question}\n\nFocus only on UK human rights and Equality Act context. Prefer Article-based rights explanations and avoid visa/immigration content.`;
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

async function callAiService({ question, normalizedHistory }) {
  const aiRes = await fetch(`${AI_SERVICE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, query: question, history: normalizedHistory })
  });

  if (!aiRes.ok) {
    const msg = await aiRes.text();
    throw new Error(msg);
  }
  return aiRes.json();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "node-api", build: "google-auth+domain-fallback-v2" });
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

app.post("/api/chat", requireAuth, async (req, res) => {
  const question = (req.body?.question || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const sessionId = (req.body?.sessionId || "").trim() || null;
  if (!question) {
    return res.status(400).json({ error: "Question is required." });
  }

  const user = req.user;
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
      data = await callAiService({ question, normalizedHistory });
    } catch (err) {
      return res.status(502).json({ error: "AI service error", detail: err.message });
    }

    let citations = data.citations || data.sources || [];
    if (domain !== "general" && relevanceScore(citations, domain) < 0.5) {
      try {
        const retryData = await callAiService({
          question: buildFocusedQuestion(question, domain),
          normalizedHistory
        });
        const retryCitations = retryData.citations || retryData.sources || [];
        if (relevanceScore(retryCitations, domain) >= 0.5) {
          data = retryData;
          citations = retryCitations;
        } else {
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
        data = {
          ...data,
          answer: noRelevantSourcesMessage(domain),
          citations: [],
          confidence: "Low",
          query_type: "legal_info",
          retrieved_chunks: []
        };
        citations = [];
      }
    }

    const newUsage = incrementUsage(user);
    writeUsers(req.users);
    if (
      domain !== "tenancy" &&
      typeof data.answer === "string" &&
      /focused tenancy information/i.test(data.answer)
    ) {
      data.answer = noRelevantSourcesMessage(domain);
    }
    const confidence = data.confidence || data.confidence_label || "Low";
    const retrievedChunks = data.retrieved_chunks || citations;
    const queryType = data.query_type || "legal_info";

    const stored = readHistory();
    stored.push({
      ts: new Date().toISOString(),
      userId: user.id,
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
      usage: {
        today: newUsage,
        limit: user.plan === "free" ? FREE_DAILY_LIMIT : null,
        remaining: user.plan === "free" ? Math.max(0, FREE_DAILY_LIMIT - newUsage) : null
      }
    });
  } catch {
    return res.status(500).json({ error: "Failed to reach AI service." });
  }
});

app.listen(PORT, () => {
  console.log(`Node API listening on port ${PORT}`);
});
