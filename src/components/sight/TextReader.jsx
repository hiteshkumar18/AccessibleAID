import React, { useCallback, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { useApp } from '../../context/AppContext.jsx';
import { vibrate } from '../../utils/haptics.js';

const MODEL = 'Xenova/trocr-small-printed';

export function TextReader() {
  const { loadPipeline } = useModelLoader();
  const { remember, setMode } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onCapture = useCallback(
    async (dataUrl) => {
      setError(null);
      setBusy(true);
      setText('');
      try {
        const pipe = await loadPipeline('image-to-text', MODEL);
        const out = await pipe(dataUrl);
        const recognized = Array.isArray(out)
          ? out[0]?.generated_text
          : out?.generated_text;
        const cleaned =
          recognized?.trim() || 'I could not read any text in that image.';
        setText(cleaned);
        if (recognized?.trim()) {
          remember({ lastOcrText: cleaned });
          vibrate('success');
        }
      } catch (e) {
        setError(e?.message || 'Could not read the image.');
      } finally {
        setBusy(false);
      }
    },
    [loadPipeline, remember]
  );

  return (
    <div className="space-y-4">
      <p className="text-base text-gray-700">
        Point your camera at a sign, menu, or document. AccessibleAID will read
        the words aloud.
      </p>
      <CameraCapture
        onCapture={onCapture}
        busy={busy}
        captureLabel="Read this text"
      />
      {error && (
        <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          {error}
        </div>
      )}
      <ResultCard
        title="Recognized text"
        text={text}
        loading={busy}
        meta="On-device · TrOCR"
      >
        {text && !busy && (
          <button
            onClick={() => setMode('simplify')}
            className="tap-target mt-3 bg-purple-700 text-white px-4 rounded-xl font-medium"
            aria-label="Simplify this recognized text"
          >
            <span aria-hidden="true">📖</span> Simplify this in plain English
          </button>
        )}
      </ResultCard>
    </div>
  );
}
