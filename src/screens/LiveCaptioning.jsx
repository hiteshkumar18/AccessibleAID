import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Mic, MicOff, User, Smile, AlertCircle,
  Volume2, Trash2, CheckCircle,
} from 'lucide-react';
import { useLiveCaptions } from '../hooks/useLiveCaptions.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

export default function LiveCaptioning() {
  const navigate = useNavigate();
  const {
    captions, interim, listening, error,
    supported, startListening, stopListening, clearCaptions, summary,
  } = useLiveCaptions();
  const { speak } = useSpeech();
  const [showEmotions, setShowEmotions] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [captions]);

  const handleToggle = () => {
    if (listening) stopListening();
    else startListening();
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-2xl border-b border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { stopListening(); navigate('/home'); }}
              className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-semibold text-white">Live Captions</h1>
              <PrivacyBadge variant="compact" className="mt-0.5 !text-white/60" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmotions(!showEmotions)}
              aria-pressed={showEmotions}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                showEmotions
                  ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6] border-transparent text-white'
                  : 'bg-white/10 border-white/10 text-white/60'
              }`}
              aria-label="Toggle emotions"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={clearCaptions}
              className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/60"
              aria-label="Clear captions"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 bg-red-500/15 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold text-sm">Error</p>
              <p className="text-red-400/80 text-xs mt-0.5">{error}</p>
              <button
                onClick={startListening}
                className="mt-2 text-xs text-[#3B82F6] font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* Not supported */}
        {!supported && (
          <div className="mb-4 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-300 text-xs">
              Use <strong>Chrome</strong> or <strong>Edge</strong> for live captions — Firefox does not support the Web Speech API.
            </p>
          </div>
        )}

        {/* Main button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleToggle}
          disabled={!supported}
          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            listening
              ? 'bg-gradient-to-r from-[#EF4444] to-[#F59E0B] text-white shadow-lg'
              : 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white shadow-lg'
          }`}
        >
          {listening ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-3 h-3 rounded-full bg-white"
              />
              <MicOff className="w-5 h-5" />
              Tap to Stop
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Listening
            </>
          )}
        </motion.button>

        {/* Listening status */}
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-[#3B82F6]/15 rounded-2xl p-3.5 border border-[#3B82F6]/20 flex items-center gap-3"
          >
            <div className="flex items-end gap-0.5 h-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scaleY: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                  className="w-1 bg-[#3B82F6] rounded-full origin-bottom"
                  style={{ height: `${8 + i * 3}px` }}
                />
              ))}
            </div>
            <p className="text-[#60A5FA] text-sm font-medium flex-1">
              {interim || 'Listening… speak now'}
            </p>
          </motion.div>
        )}
      </div>

      {/* Captions stream */}
      <div
        ref={scrollRef}
        className="flex-1 px-6 py-5 overflow-y-auto space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {captions.length === 0 && !listening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-r from-[#3B82F6]/20 to-[#14B8A6]/20 rounded-3xl flex items-center justify-center mb-4 border border-[#3B82F6]/20">
              <Mic className="w-10 h-10 text-[#3B82F6]/60" />
            </div>
            <p className="text-white/60 text-base font-medium">Tap "Start Listening" to begin</p>
            <p className="text-white/30 text-sm mt-2 max-w-xs leading-relaxed">
              Uses your browser's built-in speech recognition. Allow microphone access when prompted.
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {captions.map((caption) => (
            <motion.div
              key={caption.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white/80 text-sm">{caption.speaker}</span>
                    <span className="text-xs text-white/30">{caption.time}</span>
                  </div>
                  <p className="text-white text-base leading-relaxed">{caption.text}</p>
                  {showEmotions && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span aria-hidden="true">{caption.emoji}</span>
                      <span className="text-sm text-white/40 capitalize">{caption.emotion}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => speak(caption.text)}
                  className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0"
                  aria-label="Read aloud"
                >
                  <Volume2 className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Summary panel */}
      {summary && (
        <div className="px-6 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#3B82F6]/15 to-[#14B8A6]/15 rounded-2xl p-4 border border-[#3B82F6]/20"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white/80 flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                Session Summary
              </h3>
              <button onClick={() => speak(summary)} className="text-xs text-[#3B82F6] font-medium">
                Read aloud
              </button>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">{summary}</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
