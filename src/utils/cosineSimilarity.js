// Vector math helpers used by the on-device RAG search.

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1]; 1 = identical direction, 0 = orthogonal.
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Search for the top-k most similar items in `index` to `queryVec`.
 * `index` is an array of { vector, payload } objects.
 */
export function topK(queryVec, index, k = 3) {
  const scored = index.map((item, i) => ({
    score: cosineSimilarity(queryVec, item.vector),
    payload: item.payload,
    i,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** L2-normalize a vector in place and return it (handy for stored embeddings). */
export function l2Normalize(vec) {
  let n = 0;
  for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / n;
  return vec;
}
