import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Camera, Volume2, Hand, Type, RefreshCw, X, Sparkles,
} from 'lucide-react';
import { useCamera }       from '../hooks/useCamera.js';
import { useSpeech }       from '../hooks/useSpeech.js';
import { useSignLanguage } from '../hooks/useSignLanguage.js';
import { PrivacyBadge }    from '../components/shared/PrivacyBadge.jsx';

// All phrases the recognizer can emit — used for Learn mode grid
const ALL_SIGNS = [
  // Named gestures (from GestureRecognizer)
  { phrase: 'Hello',      sign: '👋',  description: 'Open palm wave',                   group: 'Gesture' },
  { phrase: 'I Love You', sign: '🤟',  description: 'Thumb + index + pinky out (ILY)', group: 'Gesture' },
  { phrase: 'Good / Yes', sign: '👍',  description: 'Thumbs up',                        group: 'Gesture' },
  { phrase: 'No / Bad',   sign: '👎',  description: 'Thumbs down',                      group: 'Gesture' },
  { phrase: 'Stop',       sign: '☝️', description: 'Index finger pointing up',          group: 'Gesture' },
  { phrase: 'Peace / V',  sign: '✌️', description: 'Two fingers spread — peace',        group: 'Gesture' },
  // Letters
  { phrase: 'A', sign: '🤛', description: 'Closed fist, thumb to side',               group: 'Letter' },
  { phrase: 'B', sign: '🖐', description: 'Four fingers up, thumb folded',            group: 'Letter' },
  { phrase: 'C', sign: '🤏', description: 'Curved hand — C shape',                    group: 'Letter' },
  { phrase: 'D', sign: '☝️',description: 'Index up, others curl to thumb',           group: 'Letter' },
  { phrase: 'E', sign: '✊', description: 'All fingers hooked, thumb under',          group: 'Letter' },
  { phrase: 'F', sign: '👌', description: 'Index+thumb circle, 3 fingers up',         group: 'Letter' },
  { phrase: 'G', sign: '👉', description: 'Index + thumb horizontal, pointing right', group: 'Letter' },
  { phrase: 'H', sign: '✌️',description: 'Index + middle horizontal together',       group: 'Letter' },
  { phrase: 'I', sign: '🤙', description: 'Pinky extended alone',                     group: 'Letter' },
  { phrase: 'K', sign: '✌️',description: 'Index + middle up, thumb between',         group: 'Letter' },
  { phrase: 'L / Help', sign: '🖖', description: 'Index + thumb out — L shape',      group: 'Letter' },
  { phrase: 'M', sign: '✊', description: 'Three fingers folded over thumb',          group: 'Letter' },
  { phrase: 'N', sign: '✊', description: 'Two fingers folded over thumb',            group: 'Letter' },
  { phrase: 'O', sign: '👌', description: 'Fingers + thumb form circle',              group: 'Letter' },
  { phrase: 'R', sign: '🤞', description: 'Index + middle crossed',                   group: 'Letter' },
  { phrase: 'S', sign: '✊', description: 'Closed fist, thumb over fingers',          group: 'Letter' },
  { phrase: 'T', sign: '👊', description: 'Thumb tucked between index + middle',      group: 'Letter' },
  { phrase: 'U', sign: '✌️',description: 'Index + middle up close together',         group: 'Letter' },
  { phrase: 'V / Please',sign: '✌️',description: 'Index + middle spread — peace',   group: 'Letter' },
  { phrase: 'W', sign: '🖐', description: 'Three fingers spread upward',              group: 'Letter' },
  { phrase: 'X', sign: '☝️',description: 'Index finger hooked / bent',              group: 'Letter' },
  { phrase: 'Y / Yes', sign: '🤙', description: 'Thumb + pinky extended',            group: 'Letter' },
];

const RESULT_LINGER_MS = 800;

