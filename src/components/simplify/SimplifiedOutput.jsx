import React, { useMemo } from 'react';
import { ResultCard } from '../shared/ResultCard.jsx';
import { readingLevel } from '../../utils/readingLevel.js';

export function SimplifiedOutput({ original, simplified, loading }) {
  const before = useMemo(() => readingLevel(original || ''), [original]);
  const after = useMemo(() => readingLevel(simplified || ''), [simplified]);
  const grades = simplified
    ? Math.max(0, Number((before.grade - after.grade).toFixed(1)))
    : 0;
  const ease = simplified ? after.ease - before.ease : 0;

  return (
    <div className="space-y-4">
      <ResultCard
        title="Plain language"
        text={simplified}
        loading={loading}
        meta="On-device · DistilBART (Apache 2.0)"
      />

      {original && simplified && !loading && (
        <section
          aria-labelledby="readability-title"
          className="bg-surface border border-gray-200 rounded-2xl p-4"
        >
          <h3
            id="readability-title"
            className="text-base font-semibold text-ink mb-3"
          >
            Readability
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Original" data={before} />
            <Stat label="Simplified" data={after} highlight />
          </div>
          {(grades > 0 || ease > 0) && (
            <p className="mt-3 text-base text-success" aria-live="polite">
              <span aria-hidden="true">✨</span>{' '}
              <strong>
                Reduced reading level by {grades.toFixed(1)} grades
                {ease > 0 ? ` · ${Math.round(ease)} points easier to read` : ''}
                .
              </strong>
            </p>
          )}
        </section>
      )}

      {original && !loading && (
        <details className="bg-surface border border-gray-200 rounded-2xl p-4">
          <summary className="cursor-pointer text-base text-gray-700 font-medium">
            Show the original text
          </summary>
          <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
            {original}
          </p>
        </details>
      )}
    </div>
  );
}

function Stat({ label, data, highlight }) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        highlight
          ? 'bg-success/10 border-success/30'
          : 'bg-bg border-gray-200'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink">
        Grade {data.grade.toFixed(1)}
      </div>
      <div className="text-sm text-gray-700">{data.label}</div>
      <div className="text-xs text-gray-500 mt-1">
        {data.words} words · {data.sentences} sentences · ease {data.ease}/100
      </div>
    </div>
  );
}
