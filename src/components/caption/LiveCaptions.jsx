import React, { useEffect, useRef } from 'react';
import { useWhisper } from '../../hooks/useWhisper.js';
import { vibrate } from '../../utils/haptics.js';

/**
 * Live captions powered by on-device Whisper. Unlike the browser's
 * SpeechRecognition (which streams audio to Google's servers under the hood),
 * Whisper runs locally — so this works offline AND in Firefox.
 */
export function LiveCaptions() {
  const {
    transcript,
    interim,
    listening,
    warming,
    error,
    supported,
    startListening,
    stopListening,
    resetTranscript,
  } = useWhisper({ chunkMs: 5000 });

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interim]);

  // Brief vibration when a new line of transcript lands — useful for
  // deafblind users wearing the device.
  const lastLenRef = useRef(0);
  useEffect(() => {
    if (transcript.length > lastLenRef.current) {
      lastLenRef.current = transcript.length;
      vibrate('tap');
    }
  }, [transcript]);

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4"
      aria-labelledby="captions-title"
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h2 id="captions-title" className="text-lg font-semibold text-ink">
            Live captions
          </h2>
          <p className="text-xs text-gray-500">
            On-device Whisper · runs offline · works in Firefox
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!listening ? (
            <button
              onClick={startListening}
              disabled={!supported || warming}
              className="tap-target bg-success text-white px-4 rounded-xl font-medium disabled:opacity-50"
              aria-label="Start live captions"
            >
              <span aria-hidden="true">🎙</span>{' '}
              {warming ? 'Loading…' : 'Start'}
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="tap-target bg-danger text-white px-4 rounded-xl font-medium"
              aria-label="Stop live captions"
            >
              <span aria-hidden="true">⏹</span> Stop
            </button>
          )}
          <button
            onClick={resetTranscript}
            className="tap-target bg-gray-100 text-ink px-3 rounded-xl font-medium hover:bg-gray-200"
            aria-label="Clear captions"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="bg-bg rounded-xl p-4 min-h-[200px] max-h-72 overflow-auto text-output text-ink leading-relaxed"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Live captions of speech"
      >
        {transcript || interim ? (
          <p className="whitespace-pre-wrap">
            {transcript}
            {interim ? (
              <span className="text-gray-500 italic"> {interim}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-gray-500">
            {listening
              ? 'Listening… speak in front of the microphone.'
              : warming
              ? 'Loading Whisper model — first time only.'
              : 'Press Start to begin captioning. Audio never leaves your device.'}
          </p>
        )}
      </div>

      {transcript && (
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500">
          <span>{transcript.split(/\s+/).filter(Boolean).length} words captured</span>
          <button
            onClick={() => {
              const blob = new Blob([transcript], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `captions-${Date.now()}.txt`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            className="tap-target text-primary hover:underline"
          >
            Download transcript
          </button>
        </div>
      )}
    </section>
  );
}
