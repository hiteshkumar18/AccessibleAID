import { useCallback, useEffect, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { MODELS } from '../config/models.js';

const MODEL = MODELS.WHISPER.id;

/** Resample any decoded AudioBuffer to mono Float32Array at 16 kHz. */
async function resampleTo16k(audioBuffer) {
  const TARGET = 16000;
  if (audioBuffer.sampleRate === TARGET && audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }
  const length = Math.ceil((audioBuffer.duration || 0) * TARGET);
  if (length <= 0) return new Float32Array(0);
  const offline = new OfflineAudioContext(1, length, TARGET);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * On-device speech-to-text via Whisper (transformers.js).
 * Uses MediaRecorder → decodeAudioData → resample to 16kHz → Whisper.
 * No Google STT, no cloud, works offline after first model download.
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
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder;

  const pipeRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const aliveRef = useRef(true);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0 && aliveRef.current) {
        const audioData = queueRef.current.shift();
        if (!pipeRef.current || !audioData || audioData.length < 4800) continue;
        setInterim('Transcribing…');
        try {
          const result = await pipeRef.current(audioData, {
            language,
            task: 'transcribe',
            return_timestamps: false,
          });
          const text = ((Array.isArray(result) ? result[0]?.text : result?.text) || '').trim();
          const cleaned = text
            .replace(/^[\s.]+$/, '')
            .replace(/\b(thank you for watching\.?)\b/gi, '')
            .trim();
          if (cleaned && cleaned.length > 2) {
            setTranscript((prev) => (prev ? prev + ' ' : '') + cleaned);
          }
          setInterim('');
        } catch (_) {
          setInterim('');
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [language]);

  const startListening = useCallback(async () => {
    if (listening || !supported) {
      if (!supported) setError('Microphone or MediaRecorder not available in this browser.');
      return;
    }
    setError(null);
    aliveRef.current = true;
    try {
      setWarming(true);
      if (!pipeRef.current) {
        pipeRef.current = await loadPipeline(
          'automatic-speech-recognition',
          MODEL,
          { dtype: MODELS.WHISPER.dtype }
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new Ctx(); // No forced sampleRate — resampleTo16k handles it
      audioCtxRef.current = audioCtx;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!aliveRef.current || !e.data || e.data.size < 1000) return;
        try {
          const arr = await e.data.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arr.slice(0));
          const audioData = await resampleTo16k(decoded);
          queueRef.current.push(audioData);
          processQueue();
        } catch (_) {}
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
  }, [chunkMs, listening, loadPipeline, processQueue, supported]);

  const stopListening = useCallback(() => {
    aliveRef.current = false;
    try {
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    } catch (_) {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close().catch(() => {});
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
      const audioCtx = new Ctx();
      const recorder = new MediaRecorder(stream);
      const blobs = [];
      recorder.ondataavailable = (e) => e.data?.size && blobs.push(e.data);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
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
      return ((Array.isArray(result) ? result[0]?.text : result?.text) || '').trim();
    },
    [language, loadPipeline, supported]
  );

  useEffect(() => () => stopListening(), [stopListening]);

  return { transcript, interim, listening, warming, error, supported, startListening, stopListening, resetTranscript, transcribeOnce };
}
