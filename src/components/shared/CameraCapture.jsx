import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Upload } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera.js';
import { captureFrameToDataURL, fileToDataURL } from '../../utils/imageUtils.js';

/**
 * Photo-capture widget.
 *
 * Key fix: the <video> element is ALWAYS in the DOM so the ref stays
 * stable. useCamera.start() attaches srcObject immediately — if the
 * element were conditionally mounted we'd lose the stream when React
 * swaps elements. We only toggle visibility via CSS.
 */
export function CameraCapture({ onCapture, busy = false, captureLabel = 'Capture photo' }) {
  const { videoRef, start, stop, error, active, supported } = useCamera();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => () => stop(), [stop]);

  const onClickOpen = async () => {
    setPreview(null);
    await start();
  };

  const onClickCapture = () => {
    const url = captureFrameToDataURL(videoRef.current, 1280);
    if (url) {
      setPreview(url);
      stop();
      onCapture?.(url);
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so the same file can be re-selected
    e.target.value = '';
    const url = await fileToDataURL(file);
    setPreview(url);
    onCapture?.(url);
  };

  return (
    <>
      {/* ── Video: always in DOM, only hidden/shown via class ── */}
      {/* Fixed full-screen when active so it fills the viewport */}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Live camera preview"
        className={
          active
            ? 'fixed inset-0 w-full h-full object-cover z-40'
            : 'sr-only'
        }
      />

      {/* ── Overlay UI (controls on top of video) ── */}
      <AnimatePresence>
        {active && (
          <motion.div
            key="camera-overlay-ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ pointerEvents: 'none' }}
          >
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

            {/* Corner brackets */}
            <div className="absolute top-14 left-6 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
            <div className="absolute top-14 right-6 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
            <div className="absolute bottom-28 left-6 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
            <div className="absolute bottom-28 right-6 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-lg" />

            {/* Top bar */}
            <div className="relative flex items-center justify-between px-5 pt-12" style={{ pointerEvents: 'auto' }}>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={stop}
                className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
                aria-label="Close camera"
              >
                <X className="w-5 h-5 text-white" />
              </motion.button>

              <span className="text-white/70 text-sm font-medium bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                Tap shutter to capture
              </span>

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
                aria-label="Upload image instead"
              >
                <Upload className="w-5 h-5 text-white" />
              </motion.button>
            </div>

            {/* Shutter button */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-12" style={{ pointerEvents: 'auto' }}>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onClickCapture}
                disabled={busy}
                aria-label={captureLabel}
                className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center bg-white/20 backdrop-blur-xl shadow-2xl disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Compact in-page buttons ── */}
      <div className="space-y-3">
        {/* Preview thumbnail */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden bg-gray-900 shadow-xl"
          >
            <img
              src={preview}
              alt="Captured photo preview"
              className="w-full object-contain max-h-72"
            />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
              aria-label="Remove preview"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </motion.div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClickOpen}
            disabled={!supported || busy}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white rounded-2xl font-semibold shadow-lg disabled:opacity-50 text-sm"
            aria-label="Open full-screen camera"
          >
            <Camera className="w-5 h-5" />
            {preview ? 'Retake Photo' : 'Open Camera'}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="px-5 py-4 bg-white/80 text-[#0F172A] rounded-2xl border border-[#0F172A]/10 font-semibold shadow-sm disabled:opacity-50 text-sm flex items-center gap-2"
            aria-label="Upload an image instead"
          >
            <Upload className="w-4 h-4" />
            Upload
          </motion.button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="sr-only"
          aria-label="Choose an image file"
        />
      </div>
    </>
  );
}
