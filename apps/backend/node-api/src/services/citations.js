export function buildCitations(retrievedChunks, { maxItems = 2 } = {}) {
  const byKey = new Map();

  const cleanSnippet = (value, maxLen = 140) => {
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
    if (!byKey.has(key)) {
      byKey.set(key, {
        title,
        source,
        url,
        topic,
        score,
        snippet: cleanSnippet(chunk?.text || "", 140)
      });
    }
  }

  return [...byKey.entries()]
    .sort((a, b) => Number(b?.[1]?.score || 0) - Number(a?.[1]?.score || 0))
    .map((entry) => {
      const item = { ...entry[1] };
      delete item.score;
      return item;
    })
    .slice(0, Math.max(1, Number(maxItems) || 2));
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


