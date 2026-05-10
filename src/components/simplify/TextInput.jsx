import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech.js';

const SAMPLE = `Take one (1) tablet by mouth every six (6) hours as needed for pain. Do not exceed four (4) tablets in any 24-hour period. If pain persists for more than ten (10) days or fever for more than three (3) days, discontinue use and consult your healthcare provider. Concomitant administration with anticoagulants may potentiate bleeding risk.`;

export function TextInput({ onSubmit, busy }) {
  const [value, setValue] = useState('');
  const {
    sttSupported, listening, transcript, interim,
    startListening, stopListening, resetTranscript,
  } = useSpeech();

  // When listening starts we snapshot the current textarea content so
  // dictated words are appended rather than replacing existing text.
  const baseRef = useRef('');

  const toggleListen = () => {
    if (listening) {
      stopListening();
    } else {
      baseRef.current = value;
      resetTranscript();
      startListening();
    }
  };

  // Merge incoming STT transcript into the textarea value.
  useEffect(() => {
    if (!transcript && !listening) return;
    const base = baseRef.current;
    const dictated = transcript || '';
    setValue(base + (base && dictated ? ' ' : '') + dictated);
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4"
      aria-labelledby="textinput-title"
    >
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 id="textinput-title" className="text-lg font-semibold text-ink">
          Paste or speak complex text
        </h2>
        <button
          onClick={() => setValue(SAMPLE)}
          className="tap-target text-sm text-primary px-3 rounded-lg hover:bg-primary/10"
          aria-label="Use a sample paragraph"
        >
          Try a sample
        </button>
      </div>

      <label htmlFor="complex-text" className="sr-only">
        Complex text to simplify
      </label>
      <textarea
        id="complex-text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Paste a paragraph from a medication insert, lease, or government form…"
        className="w-full bg-bg border border-gray-200 rounded-xl p-3 text-base text-ink resize-y focus:border-primary"
        disabled={busy}
        aria-describedby={listening ? 'stt-hint' : undefined}
      />

      {/* Live interim transcript hint */}
      {listening && (
        <p
          id="stt-hint"
          className="mt-1 text-sm text-primary italic"
          aria-live="polite"
        >
          {interim || 'Listening…'}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <span className="text-sm text-gray-500">{value.length} characters</span>

        <div className="flex items-center gap-2">
          {/* Microphone button — only shown when STT is available */}
          {sttSupported && (
            <button
              onClick={toggleListen}
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? 'Stop dictation' : 'Dictate text by voice'}
              className={`tap-target flex items-center gap-1.5 px-3 rounded-xl font-medium transition-colors
                ${listening
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-ink hover:bg-gray-200'
                } disabled:opacity-50`}
            >
              {listening
                ? <><MicOff className="w-4 h-4" /><span className="text-sm">Stop</span></>
                : <><Mic className="w-4 h-4" /><span className="text-sm">Speak</span></>
              }
            </button>
          )}

          <button
            onClick={() => setValue('')}
            disabled={busy || !value}
            className="tap-target bg-gray-100 text-ink px-4 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50"
            aria-label="Clear the text input"
          >
            Clear
          </button>
          <button
            onClick={() => {
              if (!value.trim()) return;
              if (listening) stopListening();
              onSubmit(value.trim());
            }}
            disabled={busy || !value.trim()}
            className="tap-target bg-purple-700 text-white px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
            aria-label="Simplify this text"
          >
            <span aria-hidden="true">✨</span> Simplify
          </button>
        </div>
      </div>
    </section>
  );
}
