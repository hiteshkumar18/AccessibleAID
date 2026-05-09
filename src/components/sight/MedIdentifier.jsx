import React, { useCallback, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { useRAG } from '../../hooks/useRAG.js';
import { useSpeech } from '../../hooks/useSpeech.js';
import { fmtConfidence, announce } from '../../utils/a11y.js';

const VISION_MODEL = 'Xenova/vit-gpt2-image-captioning';

/**
 * 1. Caption the photo of the pill / bottle to a descriptive string.
 * 2. Embed that description and run cosine search against the RAG index.
 * 3. Surface the top match with structured info and speak the dosage aloud.
 */
export function MedIdentifier() {
  const { loadPipeline } = useModelLoader();
  const { ready, error: ragError, search } = useRAG();
  const { speak } = useSpeech();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [caption, setCaption] = useState('');

  const onCapture = useCallback(
    async (dataUrl) => {
      setError(null);
      setBusy(true);
      setMatches([]);
      setCaption('');
      try {
        if (!ready) throw new Error('Knowledge base still loading. Try again in a moment.');
        const pipe = await loadPipeline('image-to-text', VISION_MODEL);
        const out = await pipe(dataUrl);
        const cap = (Array.isArray(out) ? out[0]?.generated_text : out?.generated_text) || '';
        setCaption(cap);
        const results = await search(cap || 'medication pill bottle', 3);
        setMatches(results);
        const top = results[0];
        if (top) {
          const speakText = `${top.payload.name}. ${top.payload.genericName}. ${top.payload.dosage}`;
          speak(speakText);
          announce(`Top match: ${top.payload.name}. ${top.payload.dosage}`);
        }
      } catch (e) {
        setError(e?.message || 'Could not identify medication.');
      } finally {
        setBusy(false);
      }
    },
    [loadPipeline, ready, search, speak]
  );

  const top = matches[0];

  return (
    <div className="space-y-4">
      <div className="bg-warning/10 border border-warning/30 text-ink rounded-xl p-3 text-sm">
        <strong>Educational reference only.</strong> Always confirm medication
        with the label, your pharmacist, or your doctor.
      </div>
      <p className="text-base text-gray-700">
        Photograph a pill or its bottle. AccessibleAID searches a local
        knowledge base of {ready ? '25+' : '…'} common medications.
      </p>
      <CameraCapture
        onCapture={onCapture}
        busy={busy}
        captureLabel="Identify this medication"
      />
      {ragError && (
        <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          {ragError}
        </div>
      )}
      {error && (
        <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {(busy || top) && (
        <ResultCard
          title={top ? `Top match: ${top.payload.name}` : 'Searching…'}
          text={
            top
              ? `${top.payload.name} (${top.payload.genericName}). ${top.payload.dosage}`
              : ''
          }
          meta={top ? `Confidence ${fmtConfidence(top.score)}` : undefined}
          loading={busy}
          autoSpeak={false}
        >
          {top && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <Field label="Appearance" value={top.payload.appearance} />
              <Field label="Warnings" value={top.payload.warnings} />
              <Field label="Side effects" value={top.payload.sideEffects} />
              <Field label="Description" value={top.payload.description} />
            </div>
          )}
          {matches.length > 1 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Other possibilities
              </h3>
              <ul className="space-y-1">
                {matches.slice(1).map((m, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 flex items-center justify-between border-t pt-1"
                  >
                    <span>
                      {m.payload.name}{' '}
                      <span className="text-gray-500">
                        ({m.payload.genericName})
                      </span>
                    </span>
                    <span className="text-gray-500">{fmtConfidence(m.score)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {caption && (
            <p className="mt-3 text-xs text-gray-500">
              Vision caption used as query: <em>{caption}</em>
            </p>
          )}
        </ResultCard>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="bg-bg rounded-xl p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </div>
      <div className="text-base text-ink mt-1">{value}</div>
    </div>
  );
}
