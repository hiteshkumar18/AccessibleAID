import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Camera, Volume2, Hand, Type, RefreshCw, X, Sparkles,
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSignLanguage } from '../hooks/useSignLanguage.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

// Phrases shown in "Learn" mode. The recognizer (in useSignLanguage)
// emits a {phrase, sign, description} object that lines up with these
// cards so detected gestures highlight the matching learn-mode tile.
const ASL_PHRASES = [
  { phrase: 'Hello',     sign: '👋',  description: 'Open hand wave' },
  { phrase: 'Thank you', sign: '🤟',  description: '“I love you” / thanks' },
  { phrase: 'Help',      sign: '🖖',  description: 'Help / L — thumb + index out' },
  { phrase: 'Please',    sign: '✌️', description: 'Two-finger victory' },
  { phrase: 'Yes',       sign: '👍',  description: 'Thumbs up — affirmative' },
  { phrase: 'No',        sign: '👎',  description: 'Thumbs down — negative' },
  { phrase: 'Stop',      sign: '☝️',  description: 'Pointing up — attention' },
  { phrase: 'Emergency', sign: '🆘',  description: 'E hand-shape shaken' },
];

// Display window for a recognised gesture in milliseconds — short
// enough that fast signing still updates the banner, long enough that
// transient mis-detections don't flicker on screen.
const RESULT_DEBOUNCE_MS = 700;

