import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Volume2, AlertCircle, Eye,
  RefreshCw, X, Navigation, Clock,
} from 'lucide-react';
import { useSceneUnderstanding } from '../hooks/useSceneUnderstanding.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';
import { CameraCapture } from '../components/shared/CameraCapture.jsx';

export default function SceneCamera() {
  const navigate = useNavigate();
  const { analyzeFrame, busy, caption, detections, hazards, error: aiError } = useSceneUnderstanding();
  const { speak } = useSpeech();

  const [image, setImage]             = useState(null);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [elapsedSec, setElapsedSec]   = useState(0);
  const elapsedRef = useRef(null);

  React.useEffect(() => {
    if (busy) {
      setElapsedSec(0);
      elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [busy]);

  const handleCapture = async (dataUrl) => {
    setImage(dataUrl);
    const result = await analyzeFrame(dataUrl);
    if (autoNarrate && result?.narrative) speak(result.narrative);
  };

  const colorMap = {
    critical: 'bg-red-500/90 border-red-300/60',
    high:     'bg-orange-500/90 border-orange-300/60',
    medium:   'bg-yellow-500/90 border-yellow-300/60',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/home')}
              className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
            >
              <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-semibold text-[#0F172A]">Scene Camera</h1>
              <PrivacyBadge variant="compact" className="mt-0.5" />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setAutoNarrate(!autoNarrate)}
            aria-pressed={autoNarrate}
            className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-2 transition-all ${
              autoNarrate
                ? 'bg-[#14B8A6]/15 border-[#14B8A6]/40 text-[#14B8A6]'
                : 'bg-white/80 border-[#0F172A]/10 text-[#475569]'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Narrate</span>
          </motion.button>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4 pb-8">

        {/* Captured image preview with hazard overlays */}
        <AnimatePresence>
          {image && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-[#1E293B] shadow-2xl"
            >
              <img src={image} alt="Captured scene" className="w-full object-contain max-h-[55vh]" />

              {/* Clear button */}
              <button
                onClick={() => setImage(null)}
                className="absolute top-3 right-3 w-9 h-9 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
                aria-label="Clear image"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Hazard overlay badges */}
              <div className="absolute inset-0 pointer-events-none">
                {hazards.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.12, type: 'spring', bounce: 0.4 }}
                    style={{
                      position: 'absolute',
                      left: `${18 + i * 20}%`,
                      top:  `${18 + i * 14}%`,
                      transform: 'translate(-50%,-50%)',
                    }}
                  >
                    <div className={`px-3 py-1.5 rounded-xl backdrop-blur-xl border-2 shadow-xl ${colorMap[h.severity] || colorMap.medium}`}>
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                        <span className="text-white text-xs font-bold whitespace-nowrap">{h.label}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Busy overlay */}
              {busy && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    className="bg-black/80 backdrop-blur-xl rounded-2xl px-6 py-5 flex flex-col items-center gap-3 border border-white/10 shadow-2xl"
                  >
                    <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                    <p className="text-white font-semibold text-sm">Analysing on device…</p>
                    <div className="flex items-center gap-1.5 text-white/40 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{elapsedSec}s</span>
                      {elapsedSec >= 6 && <span className="text-cyan-400/60"> · results stream in</span>}
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-1 w-8 rounded-full bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.28, ease: 'easeInOut' }}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera capture widget — opens full-screen viewfinder, single shot */}
        <CameraCapture
          onCapture={handleCapture}
          busy={busy}
          captureLabel="Snap & analyse"
        />

        {/* Error */}
        {aiError && (
          <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 border border-red-200">
            {aiError}
          </div>
        )}

        {/* Scene description result */}
        <AnimatePresence>
          {caption && (
            <motion.div
              key="caption"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl p-5 shadow-lg border border-white/20"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Scene Description</p>
                  <p className="text-white/60 text-xs">On-device · SmolVLM 500M + DETR-101</p>
                </div>
                <button onClick={() => speak(caption)} aria-label="Read aloud">
                  <Volume2 className="w-5 h-5 text-white/70" />
                </button>
              </div>
              <p className="text-white/95 text-sm leading-relaxed">{caption}</p>
              {detections.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {detections.slice(0, 8).map((d, i) => (
                    <span key={i} className="text-xs text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                      {d.label} <span className="opacity-60">{Math.round(d.score * 100)}%</span>
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hazard list */}
        <AnimatePresence>
          {hazards.length > 0 && (
            <motion.div
              key="hazards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 rounded-2xl p-4 border border-red-200"
            >
              <h3 className="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {hazards.length} Hazard{hazards.length > 1 ? 's' : ''} Detected
              </h3>
              <div className="space-y-1">
                {hazards.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      h.severity === 'critical' ? 'bg-red-500' : h.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-red-800 font-medium capitalize">{h.label}</span>
                    <span className="text-red-400 text-xs ml-auto">{h.severity}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigate */}
        {image && !busy && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/navigation')}
            className="w-full py-3.5 bg-white/90 text-[#0F172A] rounded-2xl font-medium border border-[#0F172A]/8 shadow-md flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Navigate to location
          </motion.button>
        )}
      </div>
    </div>
  );
}
