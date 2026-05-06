function toWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function chunkDocuments(documents, options = {}) {
  const chunkSizeWords = Number(options.chunkSizeWords || 600);
  const chunkOverlapWords = Number(options.chunkOverlapWords || 80);
  const step = Math.max(1, chunkSizeWords - chunkOverlapWords);

  const chunks = [];

  for (const doc of documents) {
    const words = toWords(doc.text);
    if (!words.length) continue;

    let chunkIndex = 0;
    for (let i = 0; i < words.length; i += step) {
      const slice = words.slice(i, i + chunkSizeWords);
      if (!slice.length) continue;

      chunkIndex += 1;
      chunks.push({
        id: `${doc.id}#${chunkIndex}`,
        text: slice.join(" "),
        metadata: {
          ...doc.metadata,
          fileName: doc.fileName,
          chunkIndex
        }
      });

      if (i + chunkSizeWords >= words.length) break;
    }
  }

  return chunks;
}
