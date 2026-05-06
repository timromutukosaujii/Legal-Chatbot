const DEFAULT_CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const texts = [];
  for (const item of output) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const c of contentItems) {
      if (typeof c?.text === "string" && c.text.trim()) texts.push(c.text.trim());
    }
  }
  return texts.join("\n").trim();
}

export function hasOpenAIKey() {
  return Boolean((process.env.OPENAI_API_KEY || "").trim());
}

export async function generateEmbedding(inputText) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_EMBED_MODEL,
      input: inputText
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload?.data?.[0]?.embedding || null;
}

export async function generateEmbeddingsForChunks(chunks) {
  const map = new Map();
  if (!hasOpenAIKey() || !Array.isArray(chunks) || !chunks.length) return map;

  for (const chunk of chunks) {
    try {
      const emb = await generateEmbedding(chunk.text);
      if (emb) map.set(chunk.id, emb);
    } catch {
      // Best-effort only.
    }
  }

  return map;
}

function buildGroundedPrompt({ message, contextBlocks, safetyInstruction, history }) {
  const historyText = (history || [])
    .slice(-6)
    .map((h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.text}`)
    .join("\n");

  return [
    "You are a UK legal and human-rights information assistant.",
    "Use only the retrieved legal sources.",
    "Do not use general model knowledge unless it is directly supported by the retrieved context.",
    "Do not provide personalised legal advice.",
    "Do not predict case outcomes.",
    "Explain in plain English.",
    "Cite the sources used.",
    "If the retrieved context is insufficient, say you cannot answer confidently.",
    "Use phrasing like 'In general' or 'The source states'.",
    safetyInstruction ? `Safety instruction: ${safetyInstruction}` : "",
    "",
    historyText ? `Conversation so far:\n${historyText}` : "",
    "",
    "User question:",
    message,
    "",
    "Retrieved legal context:",
    contextBlocks.length ? contextBlocks.join("\n\n") : "(none)",
    "",
    "Output requirements:",
    "- concise factual answer",
    "- no personal legal strategy",
    "- no invented facts"
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateGroundedAnswer({ message, contextBlocks, safetyInstruction, history = [] }) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return "I could not find enough information in the legal knowledge base to answer this confidently.";
  }

  const prompt = buildGroundedPrompt({ message, contextBlocks, safetyInstruction, history });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_CHAT_MODEL,
      input: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    return "I could not find enough information in the legal knowledge base to answer this confidently.";
  }

  const payload = await response.json();
  return (
    extractResponseText(payload) ||
    "I could not find enough information in the legal knowledge base to answer this confidently."
  );
}

export function createStreamChunks(text, chunkSize = 80) {
  const value = String(text || "");
  const chunks = [];
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize));
  }
  return chunks;
}
