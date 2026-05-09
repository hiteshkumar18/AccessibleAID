import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Camera, Volume2, AlertCircle, Navigation, Lightbulb,
  Users, Eye, Cpu, RefreshCw,
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera.js';
import { useSceneUnderstanding } from '../hooks/useSceneUnderstanding.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { PrivacyBadge, ProcessingIndicator } from '../components/shared/PrivacyBadge.jsx';
import { useLumyn } from '../context/LumynContext.jsx';

export default function SceneCamera() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const { videoRef, start, stop, active, error: cameraError, supported } = useCamera({ facingMode: 'environment' });
  const { analyzeFrame, busy, caption, detections, hazards, narrative, error: aiError } = useSceneUnderstanding();
  const { speak } = useSpeech();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [autoNarrate, setAutoNarrate] = useState(false);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const handleCapture = async () => {
    const dataUrl = captureFrameToDataURL(videoRef.current, 640);
    if (!dataUrl) return;
    setPreview(dataUrl);
    const result = await analyzeFrame(dataUrl);
    if (autoNarrate && result?.narrative) {
      speak(result.narrative);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      const result = await analyzeFrame(dataUrl);
      if (autoNarrate && result?.narrative) speak(result.narrative);
    };
    reader.readAsDataURL(file);
  };

  const colorMap = { critical: 'bg-red-500/90 border-red-300/60', high: 'bg-orange-500/90 border-orange-300/60', medium: 'bg-yellow-500/90 border-yellow-300/60' };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Camera / preview background */}
      <div className="absolute inset-0">
        {preview ? (
          <img src={preview} alt="Captured scene" className="w-full h-full object-cover opacity-70" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black relative">
            <motion.div
              animate={{ opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 via-cyan-900/10 to-emerald-900/20"
            />
          </div>
        )}
      </div>

      {/* Scan line when active */}
      {active && !busy && (
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: '100vh' }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60 z-20 pointer-events-none"
        />
      )}

      {/* AR grid overlay */}
      {active && (
        <div className="absolute inset-0 camera-grid opacity-10 z-10 pointer-events-none" />
      )}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,black_100%)] opacity-30 pointer-events-none z-10" />

      {/* Camera corners */}
      {active && (
        <>
          <div className="camera-corner camera-corner-tl z-20" />
          <div className="camera-corner camera-corner-tr z-20" />
          <div className="camera-corner camera-corner-bl z-20" />
          <div className="camera-corner camera-corner-br z-20" />
        </>
      )}

      {/* Live video (hidden from layout, feeds the stream) */}
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-80" aria-label="Camera preview" />

      <div className="relative z-30 h-screen flex flex-col p-5 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { stop(); navigate('/home'); }}
            className="w-12 h-12 bg-black/50 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </motion.button>

          <div className="flex gap-2 items-center">
            <PrivacyBadge variant="compact" />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setAutoNarrate(!autoNarrate)}
              aria-pressed={autoNarrate}
              className={`px-3 py-2 rounded-xl backdrop-blur-xl border text-sm flex items-center gap-2 transition-all ${
                autoNarrate
                  ? 'bg-cyan-500/40 border-cyan-400/60 text-cyan-100'
                  : 'bg-black/50 border-white/10 text-white'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Narrate</span>
            </motion.button>
          </div>
        </div>

        {/* Hazard overlays */}
        <div className="flex-1 relative">
          <AnimatePresence>
            {hazards.map((h, i) => (
              <motion.div
                key={h.id || i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', bounce: 0.4 }}
                style={{
                  position: 'absolute',
                  left: `${h.position?.x ?? 30 + i * 15}%`,
                  top: `${h.position?.y ?? 30 + i * 10}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute -inset-6 blur-2xl rounded-full ${
                    h.severity === 'critical' ? 'bg-red-500/60' : h.severity === 'high' ? 'bg-orange-500/60' : 'bg-yellow-500/60'
                  }`}
                />
                <div className={`relative px-4 py-2.5 rounded-xl backdrop-blur-2xl border-2 shadow-2xl ${colorMap[h.severity]}`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
                    <span className="text-white text-sm font-bold whitespace-nowrap">{h.label}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI processing indicator */}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="bg-black/70 backdrop-blur-xl rounded-2xl px-6 py-4 flex items-center gap-3 border border-white/10"
              >
                <Cpu className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-white text-sm font-medium">Analyzing scene on device…</span>
              </motion.div>
            </div>
          )}
        </div>

        {/* Bottom panel */}
        <div className="space-y-3 mt-4">
          {/* Scene description */}
          {caption && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Scene Understanding</span>
              </div>
              <p className="text-white text-sm leading-relaxed">{caption}</p>
              {detections.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detections.slice(0, 5).map((d, i) => (
                    <span key={i} className="text-xs text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-400/30">
                      {d.label}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Error */}
          {(cameraError || aiError) && (
            <div className="bg-red-500/20 backdrop-blur-xl rounded-2xl p-3 border border-red-400/30 text-red-200 text-sm">
              {cameraError || aiError}
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            {!active ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={start}
                disabled={!supported}
                className="col-span-1 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                Start Camera
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCapture}
                disabled={busy}
                className="col-span-1 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {busy
                  ? <><RefreshCw className="w-5 h-5 animate-spin" /> Analyzing…</>
                  : <><Camera className="w-5 h-5" /> Describe Scene</>}
              </motion.button>
            )}

            <div className="grid grid-rows-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/navigation')}
                className="bg-white/10 backdrop-blur-xl text-white py-2 px-3 rounded-xl border border-white/20 font-medium flex items-center justify-center gap-1 text-sm"
              >
                <Navigation className="w-4 h-4" /> Navigate
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 backdrop-blur-xl text-white py-2 px-3 rounded-xl border border-white/20 font-medium flex items-center justify-center gap-1 text-sm"
              >
                <Lightbulb className="w-4 h-4" /> Upload Image
              </motion.button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="sr-only"
            aria-label="Upload image for scene analysis"
          />
        </div>
      </div>
    </div>
  );
}
