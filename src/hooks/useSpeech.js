import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * Web Speech API wrapper. Handles both:
 *   • SpeechSynthesis (TTS)  — available almost everywhere
 *   • SpeechRecognition (STT) — Chromium / Safari only
 *
 * Returns:
 *   speak(text)       → speak text aloud using user's saved voice/rate
 *   cancelSpeech()    → stop current utterance
 *   voices            → all available SpeechSynthesisVoice
 *   sttSupported      → boolean
 *   listening         → boolean
 *   transcript        → final text (cumulative since last reset)
 *   interim           → live partial transcript
 *   startListening()  → start STT
 *   stopListening()   → stop STT
 *   resetTranscript() → clear stored text
 */
export function useSpeech() {
  const { state } = useApp();
  const { prefs } = state;

  // ---------- TTS ----------
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const sync = () => setVoices(window.speechSynthesis.getVoices() || []);
    sync();
    window.speechSynthesis.addEventListener?.('voiceschanged', sync);
    return () =>
      window.speechSynthesis.removeEventListener?.('voiceschanged', sync);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!text || typeof window === 'undefined' || !window.speechSynthesis)
        return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.rate = Math.max(0.5, Math.min(2, prefs.speechRate || 1));
        u.pitch = Math.max(0.5, Math.min(2, prefs.speechPitch || 1));
        const v = (window.speechSynthesis.getVoices() || []).find(
          (vv) => vv.voiceURI === prefs.speechVoiceURI
        );
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
      } catch (_) {
        /* swallow */
      }
    },
    [prefs.speechRate, prefs.speechPitch, prefs.speechVoiceURI]
  );

  const cancelSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  }, []);

  // ---------- STT ----------
  const SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const sttSupported = !!SR;

  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');

  const ensureRecognition = useCallback(() => {
    if (!sttSupported) return null;
    if (recognitionRef.current) return recognitionRef.current;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        setTranscript((prev) => (prev ? prev + ' ' : '') + finalText.trim());
      }
      setInterim(interimText);
    };
    r.onerror = () => {
      // Silently surface — UI shows current state via `listening`
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognitionRef.current = r;
    return r;
  }, [SR, sttSupported]);

  const startListening = useCallback(() => {
    const r = ensureRecognition();
    if (!r) return false;
    try {
      r.start();
      setListening(true);
      return true;
    } catch (_) {
      // Already started
      return false;
    }
  }, [ensureRecognition]);

  const stopListening = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch (_) {
      /* ignore */
    }
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterim('');
  }, []);

  return {
    speak,
    cancelSpeech,
    voices,
    sttSupported,
    listening,
    transcript,
    interim,
    startListening,
    stopListening,
    resetTranscript,
  };
}
