import React, { useEffect, useRef, useState } from 'react';
import { useCamera } from '../../hooks/useCamera.js';
import { captureFrameToDataURL, fileToDataURL } from '../../utils/imageUtils.js';

/**
 * Self-contained camera + upload widget. Calls onCapture(dataUrl) when
 * the user takes a photo or uploads one.
 */
export function CameraCapture({ onCapture, busy = false, captureLabel = 'Capture photo' }) {
  const { videoRef, start, stop, error, active, supported } = useCamera();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const onClickStart = async () => {
    setPreview(null);
    await start();
  };

  const onClickCapture = () => {
    const url = captureFrameToDataURL(videoRef.current, 640);
    if (url) {
      setPreview(url);
      onCapture?.(url);
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataURL(file);
    setPreview(url);
    onCapture?.(url);
  };

  return (
    <div className="bg-surface border border-gray-200 rounded-2xl p-4">
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center mb-3 relative">
        {preview ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={preview}
            alt="Captured photo preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
            aria-label="Live camera preview"
          />
        )}
        {!active && !preview && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-base">
            <span aria-hidden="true" className="mr-2">📷</span>
            <span>Camera off</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!active && (
          <button
            onClick={onClickStart}
            disabled={!supported || busy}
            className="tap-target bg-primary text-white px-4 rounded-xl font-medium disabled:opacity-50"
            aria-label="Start camera"
          >
            <span aria-hidden="true">📷</span> Start camera
          </button>
        )}
        {active && (
          <button
            onClick={onClickCapture}
            disabled={busy}
            className="tap-target bg-primary text-white px-4 rounded-xl font-medium disabled:opacity-50"
            aria-label={captureLabel}
          >
            <span aria-hidden="true">📸</span> {captureLabel}
          </button>
        )}
        {active && (
          <button
            onClick={stop}
            className="tap-target bg-gray-100 text-ink px-4 rounded-xl font-medium hover:bg-gray-200"
            aria-label="Stop camera"
          >
            Stop
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="tap-target bg-gray-100 text-ink px-4 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50"
          aria-label="Upload an image instead"
        >
          <span aria-hidden="true">⬆️</span> Upload image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="sr-only"
          aria-label="Choose an image file"
        />
      </div>
    </div>
  );
}
