import React from 'react';
import { useSpeech } from '../../hooks/useSpeech.js';

export function SpeakButton({ text, label = 'Read aloud', className = '' }) {
  const { speak, cancelSpeech } = useSpeech();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => speak(text)}
        className="tap-target inline-flex items-center gap-2 bg-primary text-white px-4 rounded-xl font-medium hover:opacity-90"
        aria-label={label}
        disabled={!text}
      >
        <span aria-hidden="true">🔊</span>
        <span>{label}</span>
      </button>
      <button
        onClick={cancelSpeech}
        className="tap-target inline-flex items-center gap-2 bg-gray-100 text-ink px-3 rounded-xl font-medium hover:bg-gray-200"
        aria-label="Stop speaking"
      >
        <span aria-hidden="true">⏹</span>
        <span className="sr-only">Stop</span>
      </button>
    </div>
  );
}
