import { useCallback, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { vibrate } from '../utils/haptics.js';
import { MODELS } from '../config/models.js';

const DETECTION_MODEL = MODELS.DETECTION.id;

const SCENE_PROMPT =
  'You are an accessibility assistant for a blind or low-vision user. ' +
  'Describe this scene with concrete, specific detail in 2–4 sentences. ' +
  'Cover: the setting (indoor/outdoor, room type, environment), ' +
  'every visible person and what they are doing, ' +
  'the key objects and their relative positions ' +
  '(left / right / centre, near / far, on the floor / at eye level), ' +
  'any visible text or signs (read them verbatim if legible), ' +
  'lighting conditions, and any potential hazards or obstacles. ' +
  'Avoid speculation — only describe what is actually visible.';

// SmolVLM 2.2 B can take a while to generate on WASM; give it 90 s on the
// first cold inference and rely on detection being shown immediately for
// safety-critical feedback.
const INFERENCE_TIMEOUT_MS = 90_000;

/**
 * COCO-80 labels that YOLOS/DETR can actually detect and that represent hazards.
 * Non-COCO labels (fire, smoke, stairs, flood, etc.) have been removed — the model
 * simply cannot output them, so listing them only produces zero matches.
 */
const HAZARD_LABELS = new Set([
  // Moving vehicle hazards
  'car', 'truck', 'bus', 'train', 'motorcycle', 'bicycle',
  // Weapon hazards
  'knife', 'scissors',
  // Large furniture / trip obstacles
  'chair', 'couch', 'bed', 'dining table', 'bench',
  // Carried / dropped obstacles
  'suitcase', 'backpack', 'umbrella', 'skateboard',
]);

const DETECTION_THRESHOLD = 0.50;

function classifyHazardSeverity(label) {
  const critical = new Set(['car', 'truck', 'bus', 'train', 'knife', 'scissors']);
  const high     = new Set(['motorcycle', 'bicycle']);
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
  const labels = detections.map((d) => d.label?.toLowerCase());
  if (labels.includes('car') || labels.includes('truck') || labels.includes('bus')) {
    narrative += ' Caution: vehicles nearby.';
  }
  return narrative;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function useSceneUnderstanding() {
  const { loadPipeline, loadVLM } = useModelLoader();
  const { remember, announce, setAgentStatus, updatePrivacy } = useLumyn();

  const captionVLMRef    = useRef(null);
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
        // Load both models in parallel (each cached after first use). The
        // VLM uses the manual AutoModel API; the detector uses the standard
        // object-detection pipeline.
        const [captionVLM, detectionPipe] = await Promise.all([
          captionVLMRef.current
            ? Promise.resolve(captionVLMRef.current)
            : loadVLM(MODELS.CAPTION).then((v) => { captionVLMRef.current = v; return v; }),
          detectionPipeRef.current
            ? Promise.resolve(detectionPipeRef.current)
            : loadPipeline('object-detection', DETECTION_MODEL, { dtype: MODELS.DETECTION.dtype }).then((p) => { detectionPipeRef.current = p; return p; }),
        ]);

        // Run detection first — faster and safety-critical
        const rawDetections = await withTimeout(
          detectionPipe(imageSource, { threshold: DETECTION_THRESHOLD }),
          INFERENCE_TIMEOUT_MS
        );

        const detections = Array.isArray(rawDetections) ? rawDetections : [];
        const hazards = detections
          .filter((d) => HAZARD_LABELS.has(d.label?.toLowerCase()))
          .map((d) => ({
            label: d.label,
            score: d.score,
            severity: classifyHazardSeverity(d.label),
            box: d.box,
          }))
          .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.severity] - { critical: 0, high: 1, medium: 2 }[b.severity]));

        // Show detection results immediately
        setState((s) => ({
          ...s,
          detections,
          hazards,
          caption: s.caption || (detections.length > 0
            ? `Detected ${detections.length} object${detections.length > 1 ? 's' : ''} — generating description…`
            : 'Analysing scene…'),
        }));

        vibrate(hazards.length > 0 ? 'warning' : 'light');

        // VLM caption — run after detection for display update ordering.
        // We talk to the VLM via the chat-style messages format that our
        // loadVLM helper exposes, regardless of which underlying SmolVLM
        // variant is selected in MODELS.CAPTION.
        const vlmMessages = [
          {
            role: 'user',
            content: [
              { type: 'image', url: imageSource },
              { type: 'text', text: SCENE_PROMPT },
            ],
          },
        ];

        const rawCaption = await withTimeout(
          captionVLM.generate(vlmMessages, {
            max_new_tokens: 256,
            do_sample: false,
            repetition_penalty: 1.05,
          }),
          INFERENCE_TIMEOUT_MS
        );

        const caption = rawCaption
          ? rawCaption.charAt(0).toUpperCase() + rawCaption.slice(1).trimEnd()
          : detections.length > 0
            ? `Scene contains: ${detections.slice(0, 5).map((d) => d.label).join(', ')}.`
            : 'Scene analysis complete.';

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
    [loadPipeline, loadVLM, remember, announce, setAgentStatus, updatePrivacy]
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
