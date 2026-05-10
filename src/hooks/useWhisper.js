import { useCallback, useEffect, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { MODELS } from '../config/models.js';

const MODEL = MODELS.WHISPER.id;

/**
 * Truly on-device speech-to-text via Whisper.
 *
 * Why this exists: the browser's built-in `SpeechRecognition` (Web Speech API)
 * looks like local STT but on Chrome it actually streams microphone audio to
 * Google's servers — which would silently break our "fully offline" claim.
 * Whisper runs entirely in-browser via transformers.js (WebGPU/WASM) and
 * works in Firefox too.
 *
 * Strategy: capture mic with MediaRecorder, slice into ~5s chunks, decode each
 * chunk into a 16-kHz mono Float32Array, and feed it to Whisper. Chunk results
 * are concatenated into the running transcript.
 */
export function useWhisper({ chunkMs = 5000, language = 'english' } = {}) {
  const { loadPipeline } = useModelLoader();
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [warming, setWarming] = useState(false);
  const [error, setError] = useState(null);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder;

  const pipeRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const aliveRef = useRef(true);

  // Resample any AudioBuffer to mono 16kHz for Whisper.
  const resampleTo16k = useCallback(async (audioBuffer) => {
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
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0 && aliveRef.current) {
        const audioData = queueRef.current.shift();
        if (!pipeRef.current) break;
        if (!audioData || audioData.length < 1600) continue; // <0.1s, skip
        setInterim('Transcribing…');
        try {
          const result = await pipeRef.current(audioData, {
            language,
            task: 'transcribe',
            chunk_length_s: 30,
            return_timestamps: false,
          });
          const text = (result?.text || '').trim();
          // Whisper sometimes emits hallucinated tokens like "Thank you." for
          // silence — filter those.
          const cleaned = text
            .replace(/\b(thank you\.?|you\.?|\.{3,})\b/gi, '')
            .trim();
          if (cleaned) {
            setTranscript((prev) => (prev ? prev + ' ' : '') + cleaned);
          }
          setInterim('');
        } catch (e) {
          setInterim('');
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [language]);

  const startListening = useCallback(async () => {
    if (listening) return;
    if (!supported) {
      setError('Microphone or MediaRecorder not available in this browser.');
      return;
    }
    setError(null);
    try {
      setWarming(true);
      if (!pipeRef.current) {
        pipeRef.current = await loadPipeline(
          'automatic-speech-recognition',
          MODEL,
          { dtype: MODELS.WHISPER.dtype }
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctx({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!aliveRef.current || !e.data || e.data.size === 0) return;
        try {
          const arr = await e.data.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arr.slice(0));
          const audioData = await resampleTo16k(decoded);
          queueRef.current.push(audioData);
          processQueue();
        } catch (_) {
          /* ignore decode errors at boundaries */
        }
      };

      recorder.start(chunkMs);
      setListening(true);
      setWarming(false);
    } catch (e) {
      setWarming(false);
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not start the microphone.'
      );
      setListening(false);
    }
  }, [chunkMs, listening, loadPipeline, processQueue, resampleTo16k, supported]);

  const stopListening = useCallback(() => {
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
    recorderRef.current = null;
    setListening(false);
    setInterim('');
    aliveRef.current = true;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterim('');
  }, []);

  /**
   * One-shot transcription for voice commands: record `durationMs`, transcribe,
   * resolve with the text. Does not affect the streaming transcript state.
   */
  const transcribeOnce = useCallback(
    async (durationMs = 4000) => {
      if (!supported) throw new Error('STT not supported');
      if (!pipeRef.current) {
        pipeRef.current = await loadPipeline(
          'automatic-speech-recognition',
          MODEL,
          { dtype: MODELS.WHISPER.dtype }
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctx({ sampleRate: 16000 });
      const recorder = new MediaRecorder(stream);
      const blobs = [];
      recorder.ondataavailable = (e) => e.data && blobs.push(e.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      await new Promise((r) => setTimeout(r, durationMs));
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(blobs, { type: blobs[0]?.type || 'audio/webm' });
      const arr = await blob.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arr);
      const data = await resampleTo16k(decoded);
      audioCtx.close().catch(() => {});
      const result = await pipeRef.current(data, { language, task: 'transcribe' });
      return (result?.text || '').trim();
    },
    [language, loadPipeline, resampleTo16k, supported]
  );

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    transcript,
    interim,
    listening,
    warming,
    error,
    supported,
    startListening,
    stopListening,
    resetTranscript,
    transcribeOnce,
  };
}