export default function SignLanguage() {
  const navigate = useNavigate();
  const { videoRef, start: startCamera, stop: stopCamera, active } =
    useCamera({ facingMode: 'user' });
  const { speak } = useSpeech();
  const [mode, setMode] = useState('translate'); // 'translate' | 'learn'
  const [textInput, setTextInput] = useState('');
  const [selectedPhrase, setSelectedPhrase] = useState(null);
  const [stableSign, setStableSign] = useState(null);
  const [lastSpoken, setLastSpoken] = useState(null);

  // Real recognizer (MediaPipe Tasks). It maintains its own RAF loop
  // and pushes each detection into `onResult`; repeated phrases pass
  // through unchanged so the visible banner stays steady.
  const onResult = (r) => {
    setStableSign((prev) => {
      // Same phrase as before? pass through unchanged so the debounce
      // timer keeps the banner steady.
      if (prev?.phrase === r.phrase) return prev;
      return { ...r, observedAt: performance.now() };
    });
  };
  const {
    start: startRecognizer,
    stop: stopRecognizer,
    bind: bindVideo,
    ready, loading, error: signError,
  } = useSignLanguage({ onResult });

  // Wire the camera's <video ref={videoRef}> through to MediaPipe so the
  // recognizer reads from the same MediaStream the user already granted.
  const setVideoNode = useCallback((node) => {
    videoRef.current = node;
    bindVideo(node);
  }, [bindVideo, videoRef]);

  // Speak a detected phrase at most once per RESULT_DEBOUNCE_MS, and
  // only when the recognizer's confidence is high enough for it to
  // actually be useful.
  useEffect(() => {
    if (!stableSign) return;
    if (stableSign.score && stableSign.score < 0.55) return;
    if (lastSpoken === stableSign.phrase &&
        performance.now() - (stableSign.observedAt || 0) < RESULT_DEBOUNCE_MS) {
      return;
    }
    speak(`Detected: ${stableSign.phrase}`);
    setLastSpoken(stableSign.phrase);
  }, [stableSign, lastSpoken, speak]);

  const handleStartDetection = async () => {
    const ok = await startCamera();
    if (!ok) return;
    try {
      await startRecognizer();
    } catch (_) {
      // error surfaces via signError
    }
  };

  const handleStop = () => {
    stopRecognizer();
    stopCamera();
    setStableSign(null);
    setLastSpoken(null);
  };

  const handleTextToSign = () => {
    const phrase = ASL_PHRASES.find(
      (p) => p.phrase.toLowerCase() === textInput.toLowerCase()
    );
    if (phrase) {
      setSelectedPhrase(phrase);
      speak(`Sign for ${phrase.phrase}: ${phrase.description}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { handleStop(); navigate('/home'); }} className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5">
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Sign Language</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['translate', 'learn'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-3 rounded-2xl font-semibold capitalize text-sm transition-all ${
                mode === m ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white shadow-lg' : 'bg-white/80 text-[#475569] border border-[#0F172A]/8'
              }`}
            >
              {m === 'translate' ? '🤙 Translate Signs' : '📚 Learn Signs'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        {mode === 'translate' && (
          <>
            <video
              ref={setVideoNode}
              playsInline
              muted
              autoPlay
              aria-hidden={!active}
              className={
                active
                  ? 'fixed inset-0 z-50 w-full h-full object-cover scale-x-[-1] bg-black'
                  : 'sr-only'
              }
            />

            {/* Full-screen camera when active */}
            <AnimatePresence>
              {active && (
                <motion.div
                  key="sign-camera-fs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[51] flex flex-col pointer-events-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

                  {/* Top bar */}
                  <div className="relative z-10 flex items-center justify-between px-5 pt-12 pointer-events-auto">
                    <button onClick={handleStop} className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                      <X className="w-5 h-5 text-white" />
                    </button>
                    <div className="bg-black/50 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20">
                      <span className="text-white/80 text-sm font-medium">
                        {loading
                          ? 'Loading recognizer…'
                          : ready
                          ? 'Hold a sign in frame'
                          : 'Position your hand in frame'}
                      </span>
                    </div>
                    <div className="w-11" />
                  </div>

                  {/* Loading overlay (cold model load) */}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                        className="bg-black/70 backdrop-blur-xl rounded-2xl px-6 py-4 flex items-center gap-3 border border-white/20">
                        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                        <span className="text-white font-medium">Loading MediaPipe gesture model…</span>
                      </motion.div>
                    </div>
                  )}

                  {/* Live result banner */}
                  {stableSign && (
                    <motion.div
                      key={stableSign.phrase}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-32 left-4 right-4 z-20 bg-gradient-to-r from-[#10B981]/90 to-[#14B8A6]/90 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-5xl">{stableSign.sign}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-lg">{stableSign.phrase}</p>
                          <p className="text-white/80 text-sm truncate">{stableSign.description}</p>
                        </div>
                        {typeof stableSign.score === 'number' && (
                          <div className="text-right">
                            <p className="text-white/90 text-xs">confidence</p>
                            <p className="text-white font-bold text-lg leading-none">
                              {Math.round(stableSign.score * 100)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Live "still detecting" indicator when no sign is stable */}
                  {!stableSign && ready && (
                    <div className="absolute bottom-32 left-4 right-4 z-20 bg-black/50 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/15 flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-cyan-300" />
                      <span className="text-white/80 text-sm">Listening for a sign…</span>
                    </div>
                  )}

                  {/* Stop button */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center pb-10 pointer-events-auto">
                    <button onClick={handleStop}
                      className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#10B981] to-[#14B8A6] flex items-center justify-center">
                        <Hand className="w-7 h-7 text-white" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact result trigger — shown after exiting the camera */}
            {!active && stableSign && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#10B981]/10 to-[#14B8A6]/10 rounded-2xl border border-[#10B981]/20">
                <span className="text-5xl">{stableSign.sign}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0F172A]">{stableSign.phrase}</p>
                  <p className="text-[#475569] text-sm">{stableSign.description}</p>
                </div>
                <button onClick={() => speak(stableSign.description)} className="ml-auto">
                  <Volume2 className="w-5 h-5 text-[#3B82F6]" />
                </button>
              </motion.div>
            )}

            {/* Error from the recognizer (cold load failure, etc.) */}
            {signError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-2xl p-4 border border-red-200">
                {signError}
              </div>
            )}

            <button
              onClick={active ? handleStop : handleStartDetection}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw className="w-5 h-5 animate-spin" />Loading model…</>
              ) : active ? (
                <><X className="w-5 h-5" />Stop translating</>
              ) : (
                <><Camera className="w-5 h-5" />{stableSign ? 'Translate Again' : 'Open Camera to Translate'}</>
              )}
            </button>

            <p className="text-xs text-[#64748B] text-center">
              Powered by MediaPipe Tasks · runs entirely on your device
            </p>

            {/* Text to sign */}
            <div className="bg-white/80 rounded-2xl p-5 shadow-md border border-[#0F172A]/5">
              <h3 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-[#3B82F6]" />Type to Sign
              </h3>
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a word (e.g. Hello)"
                  className="flex-1 px-3 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/10 rounded-xl text-[#0F172A] text-sm placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                />
                <button onClick={handleTextToSign} className="px-4 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white rounded-xl font-semibold text-sm">Show</button>
              </div>
              {selectedPhrase && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-3 p-3 bg-[#10B981]/10 rounded-xl border border-[#10B981]/20">
                  <span className="text-4xl">{selectedPhrase.sign}</span>
                  <div>
                    <p className="font-bold text-[#0F172A]">{selectedPhrase.phrase}</p>
                    <p className="text-[#475569] text-xs">{selectedPhrase.description}</p>
                  </div>
                  <button onClick={() => speak(selectedPhrase.description)} className="ml-auto"><Volume2 className="w-5 h-5 text-[#3B82F6]" /></button>
                </motion.div>
              )}
            </div>
          </>
        )}

        {mode === 'learn' && (
          <div className="grid grid-cols-2 gap-3">
            {ASL_PHRASES.map((p, i) => (
              <motion.button
                key={p.phrase}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSelectedPhrase(p); speak(`${p.phrase}: ${p.description}`); }}
                className={`p-4 rounded-2xl border text-left shadow-sm transition-all ${selectedPhrase?.phrase === p.phrase ? 'bg-gradient-to-r from-[#10B981]/15 to-[#14B8A6]/15 border-[#10B981]/30' : 'bg-white/80 border-[#0F172A]/5'}`}
              >
                <span className="text-4xl block mb-2">{p.sign}</span>
                <p className="font-bold text-[#0F172A] text-sm">{p.phrase}</p>
                <p className="text-[#475569] text-xs mt-0.5">{p.description}</p>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
