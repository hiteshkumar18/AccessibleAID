import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Camera, Volume2, Pill, AlertCircle, RefreshCw, Heart, X } from 'lucide-react';
import { useRAG } from '../hooks/useRAG.js';
import { useCamera } from '../hooks/useCamera.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

const FIRST_AID_GUIDES = [
  { title: 'CPR', steps: ['Call 911', 'Place heel of hand on center of chest', 'Push hard and fast: 100-120/min', 'Give 2 rescue breaths every 30 compressions'], icon: Heart },
  { title: 'Bleeding', steps: ['Apply firm pressure with clean cloth', 'Do not remove cloth if soaked — add more on top', 'Elevate the injured limb', 'Seek emergency care for severe bleeding'], icon: AlertCircle },
  { title: 'Choking', steps: ['Ask "Are you choking?"', '5 back blows between shoulder blades', '5 abdominal thrusts (Heimlich)', 'Alternate until object dislodges or unconscious'], icon: AlertCircle },
];

export default function MedicalAssistant() {
  const navigate = useNavigate();
  const { search, count } = useRAG();
  const { videoRef, start, stop, active, error: cameraError } = useCamera({ facingMode: 'environment' });
  const { speak } = useSpeech();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('');
  const [identifyError, setIdentifyError] = useState('');
  const [tab, setTab] = useState('medications');
  const [selectedGuide, setSelectedGuide] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = search(query, 4);
      setResults(res);
      if (res.length > 0) {
        speak(`Found ${res.length} result${res.length > 1 ? 's' : ''}. Top match: ${res[0].payload.name}.`);
      }
    } catch (_) {}
    setSearching(false);
  };

  const handleCameraIdentify = async () => {
    if (identifying) return;
    setIdentifying(true);
    setIdentifyError('');
    setCameraStatus('Starting camera…');
    setResults([]);

    const ok = await start();
    if (!ok) {
      setIdentifying(false);
      setCameraStatus('');
      setIdentifyError(cameraError || 'Could not start camera.');
      return;
    }

    // Let camera warm up and focus.
    setCameraStatus('Focusing — hold steady…');
    await new Promise((r) => setTimeout(r, 1800));

    const dataUrl = captureFrameToDataURL(videoRef.current, 800);
    stop();

    if (!dataUrl) {
      setIdentifying(false);
      setCameraStatus('');
      setIdentifyError('Frame capture failed. Point the camera at the medication label and try again.');
      return;
    }

    // Run OCR + VLM in parallel for best label reading accuracy.
    setCameraStatus('Reading label with AI…');
    try {
      const [ocrRes, captionRes] = await Promise.allSettled([
        fetch('/api/infer/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        }).then((r) => r.json()),

        fetch('/api/infer/caption', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: [
                { type: 'image', url: dataUrl },
                {
                  type: 'text',
                  text: 'Identify this medication. Read the label exactly if visible: brand name, generic name, strength, and dosage form. If the label is not clear, describe the pill colour, shape, and any imprint. Reply in 1–2 sentences only.',
                },
              ],
            }],
            max_new_tokens: 80,
          }),
        }).then((r) => r.json()),
      ]);

      const ocrText = ocrRes.status === 'fulfilled' ? (ocrRes.value?.text || '') : '';
      const caption = captionRes.status === 'fulfilled' ? (captionRes.value?.text || '') : '';
      const combined = [ocrText, caption].filter(Boolean).join(' ').trim();

      if (combined) {
        setQuery(combined.slice(0, 120));
        const res = search(combined, 4);
        setResults(res);
        if (res.length > 0) {
          speak(`Found a match: ${res[0].payload.name}. ${res[0].payload.dosage}`);
        } else {
          speak(caption || ocrText || 'Could not identify the medication.');
        }
      } else {
        setIdentifyError('Could not read the label. Make sure the text is in focus and well-lit.');
      }
    } catch (e) {
      setIdentifyError('AI identification failed. Check that the backend server is running.');
    }

    setIdentifying(false);
    setCameraStatus('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#FFF5F5] to-[#FFF0F0] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { stop(); navigate('/home'); }}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Medical Assistant</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        <div className="bg-[#FFF3CD] border border-[#FFC107]/30 rounded-2xl p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-[#856404] text-xs">For information only. In an emergency, call 911. Not a substitute for medical advice.</p>
        </div>

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

      <div className="px-6 mt-6 space-y-4 pb-8">
        {tab === 'medications' && (
          <>
            <div className="flex items-center gap-2 text-[#10B981] text-sm">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              Local knowledge base · {count} medications
            </div>

            {/* Search row */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g. Tylenol, ibuprofen, aspirin…"
                  className="w-full pl-10 pr-4 py-3 bg-white/80 border border-[#0F172A]/10 rounded-2xl text-[#0F172A] text-base placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30 shadow-sm"
                />
              </div>
              <button onClick={handleSearch} disabled={searching}
                className="w-12 h-12 bg-gradient-to-r from-[#EF4444] to-[#F59E0B] rounded-2xl flex items-center justify-center text-white disabled:opacity-50 shadow-lg"
              >
                {searching ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>

            {/* Camera identify button */}
            <button
              onClick={handleCameraIdentify}
              disabled={identifying}
              className="w-full py-3.5 bg-white/80 border border-[#0F172A]/8 rounded-2xl font-medium flex items-center justify-center gap-2 text-[#475569] shadow-sm hover:border-[#EF4444]/20 transition-all disabled:opacity-60"
            >
              {identifying ? (
                <><RefreshCw className="w-5 h-5 text-[#EF4444] animate-spin" />{cameraStatus}</>
              ) : (
                <><Camera className="w-5 h-5 text-[#EF4444]" />Identify medication with camera</>
              )}
            </button>

            {/* Live camera preview — shown while camera is active */}
            {active && (
              <div className="relative rounded-2xl overflow-hidden bg-black shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-2xl"
                />
                <button
                  onClick={() => { stop(); setIdentifying(false); setCameraStatus(''); }}
                  className="absolute top-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-0 right-0 text-center">
                  <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">{cameraStatus}</span>
                </div>
              </div>
            )}

            {identifyError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {identifyError}
              </div>
            )}

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
                      {r.payload.dosage && (
                        <p className="text-[#64748B] text-xs mt-1">Dosage: {r.payload.dosage}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => speak(`${r.payload.name}: ${r.payload.description}. Dosage: ${r.payload.dosage}`)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium"
                  >
                    <Volume2 className="w-3.5 h-3.5" />Read aloud
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {results.length === 0 && query && !searching && !identifying && (
              <p className="text-center text-[#94A3B8] text-sm py-4">No medications found for &ldquo;{query}&rdquo;</p>
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
                  <button onClick={() => setSelectedGuide(isOpen ? null : guide.title)}
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
                          <button onClick={() => speak(guide.steps.join('. '))}
                            className="mt-2 flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium"
                          >
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
