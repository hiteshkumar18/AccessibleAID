import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, WifiOff, Wifi, Shield, CheckCircle, AlertCircle, Download, Brain, Heart, Navigation, Camera, Volume2, Hand } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

const OFFLINE_FEATURES = [
  { icon: Camera, label: 'Environmental Awareness', desc: 'Hazard detection & scene analysis', available: true },
  { icon: Brain, label: 'Medical Assistant', desc: 'Medication lookup & first aid guides', available: true },
  { icon: Heart, label: 'Panic Reduction', desc: 'Breathing exercises & grounding', available: true },
  { icon: Navigation, label: 'Accessible Navigation', desc: 'Cached routes & step-by-step guidance', available: true },
  { icon: Hand, label: 'Sign Language', desc: 'ASL phrase dictionary', available: true },
  { icon: Volume2, label: 'Live Captioning', desc: 'On-device Whisper transcription', available: true },
];

const CACHED_GUIDANCE = [
  { title: 'Fire Emergency', steps: ['Activate nearest alarm', 'Evacuate via stairs — not elevator', 'Crawl low under smoke', 'Meet at designated assembly point'] },
  { title: 'Earthquake', steps: ['Drop, cover, hold on', 'Stay away from windows', 'If outdoors, move away from buildings', 'Expect aftershocks'] },
  { title: 'Medical Emergency', steps: ['Call 911 immediately', 'Do not move injured person', 'Apply pressure to wounds', 'Begin CPR if unresponsive & not breathing'] },
];

export default function OfflineMode() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const [expandedGuide, setExpandedGuide] = useState(null);
  const [cacheSize, setCacheSize] = useState(null);

  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        let total = 0;
        Promise.all(names.map((n) => caches.open(n).then((c) => c.keys().then((k) => { total += k.length; })))).then(() => {
          setCacheSize(total);
        });
      });
    }
  }, []);

  const isOnline = state.online;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-8">
      {/* Header */}
      <div className={`px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg ${isOnline ? 'bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA]' : 'bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E293B]'}`}>
        <div className="flex items-center gap-4 mb-5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md border ${isOnline ? 'bg-white/80 border-[#0F172A]/5' : 'bg-white/10 border-white/10'}`}
          >
            <ArrowLeft className={`w-6 h-6 ${isOnline ? 'text-[#0F172A]' : 'text-white'}`} />
          </motion.button>
          <div>
            <h1 className={`text-2xl font-semibold ${isOnline ? 'text-[#0F172A]' : 'text-white'}`}>Offline Mode</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Connection status banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-2xl p-4 flex items-center gap-3 ${isOnline ? 'bg-[#10B981]/15 border border-[#10B981]/30' : 'bg-white/10 border border-white/20'}`}
        >
          {isOnline ? (
            <Wifi className="w-6 h-6 text-[#10B981] flex-shrink-0" />
          ) : (
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
              <WifiOff className="w-6 h-6 text-[#F59E0B] flex-shrink-0" />
            </motion.div>
          )}
          <div>
            <p className={`font-semibold text-sm ${isOnline ? 'text-[#10B981]' : 'text-white'}`}>
              {isOnline ? 'Connected — Offline mode ready' : 'Offline — Emergency AI active'}
            </p>
            <p className={`text-xs mt-0.5 ${isOnline ? 'text-[#047857]' : 'text-white/60'}`}>
              {isOnline ? 'All features available. AI runs on-device regardless.' : 'All core features available without internet connection.'}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 rounded-2xl p-4 text-center shadow-md border border-[#0F172A]/5">
            <p className="text-2xl font-bold text-[#10B981]">{OFFLINE_FEATURES.length}</p>
            <p className="text-xs text-[#475569] mt-0.5">Features</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white/80 rounded-2xl p-4 text-center shadow-md border border-[#0F172A]/5">
            <p className="text-2xl font-bold text-[#3B82F6]">{cacheSize ?? '—'}</p>
            <p className="text-xs text-[#475569] mt-0.5">Cached</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/80 rounded-2xl p-4 text-center shadow-md border border-[#0F172A]/5">
            <p className="text-2xl font-bold text-[#F59E0B]">0</p>
            <p className="text-xs text-[#475569] mt-0.5">Cloud</p>
          </motion.div>
        </div>

        {/* Privacy assurance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-[#10B981]/10 to-[#14B8A6]/10 rounded-2xl p-4 border border-[#10B981]/20 flex items-start gap-3"
        >
          <Shield className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#0F172A] text-sm">100% On-Device Processing</p>
            <p className="text-[#475569] text-xs mt-0.5">Camera feeds, voice, location, and health data never leave your device. AI models run locally in your browser.</p>
          </div>
        </motion.div>

        {/* Available features */}
        <h2 className="text-lg font-bold text-[#0F172A]">Available Offline</h2>
        <div className="space-y-2">
          {OFFLINE_FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
                className="bg-white/80 rounded-2xl p-4 shadow-sm border border-[#0F172A]/5 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gradient-to-r from-[#10B981]/15 to-[#14B8A6]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#10B981]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#0F172A] text-sm">{f.label}</p>
                  <p className="text-[#475569] text-xs">{f.desc}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
              </motion.div>
            );
          })}
        </div>

        {/* Cached emergency guidance */}
        <h2 className="text-lg font-bold text-[#0F172A]">Emergency Guidance</h2>
        <div className="space-y-3">
          {CACHED_GUIDANCE.map((guide, i) => {
            const isOpen = expandedGuide === guide.title;
            return (
              <motion.div key={guide.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                className="bg-white/80 rounded-2xl shadow-md border border-[#0F172A]/5 overflow-hidden"
              >
                <button onClick={() => setExpandedGuide(isOpen ? null : guide.title)}
                  className="w-full flex items-center gap-4 p-4"
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-[#EF4444]/15 to-[#F59E0B]/15 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-[#EF4444]" />
                  </div>
                  <span className="font-semibold text-[#0F172A] text-sm flex-1 text-left">{guide.title}</span>
                  <span className="text-[#94A3B8]">{isOpen ? '−' : '+'}</span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-2">
                        {guide.steps.map((step, j) => (
                          <div key={j} className="flex items-start gap-3">
                            <span className="w-5 h-5 bg-gradient-to-r from-[#EF4444] to-[#F59E0B] rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                            <p className="text-[#0F172A] text-sm leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Cache management */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-white/80 rounded-2xl p-5 shadow-md border border-[#0F172A]/5"
        >
          <h3 className="font-semibold text-[#0F172A] mb-3 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4 text-[#3B82F6]" />AI Model Cache
          </h3>
          <p className="text-[#475569] text-xs mb-3">AI models are cached locally after first download. They remain available completely offline.</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['Whisper STT', 'MiniLM RAG', 'DETR Object', 'ViT-GPT2'].map((m) => (
              <div key={m} className="flex items-center gap-2 p-2 bg-[#F8FAFC] rounded-xl border border-[#0F172A]/5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-[#0F172A] font-medium">{m}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
