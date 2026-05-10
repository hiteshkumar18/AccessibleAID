/**
 * useMedSearch — keyword-based medication lookup.
 *
 * Replaces the previous embedding/RAG pipeline. OCR extracts raw text from
 * the medication label; this hook scores each medication entry against that
 * text using simple token overlap. No embedding model or backend call needed.
 */
import { useCallback } from 'react';
import { MEDICATIONS } from '../data/medications.js';

function tokenize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function scoreMatch(medEntry, queryTokens) {
  const haystack = tokenize(
    `${medEntry.name} ${medEntry.genericName} ${medEntry.description} ${medEntry.appearance}`
  );
  const haystackSet = new Set(haystack);
  let hits = 0;
  for (const tok of queryTokens) {
    if (haystackSet.has(tok)) hits++;
    // Partial match: query token is a prefix of a haystack token (e.g. "acetamin" → "acetaminophen")
    else if (haystack.some((h) => h.startsWith(tok) || tok.startsWith(h))) hits += 0.5;
  }
  return queryTokens.length > 0 ? hits / queryTokens.length : 0;
}

export function useRAG() {
  const search = useCallback((query, k = 3) => {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const scored = MEDICATIONS.map((med) => ({
      score: scoreMatch(med, tokens),
      payload: med,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).filter((r) => r.score > 0);
  }, []);

  return { ready: true, error: null, search, count: MEDICATIONS.length };
}
