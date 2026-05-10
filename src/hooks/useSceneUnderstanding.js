import { useCallback, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { vibrate } from '../utils/haptics.js';
import { MODELS } from '../config/models.js';

const CAPTION_MODEL   = MODELS.CAPTION.id;
const DETECTION_MODEL = MODELS.DETECTION.id;

/** Maximum ms to wait for inference before showing partial results */
const INFERENCE_TIMEOUT_MS = 25_000;

/**
 * Only real environmental hazards — NOT people, animals, or everyday objects.
 * People are context, not hazards. Keeping false positives low is more
 * important than catching everything.
 */
const HAZARD_LABELS = new Set([
  'fire', 'smoke',
  'stairs', 'escalator', 'step',
  'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'vehicle',
  'knife', 'gun', 'scissors', 'sword',
  'puddle', 'flood', 'water',
  'obstacle', 'barrier', 'debris', 'rubble',
  'hole', 'pit', 'curb',
]);

/** Minimum confidence for a detection to count — higher = fewer false positives */
const DETECTION_THRESHOLD = 0.55;

function classifyHazardSeverity(label) {
  const critical = new Set(['fire', 'smoke', 'gun', 'knife', 'flood', 'water', 'puddle']);
  const high     = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'vehicle', 'stairs', 'escalator']);
  const l = label.toLowerCase();
  if (critical.has(l)) return 'critical';
  if (high.has(l)) return 'high';
  return 'medium';
}

function buildNarrative(caption, detections, hazards) {
  let narrative = caption || 'Scene analysis complete.';
  if (hazards.length > 0) {
    narrative += ` Hazard${hazards.length > 1 ? 's' : ''} detected: ${hazards.map((h) => h.label).join(', ')}.`;
  }
  const labels = detections.map((d) => d.label.toLowerCase());
  if (labels.includes('stairs') || labels.includes('escalator')) narrative += ' Caution: steps ahead.';
  if (labels.includes('fire') || labels.includes('smoke'))       narrative += ' WARNING: fire or smoke — evacuate immediately.';
  return narrative;
}

/** Race a promise against a timeout. Resolves to null on timeout. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function useSceneUnderstanding() {
  const { loadPipeline } = useModelLoader();
  const { remember, announce, setAgentStatus, updatePrivacy } = useLumyn();

  const captionPipeRef   = useRef(null);
  const detectionPipeRef = useRef(null);

  const [state, setState] = useState({
    busy: false,
    caption: '',
    detections: [],
    hazards: [],
    narrative: '',
    error: null,
    lastAnalysisTime: null,
    processingMode: 'on-device',
  });

  const analyzeFrame = useCallback(
    async (imageSource) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      setAgentStatus('environmental', 'active');
      updatePrivacy({ cameraProcessingLocal: true, lastProcessingMode: 'on-device' });

      try {
        // ── 1. Load models (lazy, module-level cached) ──────────────────
        const [captionPipe, detectionPipe] = await Promise.all([
          captionPipeRef.current
            ? Promise.resolve(captionPipeRef.current)
            : loadPipeline('image-to-text', CAPTION_MODEL).then((p) => {
                captionPipeRef.current = p; return p;
              }),
          detectionPipeRef.current
            ? Promise.resolve(detectionPipeRef.current)
            : loadPipeline('object-detection', DETECTION_MODEL, { dtype: MODELS.DETECTION.dtype }).then((p) => {
                detectionPipeRef.current = p; return p;
              }),
        ]);

        // ── 2. Run detection first — it's faster and safety-critical ────
        const detectionResult = await withTimeout(
          detectionPipe(imageSource, { threshold: DETECTION_THRESHOLD }),
          INFERENCE_TIMEOUT_MS
        );

        const detections = Array.isArray(detectionResult) ? detectionResult : [];
        const hazards = detections
          .filter((d) => HAZARD_LABELS.has(d.label?.toLowerCase()))
          .map((d) => ({
            label: d.label,
            score: d.score,
            severity: classifyHazardSeverity(d.label),
            box: d.box,
          }))
          .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity]));

        // Show detection results immediately — don't block on caption
        const hazardSummary = hazards.length > 0
          ? `⚠ Hazard${hazards.length > 1 ? 's' : ''}: ${hazards.map((h) => h.label).join(', ')}.`
          : null;
        setState((s) => ({
          ...s,
          detections,
          hazards,
          caption: s.caption || hazardSummary || (detections.length > 0
            ? `Detected ${detections.length} object${detections.length > 1 ? 's' : ''} — generating description…`
            : 'Analysing scene…'),
        }));

        vibrate(hazards.length > 0 ? 'warning' : 'light');

        // ── 3. Caption — run concurrently, update when ready ───────────
        const captionResult = await withTimeout(
          captionPipe(imageSource),
          INFERENCE_TIMEOUT_MS
        );

        const rawCaption = captionResult
          ? (Array.isArray(captionResult) ? captionResult[0]?.generated_text : captionResult?.generated_text)
          : null;
        const caption = rawCaption
          ? rawCaption.charAt(0).toUpperCase() + rawCaption.slice(1) + '.'
          : detections.length > 0
            ? `Scene contains: ${detections.slice(0, 5).map((d) => d.label).join(', ')}.`
            : 'Unable to describe scene within time limit.';

        const narrative = buildNarrative(caption, detections, hazards);

        setState({
          busy: false,
          caption,
          detections,
          hazards,
          narrative,
          error: null,
          lastAnalysisTime: Date.now(),
          processingMode: 'on-device',
        });

        remember({ lastSceneDescription: caption, lastHazards: hazards, environmentContext: narrative });
        announce(narrative);
        vibrate(hazards.length > 0 ? 'warning' : 'success');

        return { caption, detections, hazards, narrative };

      } catch (err) {
        const msg = err?.message || 'Scene analysis failed.';
        setState((s) => ({ ...s, busy: false, error: msg }));
        // eslint-disable-next-line no-console
        console.error('[Lumyn] scene analysis error', err);
        return null;
      } finally {
        setAgentStatus('environmental', 'idle');
      }
    },
    [loadPipeline, remember, announce, setAgentStatus, updatePrivacy]
  );

  const analyzeFromVideo = useCallback(
    async (videoElement) => {
      const dataUrl = captureFrameToDataURL(videoElement, 640);
      if (!dataUrl) return null;
      return analyzeFrame(dataUrl);
    },
    [analyzeFrame]
  );

  return { ...state, analyzeFrame, analyzeFromVideo };
}
