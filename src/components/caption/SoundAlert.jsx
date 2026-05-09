import React, { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '../../utils/a11y.js';
import { vibrate } from '../../utils/haptics.js';
import { useModelLoader } from '../../hooks/useModelLoader.js';

const CLASSIFIER = 'Xenova/ast-finetuned-audioset-10-10-0.4593';

// Classes we deliberately surface. AudioSet has ~500 classes — these are the
// ones a deaf user actually wants to know about.
const SAFETY_KEYWORDS = [
  'doorbell', 'bell', 'siren', 'alarm', 'smoke detector', 'fire alarm',
  'beep, bleep', 'baby cry', 'baby crying', 'shout', 'screaming',
  'glass', 'breaking', 'gunshot', 'car alarm', 'knock', 'crying',
  'telephone', 'ringing', 'whistle',
];
function isSafetyClass(label) {
  const l = label.toLowerCase();
  return SAFETY_KEYWORDS.some((k) => l.includes(k));
}

/**
 * Replaces the old RMS-only flasher with a real on-device audio classifier.
 * Every ~3 seconds it samples the microphone, runs Audio Spectrogram
 * Transformer over it, and surfaces the top class. Safety-relevant classes
 * trigger the visual flash + vibration so a deaf user knows *what* sound,
 * not just that something was loud.
 */
export function SoundAlert() {
  const { loadPipeline } = useModelLoader();
  const [active, setActive] = useState(false);
  const [warming, setWarming] = useState(false);
  const [level, setLevel] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState(null);
  const [topLabel, setTopLabel] = useState(null);
  const [topScore, setTopScore] = useState(0);
  const [history, setHistory] = useState([]); // { label, score, ts, safety }

  const pipeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const lastFlashRef = useRef(0);
  const aliveRef = useRef(true);

  const stop = useCallback(() => {
    aliveRef.current = false;
    try {
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    } catch (_) {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
    setActive(false);
    setLevel(0);
    aliveRef.current = true;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setWarming(true);
    try {
      if (!pipeRef.current) {
        pipeRef.current = await loadPipeline('audio-classification', CLASSIFIER);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      src.connect(analyser);

      // Visual VU meter — separate from classification.
      const buf = new Float32Array(analyser.fftSize);
      const tickLevel = () => {
        if (!analyserRef.current) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        setLevel((prev) => prev * 0.7 + Math.min(1, rms * 2) * 0.3);
        if (aliveRef.current) requestAnimationFrame(tickLevel);
      };
      requestAnimationFrame(tickLevel);

      // Classifier loop — record 3s windows, transcribe.
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const blobs = [];
      recorder.ondataavailable = async (e) => {
        if (!aliveRef.current || !e.data || e.data.size === 0) return;
        try {
          const arr = await e.data.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arr.slice(0));
          const audio = await resampleTo16k(decoded);
          if (audio.length < 8000) return; // half second min
          const out = await pipeRef.current(audio, { topk: 3 });
          const top = Array.isArray(out) ? out[0] : null;
          if (!top) return;
          const safety = isSafetyClass(top.label);
          setTopLabel(top.label);
          setTopScore(top.score);
          setHistory((h) => [
            { label: top.label, score: top.score, ts: Date.now(), safety },
            ...h.slice(0, 9),
          ]);
          if (safety && Date.now() - lastFlashRef.current > 1500) {
            lastFlashRef.current = Date.now();
            setFlashing(true);
            announce(`Detected: ${top.label}`, 'assertive');
            vibrate('alert');
            setTimeout(() => setFlashing(false), 1500);
          }
        } catch (_) {
          /* ignore decode boundaries */
        }
      };
      recorder.start(3000);
      setActive(true);
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not start sound monitoring.'
      );
    } finally {
      setWarming(false);
    }
  }, [loadPipeline]);

  useEffect(() => () => stop(), [stop]);

  return (
    <section
      className="bg-surface border border-gray-200 rounded-2xl p-4 relative overflow-hidden"
      aria-labelledby="sound-alert-title"
    >
      {flashing && (
        <div
          className="absolute inset-0 pointer-events-none animate-flash"
          aria-hidden="true"
        />
      )}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div>
          <h2 id="sound-alert-title" className="text-lg font-semibold text-ink">
            Smart sound alerts
          </h2>
          <p className="text-xs text-gray-500">
            On-device classifier flags doorbells, alarms, baby cries, knocks,
            and more — with vibration.
          </p>
        </div>
        {!active ? (
          <button
            onClick={start}
            disabled={warming}
            className="tap-target bg-warning text-white px-4 rounded-xl font-medium disabled:opacity-50"
            aria-label="Start smart sound monitoring"
          >
            <span aria-hidden="true">🔔</span>{' '}
            {warming ? 'Loading…' : 'Start'}
          </button>
        ) : (
          <button
            onClick={stop}
            className="tap-target bg-gray-100 text-ink px-4 rounded-xl font-medium hover:bg-gray-200"
            aria-label="Stop sound monitoring"
          >
            Stop
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <div className="bg-bg rounded-xl p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Live audio level</span>
            <span aria-hidden="true">{Math.round(level * 100)}%</span>
          </div>
          <div
            className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(level * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Microphone level"
          >
            <div
              className="h-full bg-success transition-[width] duration-100"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>

        {topLabel && (
          <div className="text-sm">
            <div className="text-gray-600">Currently hearing</div>
            <div
              className={`text-base font-semibold ${
                isSafetyClass(topLabel) ? 'text-danger' : 'text-ink'
              }`}
            >
              {topLabel}{' '}
              <span className="text-gray-500 font-normal">
                ({Math.round(topScore * 100)}%)
              </span>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <details>
            <summary className="text-sm text-gray-600 cursor-pointer">
              Recent sounds
            </summary>
            <ul className="mt-2 text-sm space-y-1" aria-live="polite">
              {history.map((h, i) => (
                <li
                  key={i}
                  className={`flex items-center justify-between gap-2 ${
                    h.safety ? 'text-danger font-semibold' : 'text-ink'
                  }`}
                >
                  <span>{h.label}</span>
                  <span className="text-gray-500">
                    {Math.round(h.score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

async function resampleTo16k(audioBuffer) {
  const target = 16000;
  if (audioBuffer.sampleRate === target && audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  const length = Math.ceil((audioBuffer.duration || 0) * target);
  if (length <= 0) return new Float32Array(0);
  const offline = new OfflineAudioContext(1, length, target);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
