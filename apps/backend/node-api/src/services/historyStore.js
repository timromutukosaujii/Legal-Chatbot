import fs from "fs";
import path from "path";

const HISTORY_PATH =
  process.env.CHAT_HISTORY_PATH || path.resolve("..", "..", "..", "logs", "chat-history.json");
const MAX_CONVERSATION_TURNS = Number(process.env.MAX_CONVERSATION_TURNS || 12);

const conversationStore = new Map();

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

export function getConversation(conversationId) {
  return conversationStore.get(conversationId) || [];
}

export function appendConversation(conversationId, question, answer) {
  const history = getConversation(conversationId);
  const next = [
    ...history,
    { role: "user", text: question, ts: new Date().toISOString() },
    { role: "assistant", text: answer, ts: new Date().toISOString() }
  ].slice(-MAX_CONVERSATION_TURNS);

  conversationStore.set(conversationId, next);
  return next;
}

export function appendChatHistory(entry) {
  const existing = readJson(HISTORY_PATH, []);
  existing.push(entry);
  writeJson(HISTORY_PATH, existing.slice(-2000));
}

export function sanitizeHistoryForPrompt(history) {
  return (history || [])
    .map((h) => ({
      role: h?.role === "assistant" ? "assistant" : "user",
      text: String(h?.text || "").trim()
    }))
    .filter((h) => h.text);
}
