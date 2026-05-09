// Flesch-Kincaid grade level + Flesch reading ease, computed in pure JS.
// Used by Simplify mode to *quantify* the simplification ("grade 14 → grade 5").

function countSentences(text) {
  const matches = text.replace(/[\r\n]+/g, ' ').match(/[^.!?]+[.!?]+/g);
  if (matches && matches.length) return matches.length;
  return Math.max(1, text.trim() ? 1 : 0);
}

function countWords(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

// A serviceable English-language syllable counter (vowel-group heuristic).
// Not perfect but stable enough for relative comparisons.
function countSyllablesInWord(word) {
  word = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const groups = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function countSyllables(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const t of tokens) total += countSyllablesInWord(t);
  return total;
}

/**
 * Returns { grade, ease, words, sentences, syllables, label }.
 *   grade: Flesch-Kincaid grade level (lower = easier)
 *   ease:  Flesch reading ease 0..100 (higher = easier)
 *   label: a friendly bucket name
 */
export function readingLevel(text) {
  const w = countWords(text);
  const s = Math.max(1, countSentences(text));
  const syl = countSyllables(text);
  if (!w) {
    return { grade: 0, ease: 100, words: 0, sentences: 0, syllables: 0, label: '—' };
  }
  const grade = 0.39 * (w / s) + 11.8 * (syl / w) - 15.59;
  const ease = 206.835 - 1.015 * (w / s) - 84.6 * (syl / w);
  return {
    grade: Math.max(0, Number(grade.toFixed(1))),
    ease: Math.max(0, Math.min(100, Number(ease.toFixed(0)))),
    words: w,
    sentences: s,
    syllables: syl,
    label: bucketLabel(grade),
  };
}

function bucketLabel(grade) {
  if (grade < 4) return 'Very easy (≈3rd grade)';
  if (grade < 6) return 'Easy (≈5th grade)';
  if (grade < 9) return 'Fairly easy (middle school)';
  if (grade < 12) return 'Standard (high school)';
  if (grade < 14) return 'Fairly hard (college)';
  if (grade < 16) return 'Hard (college graduate)';
  return 'Very hard (professional/legal)';
}
