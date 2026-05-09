import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Mic, MicOff, User, Smile, AlertCircle, Volume2, Trash2, RefreshCw } from 'lucide-react';
import { useLiveCaptions } from '../hooks/useLiveCaptions.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge, ModelLoadingBadge } from '../components/shared/PrivacyBadge.jsx';
import { useLumyn } from '../context/LumynContext.jsx';

export default function LiveCaptioning() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const {
    captions, interim, listening, warming, summary, error,
    supported, startListening, stopListening, clearCaptions,
  } = useLiveCaptions({ chunkMs: 4000 });
  const { speak } = useSpeech();
  const [showEmotions, setShowEmotions] = React.useState(true);
  const scrollRef = useRef(null);

  // Auto-scroll to newest caption
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  const handleToggle = () => {
    if (listening) stopListening();
    else startListening();
  };

  const handleSpeakSummary = () => {
    if (summary) speak(summary);
  };

  // Get active loader progress for the Whisper model
  const loaderEntry = Object.values(state.loaders).find((v) => v?.label?.toLowerCase().includes('speech'));
  const loadProgress = loaderEntry?.progress ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { stopListening(); navigate('/home'); }}
              className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-semibold text-[#0F172A]">Live Captions</h1>
              <PrivacyBadge variant="compact" className="mt-0.5" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmotions(!showEmotions)}
              aria-pressed={showEmotions}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                showEmotions
                  ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6] text-white shadow-lg'
                  : 'bg-white/80 text-[#475569] border border-[#0F172A]/5'
              }`}
              aria-label="Toggle emotion indicators"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={clearCaptions}
              className="w-10 h-10 rounded-xl bg-white/80 border border-[#0F172A]/5 flex items-center justify-center text-[#475569]"
              aria-label="Clear captions"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model loading */}
        {warming && (
          <ModelLoadingBadge modelName="Whisper speech model" progress={loadProgress} className="mb-3" />
        )}

        {/* Listen button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleToggle}
          disabled={warming || !supported}
          className={`w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-3 shadow-lg transition-all disabled:opacity-50 ${
            listening
              ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white shadow-[#3B82F6]/20'
              : 'bg-white/80 text-[#475569] border border-[#0F172A]/8'
          }`}
        >
          {warming ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /> Loading Whisper AI…</>
          ) : listening ? (
            <><Mic className="w-5 h-5" /> Listening — On-Device Whisper</>
          ) : (
            <><MicOff className="w-5 h-5" /> Start Listening</>
          )}
        </motion.button>

        {/* Listening animation */}
        {listening && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 rounded-2xl p-3.5 border border-[#3B82F6]/20"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-3 h-3 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-full flex-shrink-0"
              />
              <p className="text-[#0F172A] text-sm font-medium">
                {interim || 'Analysing audio on-device…'}
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!supported && (
          <p className="mt-3 text-sm text-[#F59E0B]">
            Microphone not available in this browser.
          </p>
        )}
      </div>

      {/* Captions stream */}
      <div
        ref={scrollRef}
        className="flex-1 px-6 py-5 overflow-y-auto space-y-3 hide-scrollbar"
      >
        {captions.length === 0 && !listening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 rounded-3xl flex items-center justify-center mb-4">
              <Mic className="w-10 h-10 text-[#3B82F6]/50" />
            </div>
            <p className="text-[#475569] text-base font-medium">Tap "Start Listening" to begin</p>
            <p className="text-[#94A3B8] text-sm mt-1">On-device Whisper — no cloud required</p>
          </motion.div>
        )}

        <AnimatePresence>
          {captions.map((caption, idx) => (
            <motion.div
              key={caption.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-md border border-[#0F172A]/5"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-[#0F172A] text-sm">{caption.speaker}</span>
                    <span className="text-xs text-[#94A3B8]">{caption.time}</span>
                  </div>
                  <p className="text-[#0F172A] text-base leading-relaxed">{caption.text}</p>
                  {showEmotions && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span aria-hidden="true">{caption.emoji}</span>
                      <span className="text-sm text-[#475569] capitalize">{caption.emotion}</span>
                    </div>
                  )}
                </div>
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
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-[#0F172A]/5"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-[#0F172A] flex items-center gap-2 text-sm">
                <Volume2 className="w-4 h-4 text-[#3B82F6]" />
                AI Summary
              </h3>
              <button
                onClick={handleSpeakSummary}
                className="text-xs text-[#3B82F6] font-medium"
              >
                Read aloud
              </button>
            </div>
            <p className="text-[#475569] text-sm leading-relaxed">{summary}</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
