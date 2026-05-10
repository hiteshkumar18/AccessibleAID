import React, { useCallback, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useRAG } from '../../hooks/useRAG.js';
import { useSpeech } from '../../hooks/useSpeech.js';
import { fmtConfidence, announce } from '../../utils/a11y.js';
import { useApp } from '../../context/AppContext.jsx';

/**
 * Medication identifier — OCR pipeline.
 *
 * Flow:
 *  1. POST /api/infer/ocr  → EasyOCR reads printed text from the label.
 *  2. POST /api/infer/caption → moondream2 gives a visual description
 *     (colour, shape, imprint) for unlabelled pills.
 *  3. Keyword search across the local medication database.
 *  4. Top match with dosage, warnings, and side effects is read aloud.
 */
export function MedIdentifier() {
  const { search } = useRAG();
  const { speak } = useSpeech();
  const { remember } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const [caption, setCaption] = useState('');

  const onCapture = useCallback(
    async (dataUrl) => {
      setError(null);
      setBusy(true);
      setMatches([]);
      setOcrText('');
      setCaption('');

      try {
        // Run OCR and VLM in parallel — OCR reads the label text; VLM
        // describes the visual appearance for unlabelled pills.
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
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'image', url: dataUrl },
                    {
                      type: 'text',
                      text:
                        'Identify this medication. Read the label exactly if visible: ' +
                        'brand name, generic name, strength, and dosage form. ' +
                        'If no label is visible, describe the pill: colour, shape, imprint markings. ' +
                        'Reply in 1–2 short sentences. Do not invent details.',
                    },
                  ],
                },
              ],
              max_new_tokens: 96,
            }),
          }).then((r) => r.json()),
        ]);

        const ocr = ocrRes.status === 'fulfilled' ? (ocrRes.value?.text || '') : '';
        const cap = captionRes.status === 'fulfilled' ? (captionRes.value?.text || '') : '';

        setOcrText(ocr);
        setCaption(cap);

        // Combine OCR text + VLM caption for the search query.
        const query = [ocr, cap].filter(Boolean).join(' ') || 'medication pill';
        const results = search(query, 3);
        setMatches(results);

        if (results.length > 0) {
          const top = results[0];
          remember({ lastOcrText: ocr || cap });
          const speakText = `${top.payload.name}. ${top.payload.genericName}. ${top.payload.dosage}`;
          speak(speakText);
          announce(`Top match: ${top.payload.name}. ${top.payload.dosage}`);
        } else {
          const fallback = ocr || cap || 'Could not read medication details.';
          speak(fallback);
          announce(fallback);
        }
      } catch (e) {
        setError(e?.message || 'Could not identify medication.');
      } finally {
        setBusy(false);
      }
    },
    [search, speak, remember]
  );

  const top = matches[0];

  return (
    <div className="space-y-4">
      <div className="bg-warning/10 border border-warning/30 text-ink rounded-xl p-3 text-sm">
        <strong>Educational reference only.</strong> Always confirm medication
        with the label, your pharmacist, or your doctor.
      </div>
      <p className="text-base text-gray-700">
        Photograph a pill or its bottle. AccessibleAID reads the label with OCR
        and searches a local database of 25+ common medications.
      </p>
      <CameraCapture
        onCapture={onCapture}
        busy={busy}
        captureLabel="Identify this medication"
      />
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
          meta={top ? `Match score ${fmtConfidence(top.score)}` : undefined}
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
                      <span className="text-gray-500">({m.payload.genericName})</span>
                    </span>
                    <span className="text-gray-500">{fmtConfidence(m.score)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ocrText && (
            <p className="mt-3 text-xs text-gray-500">
              OCR read: <em>"{ocrText}"</em>
            </p>
          )}
          {caption && !ocrText && (
            <p className="mt-3 text-xs text-gray-500">
              Visual description: <em>{caption}</em>
            </p>
          )}
        </ResultCard>
      )}

      {!busy && !top && matches.length === 0 && ocrText && (
        <ResultCard
          title="Label text read"
          text={ocrText}
          meta="No database match found — showing raw OCR text"
          loading={false}
          autoSpeak
        />
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
