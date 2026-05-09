import { useCallback, useEffect, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';

const WHISPER_MODEL = 'Xenova/whisper-tiny.en';
const EMOTION_INDICATORS = [
  { words: ['amazing', 'fantastic', 'wonderful', 'great', 'excellent', 'love', 'happy'], emotion: 'excited', emoji: '😄' },
  { words: ['question', 'how', 'why', 'what', 'when', 'where', '?'], emotion: 'curious', emoji: '🤔' },
  { words: ['worried', 'concern', 'dangerous', 'warning', 'caution', 'careful'], emotion: 'concerned', emoji: '😟' },
  { words: ['please', 'thank', 'appreciate', 'grateful', 'kind'], emotion: 'grateful', emoji: '🙏' },
  { words: ['emergency', 'help', 'urgent', 'immediately', 'now', 'fire', 'danger'], emotion: 'urgent', emoji: '🚨' },
];

function inferEmotion(text) {
  const lower = text.toLowerCase();
  for (const indicator of EMOTION_INDICATORS) {
    if (indicator.words.some((w) => lower.includes(w))) {
      return { emotion: indicator.emotion, emoji: indicator.emoji };
    }
  }
  return { emotion: 'calm', emoji: '😊' };
}

function generateSpeakerLabel(index) {
  return `Speaker ${String.fromCharCode(65 + (index % 26))}`;
}

let speakerCounter = 0;
const speakerMap = new Map();

function assignSpeaker(chunkIndex) {
  // Very rudimentary speaker assignment based on pauses between chunks.
  // A real system would use speaker diarization (e.g., pyannote).
  if (!speakerMap.has(chunkIndex)) {
    speakerMap.set(chunkIndex, generateSpeakerLabel(speakerCounter++));
  }
  return speakerMap.get(chunkIndex);
}

export function useLiveCaptions({ chunkMs = 4000, language = 'english' } = {}) {
  const { loadPipeline } = useModelLoader();
  const { remember, announce, setAgentStatus, updatePrivacy } = useLumyn();

  const [captions, setCaptions] = useState([]);
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [warming, setWarming] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(null);

  const pipeRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const chunkIndexRef = useRef(0);
  const aliveRef = useRef(true);
  const captionsRef = useRef([]);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    !!window.MediaRecorder;

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

  const buildSummary = useCallback((allCaptions) => {
    if (allCaptions.length === 0) return '';
    const texts = allCaptions.map((c) => c.text).join(' ');
    // Simple extractive summary: take first 2 sentences
    const sentences = texts.match(/[^.!?]+[.!?]+/g) || [texts];
    return sentences.slice(0, 2).join(' ').trim();
  }, []);

  const processAudioChunk = useCallback(
    async (audioData) => {
      if (!pipeRef.current || audioData.length < 1600) return;
      setInterim('Transcribing…');
      try {
        const result = await pipeRef.current(audioData, {
          language,
          task: 'transcribe',
          chunk_length_s: 30,
          return_timestamps: false,
        });
        const rawText = (result?.text || '').trim();
        const cleaned = rawText
          .replace(/\b(thank you\.?|you\.?|\.{3,})\b/gi, '')
          .trim();

        if (cleaned) {
          const idx = chunkIndexRef.current++;
          const { emotion, emoji } = inferEmotion(cleaned);
          const speaker = assignSpeaker(Math.floor(idx / 3)); // group 3 chunks per speaker
          const caption = {
            id: Date.now(),
            speaker,
            text: cleaned,
            emotion,
            emoji,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          };

          captionsRef.current = [...captionsRef.current, caption];
          setCaptions([...captionsRef.current]);
          const newSummary = buildSummary(captionsRef.current);
          setSummary(newSummary);
          remember({ lastTranscript: captionsRef.current.map((c) => c.text).join(' ') });
          announce(cleaned);
        }
        setInterim('');
      } catch (_) {
        setInterim('');
      }
    },
    [language, remember, announce, buildSummary]
  );

  const startListening = useCallback(async () => {
    if (listening || !supported) {
      if (!supported) setError('Microphone not available in this browser.');
      return;
    }
    setError(null);
    captionsRef.current = [];
    chunkIndexRef.current = 0;
    speakerMap.clear();
    speakerCounter = 0;

    try {
      setWarming(true);
      setAgentStatus('social', 'loading');
      updatePrivacy({ audioProcessingLocal: true, lastProcessingMode: 'on-device' });

      if (!pipeRef.current) {
        pipeRef.current = await loadPipeline(
          'automatic-speech-recognition',
          WHISPER_MODEL,
          { dtype: 'q8' }
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
          await processAudioChunk(audioData);
        } catch (_) {}
      };

      recorder.start(chunkMs);
      setListening(true);
      setWarming(false);
      setAgentStatus('social', 'active');
    } catch (e) {
      setWarming(false);
      setAgentStatus('social', 'idle');
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not start microphone.'
      );
    }
  }, [
    listening,
    supported,
    chunkMs,
    loadPipeline,
    resampleTo16k,
    processAudioChunk,
    setAgentStatus,
    updatePrivacy,
  ]);

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
    setAgentStatus('social', 'idle');
    aliveRef.current = true;
  }, [setAgentStatus]);

  const clearCaptions = useCallback(() => {
    captionsRef.current = [];
    setCaptions([]);
    setSummary('');
    chunkIndexRef.current = 0;
    speakerMap.clear();
    speakerCounter = 0;
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    captions,
    interim,
    listening,
    warming,
    summary,
    error,
    supported,
    startListening,
    stopListening,
    clearCaptions,
  };
}
