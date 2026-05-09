import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Users, Volume2, Lightbulb, Navigation, TrendingUp, AlertTriangle, Camera, RefreshCw } from 'lucide-react';
import { useCamera } from '../hooks/useCamera.js';
import { useSceneUnderstanding } from '../hooks/useSceneUnderstanding.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

export default function WorldUnderstanding() {
  const navigate = useNavigate();
  const { videoRef, start, stop, active } = useCamera({ facingMode: 'environment' });
  const { analyzeFrame, busy, caption, detections, hazards, error } = useSceneUnderstanding();
  const { speak } = useSpeech();
  const [analysed, setAnalysed] = useState(false);
  const fileRef = useRef(null);

  const handleAnalyse = async () => {
    const dataUrl = captureFrameToDataURL(videoRef.current, 640);
    if (dataUrl) {
      const res = await analyzeFrame(dataUrl);
      if (res) {
        setAnalysed(true);
        speak(res.narrative);
      }
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const res = await analyzeFrame(ev.target.result);
      if (res) { setAnalysed(true); speak(res.narrative); }
    };
    reader.readAsDataURL(file);
  };

  const noHazards = hazards.length === 0;
  const crowdCount = detections.filter((d) => d.label === 'person').length;
  const hasStairs = detections.some((d) => ['stairs'].includes(d.label?.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-8 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { stop(); navigate('/home'); }} className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5">
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Environmental Awareness</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Camera + analyse */}
        <div className="relative bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl overflow-hidden h-40 shadow-xl mb-4">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-70" />
          {!active && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="w-10 h-10 text-[#14B8A6]/50" />
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex items-center gap-2 text-white text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />Analysing on device…
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!active
            ? <button onClick={start} className="flex-1 py-3 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-2"><Camera className="w-5 h-5" />Start Camera</button>
            : <button onClick={handleAnalyse} disabled={busy} className="flex-1 py-3 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white rounded-2xl font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"><Camera className="w-5 h-5" />Analyse Environment</button>}
          <button onClick={() => fileRef.current?.click()} className="px-4 py-3 bg-white/80 text-[#475569] rounded-2xl border border-[#0F172A]/8 font-medium text-sm">Upload</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
      </div>

      <div className="px-6 mt-6 space-y-4">
        {/* Scene analysis result */}
        {caption && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl p-5 shadow-lg border border-white/20"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Scene Analysis</h3>
                <p className="text-white/70 text-xs">Processed locally · ViT-GPT2 + DETR</p>
              </div>
            </div>
            <p className="text-white/95 text-sm leading-relaxed">{caption}</p>
          </motion.div>
        )}

        {/* Environment cards */}
        <div className="grid grid-cols-2 gap-3">
          <EnvCard icon={<Users className="w-6 h-6" />} title="People Detected" value={crowdCount > 0 ? `${crowdCount} visible` : analysed ? 'None' : '—'} color="blue" />
          <EnvCard icon={<Volume2 className="w-6 h-6" />} title="Scene Objects" value={detections.length > 0 ? `${detections.length} items` : analysed ? 'Clear' : '—'} color="emerald" />
          <EnvCard icon={<Navigation className="w-6 h-6" />} title="Stairs / Steps" value={hasStairs ? 'Detected' : analysed ? 'None' : '—'} color={hasStairs ? 'yellow' : 'teal'} />
          <EnvCard icon={<TrendingUp className="w-6 h-6" />} title="Hazards" value={analysed ? (noHazards ? 'None' : `${hazards.length} found`) : '—'} color={!noHazards && analysed ? 'red' : 'teal'} />
        </div>

        {/* Detections list */}
        {detections.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 rounded-2xl p-5 shadow-md border border-[#0F172A]/5"
          >
            <h3 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />Detected Objects
            </h3>
            <div className="flex flex-wrap gap-2">
              {detections.map((d, i) => (
                <span key={i} className="text-xs text-[#0F172A] bg-[#F1F5F9] px-2.5 py-1 rounded-full border border-[#0F172A]/8 font-medium">
                  {d.label} <span className="text-[#94A3B8]">{Math.round(d.score * 100)}%</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Hazard status */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={`rounded-2xl p-5 border ${noHazards && analysed ? 'bg-[#10B981]/10 border-[#10B981]/20' : hazards.length > 0 ? 'bg-[#EF4444]/10 border-[#EF4444]/20' : 'bg-white/80 border-[#0F172A]/5'} shadow-md`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${noHazards && analysed ? 'text-[#10B981]' : 'text-[#F59E0B]'}`} />
            <div>
              <h3 className="font-semibold text-[#0F172A] mb-1 text-sm">
                {analysed ? (noHazards ? 'No Hazards Detected' : `${hazards.length} Hazard(s) Detected`) : 'Point camera to analyse environment'}
              </h3>
              <p className="text-[#475569] text-sm">
                {analysed
                  ? noHazards
                    ? 'Environment appears safe. AI monitoring is active.'
                    : hazards.map((h) => h.label).join(', ')
                  : 'On-device AI will analyse scene for hazards, obstacles, and accessibility information.'}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/scene-camera')} className="bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white py-4 rounded-2xl font-medium shadow-lg">Open Camera</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/navigation')} className="bg-white/80 text-[#0F172A] py-4 rounded-2xl border border-[#0F172A]/5 font-medium shadow-md">Navigate</motion.button>
        </div>
      </div>
    </div>
  );
}

function EnvCard({ icon, title, value, color }) {
  const c = { blue: 'from-[#3B82F6] to-[#14B8A6]', emerald: 'from-[#10B981] to-[#14B8A6]', yellow: 'from-[#F59E0B] to-[#FB923C]', teal: 'from-[#14B8A6] to-[#10B981]', red: 'from-[#EF4444] to-[#F59E0B]' }[color];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 rounded-2xl p-4 shadow-md border border-[#0F172A]/5">
      <div className={`w-11 h-11 bg-gradient-to-r ${c} rounded-xl flex items-center justify-center text-white mb-3`}>{icon}</div>
      <p className="text-xs text-[#475569] mb-0.5 font-medium">{title}</p>
      <p className="font-bold text-[#0F172A] text-sm">{value}</p>
    </motion.div>
  );
}
