const API_BASE_URL =
  import.meta.env.VITE_BACKEND_NODE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3001";

const TOKEN_KEY = "legal_chat_token_v1";

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

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function registerUser({ name, email, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  return parseResponse(res);
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseResponse(res);
}

export async function googleAuth(credential) {
  const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential })
  });
  return parseResponse(res);
}

export async function getMe(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { ...authHeaders(token) }
  });
  return parseResponse(res);
}

export async function updatePlan(token, plan) {
  const res = await fetch(`${API_BASE_URL}/api/auth/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ plan })
  });
  return parseResponse(res);
}
