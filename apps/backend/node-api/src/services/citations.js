export function buildCitations(retrievedChunks) {
  const byKey = new Map();

  for (const chunk of retrievedChunks || []) {
    const title = chunk?.metadata?.title || "Unknown title";
    const source = chunk?.metadata?.source || "Unknown source";
    const url = chunk?.metadata?.url || "";
    const topic = chunk?.metadata?.topic || "General";
    const key = `${title}::${source}::${url}::${topic}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        title,
        source,
        url,
        topic,
        snippet: String(chunk?.text || "").slice(0, 260)
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
