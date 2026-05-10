import React, { useCallback, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { useApp } from '../../context/AppContext.jsx';
import { vibrate } from '../../utils/haptics.js';
import { MODELS } from '../../config/models.js';

const PROMPT =
  'Describe this scene in 2–3 sentences for someone who cannot see it. ' +
  'Mention the setting, the people and what they are doing, the most ' +
  'important objects and where they are, and any visible text. Be specific.';

export function SceneDescriber() {
  const { loadVLM } = useModelLoader();
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
        const vlm = await loadVLM(MODELS.CAPTION);
        const caption = await vlm.generate(
          [
            {
              role: 'user',
              content: [
                { type: 'image', url: dataUrl },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
          { max_new_tokens: 200, do_sample: false }
        );
        const phrased = caption
          ? caption.charAt(0).toUpperCase() + caption.slice(1)
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
    [loadVLM, remember]
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
        meta="On-device · SmolVLM 500M"
      />
    </div>
  );
}
