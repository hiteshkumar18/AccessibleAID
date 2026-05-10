import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Camera, Volume2, Pill, AlertCircle, RefreshCw, Heart } from 'lucide-react';
import { useRAG } from '../hooks/useRAG.js';
import { useCamera } from '../hooks/useCamera.js';
import { useModelLoader } from '../hooks/useModelLoader.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { PrivacyBadge, ModelLoadingBadge } from '../components/shared/PrivacyBadge.jsx';
import { useLumyn } from '../context/LumynContext.jsx';
import { MODELS } from '../config/models.js';

const FIRST_AID_GUIDES = [
  { title: 'CPR', steps: ['Call 911', 'Place heel of hand on center of chest', 'Push hard and fast: 100-120/min', 'Give 2 rescue breaths every 30 compressions'], icon: Heart },
  { title: 'Bleeding', steps: ['Apply firm pressure with clean cloth', 'Do not remove cloth if soaked — add more on top', 'Elevate the injured limb', 'Seek emergency care for severe bleeding'], icon: AlertCircle },
  { title: 'Choking', steps: ['Ask "Are you choking?"', '5 back blows between shoulder blades', '5 abdominal thrusts (Heimlich)', 'Alternate until object dislodges or unconscious'], icon: AlertCircle },
];

export default function MedicalAssistant() {
  const navigate = useNavigate();
  const { ready, error: ragError, search, count } = useRAG();
  const { videoRef, start, stop, active } = useCamera({ facingMode: 'environment' });
  const { loadVLM } = useModelLoader();
  const { speak } = useSpeech();
  const { state } = useLumyn();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState('medications'); // 'medications' | 'firstaid'
  const [selectedGuide, setSelectedGuide] = useState(null);

  const loaderEntry = Object.entries(state.loaders).find(([key]) => key.includes('feature-extraction'))?.[1];

  const handleSearch = async () => {
    if (!query.trim() || !ready) return;
    setSearching(true);
    try {
      const res = await search(query, 4);
      setResults(res);
      if (res.length > 0) {
        speak(`Found ${res.length} medications matching "${query}". Top result: ${res[0].payload.name}.`);
      }
    } catch (_) {}
    setSearching(false);
  };

  const handleCameraIdentify = async () => {
    await start();
    // Camera takes ~1.5 s to settle on most devices; once focused, snap a
    // frame and ask the VLM to read the medication label.
    setTimeout(async () => {
      const dataUrl = captureFrameToDataURL(videoRef.current, 640);
      if (!dataUrl) return;
      try {
        const vlm = await loadVLM(MODELS.CAPTION);
        const label = await vlm.generate(
          [
            {
              role: 'user',
              content: [
                { type: 'image', url: dataUrl },
                {
                  type: 'text',
                  text:
                    'You are reading a medication bottle, blister pack, or pill. ' +
                    'Reply with one short line in this exact format: ' +
                    '"<brand or generic name> – <strength>; <dosage form>". ' +
                    'If the strength or form is not visible, omit them. ' +
                    'Do not invent values. Example: "Ibuprofen – 200 mg; tablet".',
                },
              ],
            },
          ],
          { max_new_tokens: 64, do_sample: false }
        );
        if (label) {
          setQuery(label);
          const res = await search(label, 4);
          setResults(res);
          if (res.length > 0) {
            speak(`Top match for what I read: ${res[0].payload.name}.`);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Medical] camera identify failed', e);
      }
      stop();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#FFF5F5] to-[#FFF0F0] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { stop(); navigate('/home'); }} className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5">
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Medical Assistant</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-[#FFF3CD] border border-[#FFC107]/30 rounded-2xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-[#856404] text-xs">For information only. In an emergency, call 911. Not a substitute for medical advice.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['medications', 'firstaid'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all ${tab === t ? 'bg-gradient-to-r from-[#EF4444] to-[#F59E0B] text-white shadow-lg' : 'bg-white/80 text-[#475569] border border-[#0F172A]/8'}`}
            >
              {t === 'medications' ? '💊 Medications' : '🚑 First Aid'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        {tab === 'medications' && (
          <>
            {/* Loading status */}
            {!ready && loaderEntry && (
              <ModelLoadingBadge modelName="Medical AI (MiniLM embeddings)" progress={loaderEntry.progress ?? 0} />
            )}
            {ragError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-sm">{ragError}</div>
            )}
            {ready && (
              <div className="flex items-center gap-2 text-[#10B981] text-sm">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                RAG knowledge base ready · {count} medications indexed on-device
              </div>
            )}

            {/* Search */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search medications…"
                  className="w-full pl-10 pr-4 py-3 bg-white/80 border border-[#0F172A]/10 rounded-2xl text-[#0F172A] text-base placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30 shadow-sm"
                />
              </div>
              <button onClick={handleSearch} disabled={!ready || searching}
                className="w-12 h-12 bg-gradient-to-r from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center text-white disabled:opacity-50 shadow-lg"
              >
                {searching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>

            <button onClick={handleCameraIdentify}
              className="w-full py-3.5 bg-white/80 border border-[#0F172A]/8 rounded-2xl font-medium flex items-center justify-center gap-2 text-[#475569] shadow-sm hover:border-[#EF4444]/20 transition-all"
            >
              <Camera className="w-5 h-5 text-[#EF4444]" />
              Identify medication with camera
            </button>

            {/* Results */}
            <AnimatePresence>
              {results.map((r, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="bg-white/80 rounded-2xl p-5 shadow-md border border-[#0F172A]/5"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-gradient-to-r from-[#EF4444]/15 to-[#F59E0B]/15 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Pill className="w-5 h-5 text-[#EF4444]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-[#0F172A]">{r.payload.name}</h3>
                        <span className="text-xs text-[#94A3B8]">{Math.round(r.score * 100)}% match</span>
                      </div>
                      <p className="text-[#475569] text-xs mb-1">{r.payload.genericName}</p>
                      <p className="text-[#475569] text-sm leading-relaxed">{r.payload.description}</p>
                      {r.payload.appearance && (
                        <p className="text-[#64748B] text-xs mt-1.5">Appearance: {r.payload.appearance}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => speak(`${r.payload.name}: ${r.payload.description}`)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium"
                  >
                    <Volume2 className="w-3.5 h-3.5" />Read aloud
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {results.length === 0 && query && !searching && (
              <p className="text-center text-[#94A3B8] text-sm py-4">No medications found for "{query}"</p>
            )}
          </>
        )}

        {tab === 'firstaid' && (
          <div className="space-y-4">
            {FIRST_AID_GUIDES.map((guide, i) => {
              const Icon = guide.icon;
              const isOpen = selectedGuide === guide.title;
              return (
                <motion.div key={guide.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="bg-white/80 rounded-2xl shadow-md border border-[#0F172A]/5 overflow-hidden"
                >
                  <button
                    onClick={() => setSelectedGuide(isOpen ? null : guide.title)}
                    className="w-full flex items-center gap-4 p-5"
                  >
                    <div className="w-12 h-12 bg-gradient-to-r from-[#EF4444]/15 to-[#F59E0B]/15 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-[#EF4444]" />
                    </div>
                    <span className="font-bold text-[#0F172A] text-base flex-1 text-left">{guide.title}</span>
                    <span className="text-[#94A3B8] text-lg">{isOpen ? '−' : '+'}</span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-5 pb-5 space-y-2">
                          {guide.steps.map((step, j) => (
                            <div key={j} className="flex items-start gap-3">
                              <span className="w-6 h-6 bg-gradient-to-r from-[#EF4444] to-[#F59E0B] rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{j + 1}</span>
                              <p className="text-[#0F172A] text-sm leading-relaxed">{step}</p>
                            </div>
                          ))}
                          <button onClick={() => speak(guide.steps.join('. '))} className="mt-2 flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium">
                            <Volume2 className="w-3.5 h-3.5" />Read all steps aloud
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
