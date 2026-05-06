const API_BASE_URL =
  import.meta.env.VITE_BACKEND_NODE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3001";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
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

export async function sendChatMessage({ token, question, history = [], sessionId = null }) {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ question, history, sessionId })
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
