import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Users, Volume2, Lightbulb, Navigation,
  TrendingUp, AlertTriangle, RefreshCw, Clock, X,
} from 'lucide-react';
import { useSceneUnderstanding } from '../hooks/useSceneUnderstanding.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';
import { CameraCapture } from '../components/shared/CameraCapture.jsx';

export default function WorldUnderstanding() {
  const navigate = useNavigate();
  const { analyzeFrame, busy, caption, detections, hazards, error } = useSceneUnderstanding();
  const { speak } = useSpeech();

  const [image, setImage]       = useState(null);
  const [analysed, setAnalysed] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
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
    setAnalysed(false);
    const res = await analyzeFrame(dataUrl);
    if (res) { setAnalysed(true); speak(res.narrative); }
  };

  const noHazards  = hazards.length === 0;
  const crowdCount = detections.filter((d) => d.label === 'person').length;
  const hasStairs  = detections.some((d) => d.label?.toLowerCase() === 'stairs');

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-8">

      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Environmental Awareness</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">

        {/* Captured image preview */}
        <AnimatePresence>
          {image && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-[#1E293B] shadow-xl"
            >
              <img src={image} alt="Captured environment" className="w-full object-contain max-h-[45vh]" />
              <button
                onClick={() => { setImage(null); setAnalysed(false); }}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Busy overlay */}
              {busy && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="bg-black/80 backdrop-blur-xl rounded-2xl px-5 py-4 flex flex-col items-center gap-2 border border-white/10">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                    <p className="text-white text-sm font-medium">Analysing on device…</p>
                    <div className="flex items-center gap-1 text-white/40 text-xs">
                      <Clock className="w-3 h-3" />
                      <span>{elapsedSec}s</span>
                      {elapsedSec >= 6 && <span className="text-cyan-400/60"> · results stream in</span>}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera capture widget — full-screen viewfinder, single shot */}
        <CameraCapture
          onCapture={handleCapture}
          busy={busy}
          captureLabel="Capture environment"
        />

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 border border-red-200">{error}</div>
        )}

        {/* AI analysis result */}
        <AnimatePresence>
          {caption && (
            <motion.div
              key="caption"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl p-5 shadow-lg border border-white/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">AI Scene Analysis</p>
                  <p className="text-white/60 text-xs">On-device · DETR-101 + SmolVLM 500M</p>
                </div>
                <button onClick={() => speak(caption)}>
                  <Volume2 className="w-5 h-5 text-white/70" />
                </button>
              </div>
              <p className="text-white/95 text-sm leading-relaxed">{caption}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stat cards */}
        {analysed && (
          <div className="grid grid-cols-2 gap-3">
            <EnvCard icon={<Users className="w-6 h-6" />}       title="People"  value={crowdCount > 0 ? `${crowdCount} detected` : 'None'}          color="blue" />
            <EnvCard icon={<TrendingUp className="w-6 h-6" />}  title="Objects" value={detections.length > 0 ? `${detections.length} items` : 'Clear'} color="emerald" />
            <EnvCard icon={<Navigation className="w-6 h-6" />}  title="Stairs"  value={hasStairs ? 'Detected ⚠' : 'None'}                             color={hasStairs ? 'yellow' : 'teal'} />
            <EnvCard icon={<AlertTriangle className="w-6 h-6" />} title="Hazards" value={noHazards ? 'None' : `${hazards.length} found`}              color={noHazards ? 'teal' : 'red'} />
          </div>
        )}

        {/* Detected objects */}
        {detections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 rounded-2xl p-4 shadow-md border border-[#0F172A]/5"
          >
            <h3 className="font-semibold text-[#0F172A] text-sm mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />Detected Objects
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {detections.map((d, i) => (
                <span key={i} className="text-xs text-[#0F172A] bg-[#F1F5F9] px-2.5 py-1 rounded-full border border-[#0F172A]/8 font-medium">
                  {d.label} <span className="text-[#94A3B8]">{Math.round(d.score * 100)}%</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Hazard / safe status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl p-4 border shadow-md ${
            analysed && noHazards
              ? 'bg-[#10B981]/10 border-[#10B981]/20'
              : hazards.length > 0
              ? 'bg-[#EF4444]/10 border-[#EF4444]/20'
              : 'bg-white/80 border-[#0F172A]/5'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${analysed && noHazards ? 'text-[#10B981]' : 'text-[#F59E0B]'}`} />
            <div>
              <p className="font-semibold text-[#0F172A] text-sm">
                {analysed
                  ? noHazards ? 'No Hazards Detected' : `${hazards.length} Hazard(s) Detected`
                  : 'Take a photo to analyse your environment'}
              </p>
              <p className="text-[#475569] text-sm mt-0.5">
                {analysed
                  ? noHazards ? 'Environment appears safe.' : hazards.map((h) => h.label).join(', ')
                  : 'On-device AI detects hazards, obstacles, and accessibility info.'}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/navigation')}
          className="w-full py-3.5 bg-white/90 text-[#0F172A] rounded-2xl border border-[#0F172A]/8 font-medium shadow-md flex items-center justify-center gap-2"
        >
          <Navigation className="w-4 h-4" /> Open Navigation
        </motion.button>
      </div>
    </div>
  );
}

function EnvCard({ icon, title, value, color }) {
  const c = {
    blue:    'from-[#3B82F6] to-[#14B8A6]',
    emerald: 'from-[#10B981] to-[#14B8A6]',
    yellow:  'from-[#F59E0B] to-[#FB923C]',
    teal:    'from-[#14B8A6] to-[#10B981]',
    red:     'from-[#EF4444] to-[#F59E0B]',
  }[color];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 rounded-2xl p-4 shadow-md border border-[#0F172A]/5">
      <div className={`w-10 h-10 bg-gradient-to-r ${c} rounded-xl flex items-center justify-center text-white mb-2`}>{icon}</div>
      <p className="text-xs text-[#475569] mb-0.5 font-medium">{title}</p>
      <p className="font-bold text-[#0F172A] text-sm">{value}</p>
    </motion.div>
  );
}
