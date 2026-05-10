import { useCallback, useEffect, useRef, useState } from 'react';
import { useLumyn } from '../context/LumynContext.jsx';

const EMOTION_INDICATORS = [
  { words: ['amazing', 'fantastic', 'wonderful', 'great', 'excellent', 'love', 'happy'], emotion: 'excited', emoji: '😄' },
  { words: ['question', 'how', 'why', 'what', 'when', 'where'], emotion: 'curious', emoji: '🤔' },
  { words: ['worried', 'concern', 'dangerous', 'warning', 'caution', 'careful'], emotion: 'concerned', emoji: '😟' },
  { words: ['please', 'thank', 'appreciate', 'grateful', 'kind'], emotion: 'grateful', emoji: '🙏' },
  { words: ['emergency', 'help', 'urgent', 'immediately', 'danger'], emotion: 'urgent', emoji: '🚨' },
];

function inferEmotion(text) {
  const lower = text.toLowerCase();
  for (const ind of EMOTION_INDICATORS) {
    if (ind.words.some((w) => lower.includes(w))) return { emotion: ind.emotion, emoji: ind.emoji };
  }
  return { emotion: 'calm', emoji: '😊' };
}

let speakerCounter = 0;
const speakerMap = new Map();
function assignSpeaker(idx) {
  if (!speakerMap.has(idx)) speakerMap.set(idx, `Speaker ${String.fromCharCode(65 + (speakerCounter++ % 26))}`);
  return speakerMap.get(idx);
}

export function useLiveCaptions() {
  const { remember, announce, setAgentStatus } = useLumyn();

  const [captions, setCaptions] = useState([]);
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const chunkIdxRef = useRef(0);
  const captionsRef = useRef([]);

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const supported = !!SR;

  const buildSummary = useCallback((all) => {
    if (!all.length) return '';
    const t = all.map((c) => c.text).join(' ');
    const s = t.match(/[^.!?]+[.!?]+/g) || [t];
    return s.slice(0, 2).join(' ').trim();
  }, []);

  const startListening = useCallback(() => {
    if (!supported) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (recRef.current) return;

    setError(null);
    captionsRef.current = [];
    chunkIdxRef.current = 0;
    speakerMap.clear();
    speakerCounter = 0;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => {
      setListening(true);
      setAgentStatus('social', 'active');
    };

    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text.length > 1) {
            const idx = chunkIdxRef.current++;
            const { emotion, emoji } = inferEmotion(text);
            const caption = {
              id: Date.now() + idx,
              speaker: assignSpeaker(Math.floor(idx / 3)),
              text,
              emotion,
              emoji,
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            };
            captionsRef.current = [...captionsRef.current, caption];
            setCaptions([...captionsRef.current]);
            remember({ lastTranscript: captionsRef.current.map((c) => c.text).join(' ') });
            announce(text);
          }
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setError('Microphone permission denied. Click the lock icon in the address bar and allow microphone access.');
      } else if (e.error === 'no-speech') {
        setInterim('');
      } else if (e.error !== 'aborted') {
        setError(`Speech recognition error: ${e.error}`);
      }
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
      setAgentStatus('social', 'idle');
    };

    try {
      rec.start();
    } catch (e) {
      recRef.current = null;
      setError('Could not start microphone: ' + (e?.message || e));
    }
  }, [supported, SR, remember, announce, setAgentStatus]);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch (_) {}
    recRef.current = null;
    setListening(false);
    setInterim('');
    // setAgentStatus is handled by rec.onend closure; calling stop() triggers it
  }, []); // stable — no external deps

  const clearCaptions = useCallback(() => {
    captionsRef.current = [];
    setCaptions([]);
    chunkIdxRef.current = 0;
    speakerMap.clear();
    speakerCounter = 0;
  }, []);

  // Empty deps: only runs cleanup on unmount, never re-registers mid-render
  useEffect(() => () => stopListening(), []);

  const summary = buildSummary(captions);

  return {
    captions,
    interim,
    listening,
    warming: false,
    summary,
    error,
    supported,
    startListening,
    stopListening,
    clearCaptions,
  };
}
