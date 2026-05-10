import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Volume2, AlertCircle, RefreshCw, X, ScanText } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech.js';
import { CameraCapture } from '../components/shared/CameraCapture.jsx';

export default function MedicalAssistant() {
  const navigate  = useNavigate();
  const { speak } = useSpeech();

  const [image,    setImage]    = useState(null);
  const [text,     setText]     = useState('');
  const [busy,     setBusy]     = useState(false);
  const [progress, setProgress] = useState('');
  const [error,    setError]    = useState(null);

  const handleCapture = async (dataUrl) => {
    setImage(dataUrl);
    setText('');
    setError(null);
    setProgress('Running macOS Vision OCR…');
    setBusy(true);

    try {
      const res = await fetch('/api/macos-ocr', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const raw  = data.text?.trim() || '';

      if (!raw) {
        setError('No text found. Try a well-lit, close-up photo of the label.');
        return;
      }

      setText(raw);
      // Auto-read aloud immediately
      speak(raw);
    } catch (err) {
      setError(err?.message || 'OCR failed.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const clear = () => {
    setImage(null);
    setText('');
    setError(null);
    setProgress('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#FFF5F5] to-[#FFF0F0] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Medical Scanner</h1>
            <p className="text-xs text-[#64748B] mt-0.5">macOS Vision · on-device</p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-5 pb-10">

        {/* Disclaimer */}
        <div className="bg-[#FFF3CD] border border-[#FFC107]/30 rounded-2xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-[#856404] text-xs">
            For reference only. Always confirm with the original label, pharmacist, or doctor.
          </p>
        </div>

        {/* Captured image */}
        <AnimatePresence>
          {image && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-3xl overflow-hidden bg-[#1E293B] shadow-xl"
            >
              <img
                src={image}
                alt="Captured label"
                className="w-full object-contain max-h-[45vh]"
              />
              <button
                onClick={clear}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {busy && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="bg-black/80 backdrop-blur-xl rounded-2xl px-6 py-4 flex flex-col items-center gap-2 border border-white/10">
                    <RefreshCw className="w-5 h-5 text-[#EF4444] animate-spin" />
                    <p className="text-white text-sm font-medium">{progress}</p>
                    <p className="text-white/40 text-xs">Apple Vision · on-device</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera */}
        <CameraCapture
          onCapture={handleCapture}
          busy={busy}
          captureLabel="Scan label"
        />

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 border border-red-200">
            {error}
          </div>
        )}

        {/* OCR result */}
        <AnimatePresence>
          {text && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-white rounded-2xl shadow-md border border-[#0F172A]/8 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <div className="w-8 h-8 bg-gradient-to-r from-[#EF4444]/15 to-[#F59E0B]/15 rounded-xl flex items-center justify-center">
                  <ScanText className="w-4 h-4 text-[#EF4444]" />
                </div>
                <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide flex-1">
                  Label text
                </p>
                <button
                  onClick={() => speak(text)}
                  className="flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium"
                >
                  <Volume2 className="w-4 h-4" />
                  Read aloud
                </button>
              </div>

              <p className="px-4 pb-4 text-[#0F172A] text-base leading-relaxed whitespace-pre-wrap">
                {text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