export default function SignLanguage() {
  const navigate = useNavigate();
  const { videoRef, start: startCam, stop: stopCam, active } = useCamera({ facingMode: 'user' });
  const { speak } = useSpeech();

  const [mode, setMode]               = useState('translate');
  const [textInput, setTextInput]     = useState('');
  const [selectedPhrase, setSelected] = useState(null);
  const [stableSign, setStableSign]   = useState(null);
  const [lastSpoken, setLastSpoken]   = useState(null);
  const [filterGroup, setFilter]      = useState('All');

  const onResult = useCallback((r) => {
    setStableSign((prev) => {
      if (prev?.phrase === r.phrase) return prev;
      return { ...r, observedAt: performance.now() };
    });
  }, []);

  const {
    start: startRec, stop: stopRec, bind: bindVideo,
    ready, loading, error: signError,
  } = useSignLanguage({ onResult });

  const setVideoNode = useCallback((node) => {
    videoRef.current = node;
    bindVideo(node);
  }, [bindVideo, videoRef]);

  // Auto-speak each new detection (debounced)
  useEffect(() => {
    if (!stableSign || !stableSign.score || stableSign.score < 0.60) return;
    const age = performance.now() - (stableSign.observedAt || 0);
    if (lastSpoken === stableSign.phrase && age < RESULT_LINGER_MS) return;
    speak(stableSign.phrase);
    setLastSpoken(stableSign.phrase);
  }, [stableSign, lastSpoken, speak]);

  const handleStart = async () => {
    const ok = await startCam();
    if (!ok) return;
    await startRec().catch(() => {});
  };

  const handleStop = () => {
    stopRec();
    stopCam();
    setStableSign(null);
    setLastSpoken(null);
  };

  const handleTextToSign = () => {
    const q = textInput.toLowerCase().trim();
    const match = ALL_SIGNS.find(
      (s) => s.phrase.toLowerCase() === q || s.phrase.toLowerCase().startsWith(q)
    );
    if (match) {
      setSelected(match);
      speak(`${match.phrase}: ${match.description}`);
    }
  };

  const groups = ['All', 'Gesture', 'Letter'];
  const shown  = filterGroup === 'All' ? ALL_SIGNS : ALL_SIGNS.filter((s) => s.group === filterGroup);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { handleStop(); navigate('/home'); }}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">ASL Sign Language</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        <div className="flex gap-2">
          {['translate', 'learn'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-3 rounded-2xl font-semibold capitalize text-sm transition-all ${
                mode === m
                  ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white shadow-lg'
                  : 'bg-white/80 text-[#475569] border border-[#0F172A]/8'
              }`}
            >
              {m === 'translate' ? '🤙 Translate' : '📚 Learn Signs'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4 pb-10">

        {/* ── TRANSLATE mode ─────────────────────────────────────────────── */}
        {mode === 'translate' && (
          <>
            {/* Hidden video element — always in DOM so ref is stable */}
            <video
              ref={setVideoNode}
              playsInline muted autoPlay
              aria-hidden={!active}
              className={
                active
                  ? 'fixed inset-0 z-50 w-full h-full object-cover scale-x-[-1] bg-black'
                  : 'sr-only'
              }
            />

            {/* Full-screen overlay when camera is live */}
            <AnimatePresence>
              {active && (
                <motion.div
                  key="sign-camera"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[51] flex flex-col pointer-events-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

                  {/* Top bar */}
                  <div className="relative z-10 flex items-center justify-between px-5 pt-12 pointer-events-auto">
                    <button
                      onClick={handleStop}
                      className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                    <div className="bg-black/50 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20">
                      <span className="text-white/80 text-sm font-medium">
                        {loading ? 'Loading model…' : ready ? 'Show a sign' : 'Position hand in frame'}
                      </span>
                    </div>
                    <div className="w-11" />
                  </div>

                  {/* Loading spinner */}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="bg-black/70 backdrop-blur-xl rounded-2xl px-6 py-4 flex items-center gap-3 border border-white/20"
                      >
                        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                        <span className="text-white font-medium">Loading MediaPipe model…</span>
                      </motion.div>
                    </div>
                  )}

                  {/* Live result banner */}
                  {stableSign && (
                    <motion.div
                      key={stableSign.phrase}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="absolute bottom-36 left-4 right-4 z-20 bg-gradient-to-r from-[#10B981]/90 to-[#14B8A6]/90 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-5xl">{stableSign.sign}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-xl">{stableSign.phrase}</p>
                          <p className="text-white/80 text-sm">{stableSign.description}</p>
                          {stableSign.source === 'fingerspell' && (
                            <p className="text-white/60 text-xs mt-0.5">Fingerspelling · {stableSign.letter}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-white/70 text-xs">confidence</p>
                          <p className="text-white font-bold text-xl leading-none">
                            {Math.round(stableSign.score * 100)}%
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Idle hint */}
                  {!stableSign && ready && (
                    <div className="absolute bottom-36 left-4 right-4 z-20 bg-black/50 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/15 flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-cyan-300" />
                      <span className="text-white/80 text-sm">
                        Supports {ALL_SIGNS.length} ASL signs — show your hand!
                      </span>
                    </div>
                  )}

                  {/* Stop button */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center pb-10 pointer-events-auto">
                    <button
                      onClick={handleStop}
                      className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-[#10B981] to-[#14B8A6] flex items-center justify-center">
                        <Hand className="w-7 h-7 text-white" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Last result (after closing camera) */}
            {!active && stableSign && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#10B981]/10 to-[#14B8A6]/10 rounded-2xl border border-[#10B981]/20"
              >
                <span className="text-5xl">{stableSign.sign}</span>
                <div className="flex-1">
                  <p className="font-bold text-[#0F172A] text-lg">{stableSign.phrase}</p>
                  <p className="text-[#475569] text-sm">{stableSign.description}</p>
                </div>
                <button onClick={() => speak(stableSign.phrase)}>
                  <Volume2 className="w-5 h-5 text-[#3B82F6]" />
                </button>
              </motion.div>
            )}

            {signError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-2xl p-4 border border-red-200">
                {signError}
              </div>
            )}

            <button
              onClick={active ? handleStop : handleStart}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw className="w-5 h-5 animate-spin" />Loading model…</>
              ) : active ? (
                <><X className="w-5 h-5" />Stop</>
              ) : (
                <><Camera className="w-5 h-5" />{stableSign ? 'Scan Again' : 'Open Camera'}</>
              )}
            </button>

            <p className="text-xs text-[#64748B] text-center">
              MediaPipe Tasks · {ALL_SIGNS.length} ASL signs · fully on-device
            </p>

            {/* Text → sign lookup */}
            <div className="bg-white/80 rounded-2xl p-5 shadow-md border border-[#0F172A]/5">
              <h3 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2 text-sm">
                <Type className="w-4 h-4 text-[#3B82F6]" />Look up a sign
              </h3>
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTextToSign()}
                  placeholder="e.g. Hello, L, Stop…"
                  className="flex-1 px-3 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/10 rounded-xl text-[#0F172A] text-sm placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                />
                <button
                  onClick={handleTextToSign}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white rounded-xl font-semibold text-sm"
                >
                  Show
                </button>
              </div>
              {selectedPhrase && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-3 p-3 bg-[#10B981]/10 rounded-xl border border-[#10B981]/20"
                >
                  <span className="text-4xl">{selectedPhrase.sign}</span>
                  <div className="flex-1">
                    <p className="font-bold text-[#0F172A]">{selectedPhrase.phrase}</p>
                    <p className="text-[#475569] text-xs">{selectedPhrase.description}</p>
                  </div>
                  <button onClick={() => speak(selectedPhrase.description)}>
                    <Volume2 className="w-5 h-5 text-[#3B82F6]" />
                  </button>
                </motion.div>
              )}
            </div>
          </>
        )}

        {/* ── LEARN mode ─────────────────────────────────────────────────── */}
        {mode === 'learn' && (
          <>
            {/* Group filter */}
            <div className="flex gap-2">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setFilter(g)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    filterGroup === g
                      ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white'
                      : 'bg-white/80 text-[#475569] border border-[#0F172A]/8'
                  }`}
                >
                  {g === 'All' ? `All (${ALL_SIGNS.length})` : g === 'Gesture' ? '👋 Gestures' : '🔤 Letters'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {shown.map((p, i) => (
                <motion.button
                  key={p.phrase}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setSelected(p); speak(`${p.phrase}: ${p.description}`); }}
                  className={`p-4 rounded-2xl border text-left shadow-sm transition-all ${
                    selectedPhrase?.phrase === p.phrase
                      ? 'bg-gradient-to-r from-[#10B981]/15 to-[#14B8A6]/15 border-[#10B981]/30'
                      : 'bg-white/80 border-[#0F172A]/5'
                  }`}
                >
                  <span className="text-4xl block mb-2">{p.sign}</span>
                  <p className="font-bold text-[#0F172A] text-sm">{p.phrase}</p>
                  <p className="text-[#475569] text-xs mt-0.5 leading-snug">{p.description}</p>
                  <span className={`mt-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    p.group === 'Gesture'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {p.group}
                  </span>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
