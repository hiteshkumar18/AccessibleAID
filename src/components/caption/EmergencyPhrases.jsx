import React, { useState } from 'react';

const PHRASES = [
  { text: 'I need help.', emoji: '🆘' },
  { text: 'Please call 911.', emoji: '📞' },
  { text: 'I am deaf. Please write to me.', emoji: '✍️' },
  { text: 'I cannot hear you. Please speak slowly and face me.', emoji: '👀' },
  { text: 'I need a sign language interpreter.', emoji: '🤟' },
  { text: 'Where is the nearest restroom?', emoji: '🚻' },
];

export function EmergencyPhrases() {
  const [active, setActive] = useState(null);

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4"
      aria-labelledby="phrases-title"
    >
      <h2 id="phrases-title" className="text-lg font-semibold text-ink mb-1">
        Emergency phrases
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Tap any phrase to display it large enough for someone nearby to read.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PHRASES.map((p) => (
          <button
            key={p.text}
            onClick={() => setActive(p)}
            className="tap-target text-left bg-bg border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-100 focus:bg-gray-100"
            aria-label={`Show: ${p.text}`}
          >
            <span aria-hidden="true" className="mr-2 text-xl">
              {p.emoji}
            </span>
            <span className="text-base text-ink">{p.text}</span>
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.text}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setActive(null)}
        >
          <div className="text-center">
            <p className="text-white font-bold leading-tight" style={{ fontSize: '11vw' }}>
              {active.text}
            </p>
            <p className="text-white/70 mt-6 text-base">
              Tap anywhere to close.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
