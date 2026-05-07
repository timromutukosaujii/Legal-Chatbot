const API_BASE_URL =
  import.meta.env.VITE_BACKEND_NODE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3001";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function canReadAsText(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  );
}

function readFileAsText(file, maxChars = 6000) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.slice(0, maxChars));
    };
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

async function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  const out = [];
  for (const item of attachments) {
    const file = item?.file;
    if (!file) continue;
    const base = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: Number(file.size || 0)
    };
    if (canReadAsText(file)) {
      const text = await readFileAsText(file);
      out.push({ ...base, text });
    } else {
      out.push(base);
    }
  }
  return out.slice(0, 6);
}

async function parseResponse(res) {
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const err = await res.json();
      detail = err.detail || err.error || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function sendChatMessage(payloadOrQuestion, maybeHistory = [], maybeToken = null, maybeSessionId = null) {
  const payload =
    typeof payloadOrQuestion === "object" && payloadOrQuestion !== null
      ? payloadOrQuestion
      : {
          question: String(payloadOrQuestion || ""),
          history: Array.isArray(maybeHistory) ? maybeHistory : [],
          token: maybeToken,
          conversationId: maybeSessionId
        };

  const {
    token,
    question,
    message,
    history = [],
    sessionId = null,
    conversationId = null,
    stream = false
  } = payload;

  const normalizedAttachments = await normalizeAttachments(payload.attachments || []);
  const body = {
    message: String(message || question || ""),
    history,
    stream,
    conversationId: conversationId || sessionId || null,
    attachments: normalizedAttachments
  };

  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(body)
  });

  return parseResponse(res);
}

export async function fetchConversations(token) {
  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    headers: { ...authHeaders(token) }
  });
  return parseResponse(res);
}

export async function saveConversation(token, conversation) {
  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify(conversation)
  });
  return parseResponse(res);
}

export async function deleteConversation(token, id) {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders(token) }
  });
  return parseResponse(res);
}
