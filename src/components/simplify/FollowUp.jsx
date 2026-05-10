import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech.js';

export function FollowUp({ onAsk }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  const {
    speak,
    sttSupported, listening, transcript, interim,
    startListening, stopListening, resetTranscript,
  } = useSpeech();

  // Snapshot of question text before dictation starts.
  const baseRef = useRef('');

  const toggleListen = () => {
    if (listening) {
      stopListening();
    } else {
      baseRef.current = question;
      resetTranscript();
      startListening();
    }
  };

  // Merge STT transcript into the question field.
  useEffect(() => {
    if (!transcript && !listening) return;
    const base = baseRef.current;
    const dictated = transcript || '';
    setQuestion(base + (base && dictated ? ' ' : '') + dictated);
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (q = question.trim()) => {
    if (!q) return;
    // Stop mic if still running when user submits.
    if (listening) stopListening();
    setBusy(true);
    try {
      const a = await onAsk(q);
      setHistory((h) => [...h, { q, a }]);
      setQuestion('');
      // Read the answer aloud automatically for blind users.
      speak(a);
    } catch (_) {
      const a = 'Sorry, I could not answer that.';
      setHistory((h) => [...h, { q, a }]);
      speak(a);
    } finally {
      setBusy(false);
    }
  };

  // Submit via Enter (no shift), or after voice dictation settles.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4"
      aria-labelledby="followup-title"
    >
      <h2 id="followup-title" className="text-lg font-semibold text-ink mb-1">
        Ask a follow-up
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        Type or speak your question — the answer will be read aloud.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1 flex flex-col gap-1">
          <label htmlFor="followup-q" className="sr-only">
            Your question
          </label>
          <textarea
            id="followup-q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full bg-bg border border-gray-200 rounded-xl p-3 text-base text-ink resize-y focus:border-primary"
            placeholder="e.g., How many tablets a day is safe?"
            disabled={busy}
            aria-describedby={listening ? 'followup-stt-hint' : undefined}
          />
          {listening && (
            <p
              id="followup-stt-hint"
              className="text-sm text-primary italic"
              aria-live="polite"
            >
              {interim || 'Listening…'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 self-stretch justify-end">
          {sttSupported && (
            <button
              onClick={toggleListen}
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? 'Stop dictation' : 'Ask by voice'}
              className={`tap-target flex items-center justify-center w-11 h-11 rounded-xl transition-colors
                ${listening
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-ink hover:bg-gray-200'
                } disabled:opacity-50`}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => submit()}
            disabled={busy || !question.trim()}
            className="tap-target bg-purple-700 text-white px-4 rounded-xl font-medium disabled:opacity-50 h-11"
            aria-label="Ask question"
          >
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="Question history">
          {history.map((h, i) => (
            <li
              key={i}
              className="bg-bg rounded-xl p-3 border border-gray-200"
            >
              <div className="text-sm font-semibold text-gray-700 mb-1">You asked</div>
              <p className="text-base text-ink mb-2">{h.q}</p>
              <div className="text-sm font-semibold text-gray-700 mb-1">Answer</div>
              <p
                className="text-base text-ink whitespace-pre-wrap mb-2"
                aria-live="polite"
              >
                {h.a}
              </p>
              <button
                onClick={() => speak(h.a)}
                className="flex items-center gap-1.5 text-sm text-primary font-medium"
                aria-label="Read answer aloud"
              >
                <Volume2 className="w-4 h-4" />
                Read aloud
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
