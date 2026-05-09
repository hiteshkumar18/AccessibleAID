import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, AlertTriangle, Flame, Navigation as NavIcon,
  Radio, Eye, Volume2, Zap, Shield, Camera, RefreshCw,
} from 'lucide-react';
import { useCamera } from '../hooks/useCamera.js';
import { useEmergencyCamera } from '../hooks/useEmergencyCamera.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';
import { useLumyn } from '../context/LumynContext.jsx';
import { vibrate } from '../utils/haptics.js';

const SEVERITY_STYLES = {
  critical: 'bg-red-500/90 border-red-300/60 text-white',
  high: 'bg-orange-500/90 border-orange-300/60 text-white',
  medium: 'bg-yellow-500/90 border-yellow-300/60 text-white',
  low: 'bg-blue-500/80 border-blue-300/60 text-white',
};

const SEVERITY_GLOW = {
  critical: 'bg-red-500/60',
  high: 'bg-orange-500/60',
  medium: 'bg-yellow-500/60',
  low: 'bg-blue-500/50',
};

export default function EmergencyCamera() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const { videoRef, start, stop, active, error: cameraError, supported } = useCamera({ facingMode: 'environment' });
  const {
    scanning, hazards, evacuationPath, navigationSteps, threatLevel,
    accessibleExitFound, error: aiError,
    analyzeForEmergency, startContinuousScan, stopContinuousScan,
  } = useEmergencyCamera();
  const { speak } = useSpeech();
  const [narrateMode, setNarrateMode] = useState(false);
  const [isInitialScan, setIsInitialScan] = useState(true);
  const fileInputRef = useRef(null);

  // Initial 2-second "scanning" cinematic effect
  useEffect(() => {
    const t = setTimeout(() => setIsInitialScan(false), 2200);
    return () => clearTimeout(t);
  }, []);

  // Start camera on mount
  useEffect(() => {
    start();
    return () => {
      stop();
      stopContinuousScan();
    };
  }, []);

  const handleStartScan = () => {
    vibrate('warning');
    startContinuousScan(videoRef.current, 3000);
    if (narrateMode) {
      speak('Emergency scan started. Analysing environment for hazards.');
    }
  };

  const handleNarrate = () => {
    const newMode = !narrateMode;
    setNarrateMode(newMode);
    if (newMode && navigationSteps.length > 0) {
      speak(navigationSteps.join('. '));
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = await analyzeForEmergency(ev.target.result);
      if (narrateMode && result?.navigationSteps) {
        speak(result.navigationSteps.join('. '));
      }
    };
    reader.readAsDataURL(file);
  };

  const threatBannerConfig = {
    critical: { bg: 'from-red-500/95 to-orange-500/95', border: 'border-red-400/40', icon: <Flame className="w-8 h-8 text-white" />, title: 'Critical Hazard Detected', subtitle: 'Evacuate immediately' },
    high: { bg: 'from-orange-500/95 to-yellow-500/95', border: 'border-orange-400/40', icon: <AlertTriangle className="w-8 h-8 text-white" />, title: 'High Danger Area', subtitle: 'Proceed with caution' },
    medium: { bg: 'from-yellow-500/95 to-amber-500/95', border: 'border-yellow-400/40', icon: <AlertTriangle className="w-8 h-8 text-white" />, title: 'Hazard Nearby', subtitle: 'AI identifying safe route' },
    low: { bg: 'from-blue-500/95 to-cyan-500/95', border: 'border-blue-400/40', icon: <Shield className="w-8 h-8 text-white" />, title: 'Minor Obstacles Detected', subtitle: 'Navigating around hazards' },
    none: { bg: 'from-emerald-500/95 to-teal-500/95', border: 'border-emerald-400/40', icon: <Shield className="w-8 h-8 text-white" />, title: 'Environment Clear', subtitle: 'No hazards detected' },
  };

  const banner = threatBannerConfig[threatLevel] || threatBannerConfig.none;

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Cinematic background */}
      <div className="absolute inset-0">
        <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black">
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(239,68,68,0.3),transparent_60%)]"
          />
          <motion.div
            animate={{ opacity: [0.15, 0.4, 0.15], scale: [1.1, 1, 1.1] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(251,146,60,0.25),transparent_50%)]"
          />
        </div>
      </div>

      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        aria-label="Emergency camera feed"
      />

      {/* AR scan line */}
      {(isInitialScan || scanning) && (
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: '100%' }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-70 shadow-[0_0_20px_rgba(34,211,238,0.8)] z-20 pointer-events-none"
        />
      )}

      {/* Camera grid overlay */}
      <div className="absolute inset-0 camera-grid opacity-10 z-10 pointer-events-none" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,black_100%)] opacity-40 pointer-events-none z-10" />

      {/* Initial scan animation */}
      <AnimatePresence>
        {isInitialScan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -inset-16 blur-[60px] bg-cyan-500/60 rounded-full"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <Camera className="w-20 h-20 text-cyan-400 drop-shadow-2xl" strokeWidth={1.5} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 h-screen flex flex-col">
        {/* Header */}
        <div className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { stop(); stopContinuousScan(); navigate('/emergency'); }}
              className="w-12 h-12 bg-black/60 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10"
              aria-label="Go back to emergency selector"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </motion.button>

            <div className="flex gap-2">
              <PrivacyBadge variant="compact" />
              <motion.button
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={handleNarrate}
                aria-pressed={narrateMode}
                className={`px-4 py-2 rounded-xl backdrop-blur-2xl flex items-center gap-2 border shadow-xl transition-all ${
                  narrateMode
                    ? 'bg-cyan-500/40 border-cyan-400/60 text-cyan-100'
                    : 'bg-black/60 border-white/10 text-white hover:bg-black/70'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Narrate</span>
              </motion.button>
            </div>
          </div>

          {/* Threat banner */}
          <motion.div
            key={threatLevel}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative group"
          >
            <div className={`absolute -inset-1 bg-gradient-to-r ${banner.bg} rounded-3xl blur-xl opacity-50 group-hover:opacity-70 ${threatLevel === 'critical' ? 'animate-pulse' : ''}`} />
            <div className={`relative bg-gradient-to-r ${banner.bg} backdrop-blur-2xl rounded-2xl p-5 border ${banner.border} shadow-2xl`}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                  {banner.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                    {banner.title}
                    {scanning && <Zap className="w-5 h-5 animate-pulse" />}
                  </h3>
                  <p className="text-white/95 text-sm">{banner.subtitle}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hazard overlays */}
        <div className="flex-1 relative px-5">
          <AnimatePresence>
            {hazards.map((hazard, i) => (
              <motion.div
                key={hazard.id || i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', bounce: 0.4 }}
                style={{
                  position: 'absolute',
                  left: `${hazard.position?.x ?? 20 + i * 18}%`,
                  top: `${hazard.position?.y ?? 25 + i * 15}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute -inset-6 blur-2xl rounded-full ${SEVERITY_GLOW[hazard.severity] || 'bg-yellow-500/60'}`}
                />
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`relative px-4 py-2.5 rounded-xl backdrop-blur-2xl border-2 shadow-2xl ${SEVERITY_STYLES[hazard.severity] || SEVERITY_STYLES.medium}`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />
                    <span className="text-sm font-bold whitespace-nowrap">{hazard.label}</span>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI evacuation path SVG */}
          {evacuationPath.length > 1 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.6))' }}
            >
              <defs>
                <linearGradient id="evacPath" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <motion.polyline
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.5, delay: 0.8, ease: 'easeOut' }}
                points={evacuationPath.map((p) => `${p.x}%,${p.y}%`).join(' ')}
                stroke="url(#evacPath)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="12 6"
              />
              {evacuationPath.map((pt, i) => (
                <motion.circle
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ delay: 0.8 + i * 0.12, scale: { duration: 1.5, repeat: Infinity } }}
                  cx={`${pt.x}%`}
                  cy={`${pt.y}%`}
                  r="7"
                  fill="#22D3EE"
                />
              ))}
            </svg>
          )}
        </div>

        {/* Navigation panel */}
        <div className="p-5 md:p-6 space-y-3">
          {/* Steps */}
          {navigationSteps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative bg-gradient-to-r from-cyan-500/95 to-emerald-500/95 backdrop-blur-2xl rounded-2xl p-5 border border-cyan-400/40 shadow-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                    <NavIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                      {accessibleExitFound ? 'Accessible Exit Found' : 'Calculating Route…'}
                      <Shield className="w-4 h-4" />
                    </h3>
                    <p className="text-white/90 text-sm">AI-guided evacuation — on-device</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {navigationSteps.slice(0, 4).map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-white/15 backdrop-blur-xl rounded-xl p-3 border border-white/20"
                    >
                      <div className="flex-shrink-0 w-7 h-7 bg-white/25 rounded-lg flex items-center justify-center ring-1 ring-white/30">
                        <span className="text-white text-sm font-bold">{i + 1}</span>
                      </div>
                      <p className="text-white text-sm font-medium">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {!scanning ? (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartScan}
                disabled={!active}
                className="relative group disabled:opacity-50"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-3xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative bg-gradient-to-r from-cyan-500 to-emerald-500 text-white py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-2xl">
                  <Eye className="w-5 h-5" />
                  <span>Start AI Scan</span>
                </div>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => stopContinuousScan()}
                className="bg-white/15 backdrop-blur-2xl text-white py-4 px-4 rounded-2xl border border-white/20 font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Scanning…</span>
              </motion.button>
            )}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/family-safety')}
              className="bg-white/15 backdrop-blur-2xl text-white py-4 px-4 rounded-2xl border border-white/20 font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <Radio className="w-5 h-5" />
              <span>Alert Family</span>
            </motion.button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="sr-only"
            aria-label="Upload image for emergency analysis"
          />
        </div>
      </div>
    </div>
  );
}
