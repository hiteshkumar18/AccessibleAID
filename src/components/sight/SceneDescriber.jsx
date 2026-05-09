import React, { useCallback, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { useApp } from '../../context/AppContext.jsx';
import { vibrate } from '../../utils/haptics.js';

const MODEL = 'Xenova/vit-gpt2-image-captioning';

export function SceneDescriber() {
  const { loadPipeline } = useModelLoader();
  const { remember } = useApp();
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
        const caption = Array.isArray(out)
          ? out[0]?.generated_text
          : out?.generated_text;
        const phrased = caption
          ? caption.charAt(0).toUpperCase() + caption.slice(1) + '.'
          : 'I could not describe that image.';
        setText(phrased);
        remember({ lastSceneDescription: phrased });
        vibrate('success');
      } catch (e) {
        setError(e?.message || 'Could not describe the image.');
      } finally {
        setBusy(false);
      }
    },
    [loadPipeline, remember]
  );

  return (
    <div className="space-y-4">
      <p className="text-base text-gray-700">
        Take a photo of what's in front of you. AccessibleAID will describe it
        out loud.
      </p>
      <CameraCapture
        onCapture={onCapture}
        busy={busy}
        captureLabel="Describe what I see"
      />
      {error && (
        <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          {error}
        </div>
      )}
      <ResultCard
        title="Scene description"
        text={text}
        loading={busy}
        meta="On-device · ViT-GPT2"
      />
    </div>
  );
}
