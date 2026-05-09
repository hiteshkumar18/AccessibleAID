import React, { useState } from 'react';
import { SpeakButton } from '../shared/SpeakButton.jsx';

export function FollowUp({ onAsk }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]); // { q, a }
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    try {
      const a = await onAsk(q);
      setHistory((h) => [...h, { q, a }]);
      setQuestion('');
    } catch (e) {
      setHistory((h) => [...h, { q, a: 'Sorry, I could not answer that.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4"
      aria-labelledby="followup-title"
    >
      <h2 id="followup-title" className="text-lg font-semibold text-ink mb-2">
        Ask a follow-up
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Have a question about the simplified text? Ask it in plain English.
      </p>

      <div className="flex items-end gap-2">
        <label htmlFor="followup-q" className="sr-only">
          Your question
        </label>
        <textarea
          id="followup-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          className="flex-1 bg-bg border border-gray-200 rounded-xl p-3 text-base text-ink resize-y focus:border-primary"
          placeholder="e.g., How many tablets a day is safe?"
          disabled={busy}
        />
        <button
          onClick={submit}
          disabled={busy || !question.trim()}
          className="tap-target bg-purple-700 text-white px-4 rounded-xl font-medium disabled:opacity-50 self-stretch"
          aria-label="Ask question"
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </div>

      {history.length > 0 && (
        <ul className="mt-4 space-y-3">
          {history.map((h, i) => (
            <li
              key={i}
              className="bg-bg rounded-xl p-3 border border-gray-200"
              aria-live="polite"
            >
              <div className="text-sm font-semibold text-gray-700 mb-1">
                You asked
              </div>
              <p className="text-base text-ink mb-2">{h.q}</p>
              <div className="text-sm font-semibold text-gray-700 mb-1">
                Answer
              </div>
              <p className="text-base text-ink whitespace-pre-wrap mb-2">
                {h.a}
              </p>
              <SpeakButton text={h.a} label="Read answer" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
