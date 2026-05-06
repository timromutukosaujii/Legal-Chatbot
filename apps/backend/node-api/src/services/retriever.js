function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]{2,}/g) || [];
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function keywordScore(query, text) {
  const qTokens = tokenize(query);
  const tTokens = tokenize(text);
  if (!qTokens.length || !tTokens.length) return 0;

  const tSet = new Set(tTokens);
  let overlap = 0;
  for (const token of qTokens) {
    if (tSet.has(token)) overlap += 1;
  }

  return overlap / qTokens.length;
}

export class Retriever {
  constructor({ topK = 5 } = {}) {
    this.topK = Number(topK) || 5;
    this.chunks = [];
    this.embeddings = null;
    this.embeddingEnabled = false;
  }

  setChunks(chunks) {
    this.chunks = Array.isArray(chunks) ? chunks : [];
  }

  setEmbeddings(embeddingsByChunkId) {
    this.embeddings = embeddingsByChunkId || new Map();
    this.embeddingEnabled = this.embeddings instanceof Map && this.embeddings.size > 0;
  }

  retrieve(query, topK = this.topK, queryEmbedding = null) {
    if (!this.chunks.length) return [];

    const scored = this.chunks.map((chunk) => {
      let score = keywordScore(query, chunk.text);

      if (queryEmbedding && this.embeddingEnabled) {
        const chunkEmbedding = this.embeddings.get(chunk.id);
        if (chunkEmbedding) {
          const semanticScore = cosineSimilarity(queryEmbedding, chunkEmbedding);
          score = 0.65 * semanticScore + 0.35 * score;
        }
      }

      return {
        ...chunk,
        score: Number(score.toFixed(4))
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, Number(topK) || 5);
  }
}
