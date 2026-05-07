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

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/embeddings", {
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
  } catch {
    return null;
  }
  if (!response.ok) return null;

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

function buildStyleInstruction(responseStyle) {
  if (responseStyle === "overview") {
    return [
      "Response style: overview",
      "Treat the user request as broad-topic overview.",
      "Start with 1 short plain-English sentence.",
      "Then provide 4-6 concise bullets with concrete legal examples.",
      "Preserve article numbers accurately (e.g., Article 2, Article 6, Article 8, Article 10, Article 14).",
      "No links in answer text.",
      "No filler ending."
    ].join("\n");
  }

  if (responseStyle === "simple_explain") {
    return [
      "Response style: simple_explain",
      "Do not repeat the previous answer wording.",
      "Explain the same legal point in plainer English.",
      "Use 1 short opening sentence, then 3-5 short bullets.",
      "Include one practical meaning/example in simple terms.",
      "Keep Article numbers accurate (for example: Article 8, Article 10).",
      "No filler ending."
    ].join("\n");
  }

  if (responseStyle === "bullet") {
    return [
      "Response style: bullet",
      "Use bullet points only.",
      "Maximum 5 bullets.",
      "Each bullet must be short and on its own line.",
      "No long intro paragraph and no outro filler."
    ].join("\n");
  }
  if (responseStyle === "detailed") {
    return [
      "Response style: detailed",
      "Use short sections with clear headings.",
      "Keep structure readable and grounded in sources."
    ].join("\n");
  }
  return [
    "Response style: concise",
    "Use 2-4 sentences maximum.",
    "No unnecessary explanation or filler."
  ].join("\n");
}

function buildGroundedPrompt({ message, contextBlocks, safetyInstruction, history, confidence, reasoning, responseStyle }) {
  const historyText = (history || [])
    .slice(-6)
    .map((h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.text}`)
    .join("\n");

  return [
    "You are a UK legal and human-rights information assistant.",
    "Sound natural, warm, and clear, like a helpful human explainer.",
    "Use only the retrieved legal sources for factual claims.",
    "Do not use general model knowledge unless directly supported by retrieved context.",
    "Do not provide personalised legal advice.",
    "Do not predict case outcomes.",
    "Explain in plain English for non-experts.",
    "Use valid Markdown with clean bullets and line breaks.",
    "Never truncate bullet items or article numbers.",
    "Preserve legal article numbers exactly (e.g., Article 2, Article 6, Article 8, Article 10, Article 14).",
    "Cite the sources used.",
    "Do not include a 'Sources:' section in the answer text.",
    "Do not include URLs or markdown links in the answer text.",
    "If context is insufficient, say so clearly and briefly.",
    "Avoid repetitive boilerplate phrases and avoid robotic wording.",
    "Prefer short paragraphs; only use bullets when they improve clarity.",
    "Do not end with conversational filler like 'Would you like to know more?'.",
    buildStyleInstruction(responseStyle),
    safetyInstruction ? `Safety instruction: ${safetyInstruction}` : "",
    confidence ? `Retrieval confidence: ${confidence}` : "",
    reasoning ? `Retrieval reasoning: ${JSON.stringify(reasoning)}` : "",
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
    "- concise factual answer in natural conversational tone",
    "- no personal legal strategy",
    "- no invented facts"
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateGroundedAnswer({
  message,
  contextBlocks,
  safetyInstruction,
  history = [],
  confidence = null,
  reasoning = null,
  responseStyle = "concise"
}) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return "I could not find enough information in the legal knowledge base to answer this confidently.";
  }

  const prompt = buildGroundedPrompt({
    message,
    contextBlocks,
    safetyInstruction,
    history,
    confidence,
    reasoning,
    responseStyle
  });

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
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
  } catch {
    return "I could not find enough information in the legal knowledge base to answer this confidently.";
  }

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
