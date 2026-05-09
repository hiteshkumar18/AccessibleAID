import React, { useEffect } from 'react';
import { SpeakButton } from './SpeakButton.jsx';
import { useSpeech } from '../../hooks/useSpeech.js';
import { useApp } from '../../context/AppContext.jsx';
import { announce } from '../../utils/a11y.js';

/**
 * Displays AI output in a large, readable card. Optionally auto-speaks
 * the text once when it changes (driven by user prefs).
 */
export function ResultCard({
  title,
  text,
  meta,
  autoSpeak = true,
  loading = false,
  children,
}) {
  const { speak } = useSpeech();
  const { state } = useApp();

  useEffect(() => {
    if (!text || loading) return;
    announce(text, 'polite');
    if (autoSpeak && state.prefs.autoSpeak) {
      speak(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, loading]);

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-5"
      aria-labelledby="result-title"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 id="result-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {meta ? (
          <div className="text-sm text-gray-500">{meta}</div>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-6 w-full" />
          <div className="skeleton h-6 w-2/3" />
        </div>
      ) : text ? (
        <p className="text-output text-ink leading-relaxed mb-4 whitespace-pre-wrap">
          {text}
        </p>
      ) : (
        <p className="text-gray-500 text-base">No result yet.</p>
      )}

      {children}

      {text && !loading ? (
        <div className="mt-4">
          <SpeakButton text={text} />
        </div>
      ) : null}
    </section>
  );
}
