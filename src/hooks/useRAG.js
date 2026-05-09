import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDICATIONS } from '../data/medications.js';
import { cosineSimilarity, l2Normalize } from '../utils/cosineSimilarity.js';
import { useModelLoader } from './useModelLoader.js';

const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * On-device RAG over the medications knowledge base.
 *
 * Flow:
 *   1. Load the embedding pipeline (cached after first call).
 *   2. Embed every medication's "<name> (<generic>): <description>" once.
 *   3. Expose `search(query, k)` that embeds the query and returns top-k
 *      matches with scores in [0, 1].
 */
export function useRAG() {
  const { loadPipeline } = useModelLoader();
  const indexRef = useRef([]);
  const pipeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const embedText = useCallback(async (pipe, text) => {
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    // tjs returns a Tensor — extract a plain Float32Array.
    const arr = Array.from(out.data);
    return l2Normalize(arr);
  }, []);

  const init = useCallback(async () => {
    if (ready || pipeRef.current) return;
    try {
      const pipe = await loadPipeline('feature-extraction', EMBED_MODEL);
      pipeRef.current = pipe;
      const built = [];
      for (const med of MEDICATIONS) {
        const text = `${med.name} (${med.genericName}). ${med.description} Appearance: ${med.appearance}`;
        const vector = await embedText(pipe, text);
        built.push({ vector, payload: med });
      }
      indexRef.current = built;
      setReady(true);
    } catch (e) {
      setError(e?.message || 'Failed to load knowledge base.');
    }
  }, [loadPipeline, embedText, ready]);

  useEffect(() => {
    init();
  }, [init]);

  const search = useCallback(
    async (query, k = 3) => {
      if (!pipeRef.current || !indexRef.current.length) return [];
      const q = await embedText(pipeRef.current, query);
      const scored = indexRef.current.map((item) => ({
        score: cosineSimilarity(q, item.vector),
        payload: item.payload,
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, k);
    },
    [embedText]
  );

  return { ready, error, search, count: MEDICATIONS.length };
}
