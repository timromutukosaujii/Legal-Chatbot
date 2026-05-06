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
      // Continue with best-effort; fallback retrieval still works.
    }
  }

  return map;
}

export async function generateGroundedAnswer({ message, contextBlocks, safetyInstruction }) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return "I cannot answer confidently because the language model is not configured (missing OPENAI_API_KEY).";
  }

  const prompt = [
    "You are a UK legal and human-rights information assistant.",
    "Only answer from provided context blocks.",
    "Do not provide personalised legal advice, legal strategy, case prediction, or professional recommendations.",
    "If context is insufficient, say: I cannot answer confidently from the provided legal sources.",
    safetyInstruction ? `Safety note: ${safetyInstruction}` : "",
    "",
    "User question:",
    message,
    "",
    "Retrieved context blocks:",
    contextBlocks.length ? contextBlocks.join("\n\n") : "(none)",
    "",
    "Response format:",
    "- A concise answer grounded only in context",
    "- If uncertain, explicitly say so"
  ]
    .filter(Boolean)
    .join("\n");

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
    return "I cannot answer confidently from the provided legal sources.";
  }

  const payload = await response.json();
  return extractResponseText(payload) || "I cannot answer confidently from the provided legal sources.";
}
