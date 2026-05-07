export function buildCitations(retrievedChunks) {
  const byKey = new Map();

  const cleanSnippet = (value, maxLen = 240) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}...`;
  };

  for (const chunk of retrievedChunks || []) {
    const title = chunk?.metadata?.title || "Unknown title";
    const source = chunk?.metadata?.source || "Unknown source";
    const url = chunk?.metadata?.url || "";
    const topic = chunk?.metadata?.topic || "General";
    const key = `${title}::${source}::${url}::${topic}`;
    const score = Number(chunk?.score || 0);
    const relevance =
      score >= 0.55 ? "strong match to your question topic" : score >= 0.35 ? "moderate match to your question topic" : "partial match";

    if (!byKey.has(key)) {
      byKey.set(key, {
        title,
        source,
        url,
        topic,
        snippet: cleanSnippet(chunk?.text || "", 240),
        score,
        whyUsed: relevance
      });
    }
  }

  return [...byKey.values()];
}

export function formatContextBlocks(retrievedChunks) {
  return (retrievedChunks || []).map((chunk, idx) => {
    const m = chunk.metadata || {};
    return [
      `[Chunk ${idx + 1}]`,
      `Title: ${m.title || "Unknown"}`,
      `Source: ${m.source || "Unknown"}`,
      `URL: ${m.url || ""}`,
      `Topic: ${m.topic || "General"}`,
      `Text: ${chunk.text || ""}`
    ].join("\n");
  });
}
