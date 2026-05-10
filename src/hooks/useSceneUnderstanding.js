import { useCallback, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { vibrate } from '../utils/haptics.js';
import {
  MODELS,
  OPEN_VOCAB_HAZARD_PROMPTS,
  pickCaptionForDevice,
} from '../config/models.js';

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

// Hazards we treat as critical / high regardless of which detector
// produced the box. Anything else from the open-vocab list is flagged
// at "medium" so the UI can still surface it.
const CRITICAL_HAZARDS = new Set([
  'fire', 'flame', 'smoke', 'hot stove', 'lit candle', 'open oven',
  'hot iron', 'electric heater', 'exposed wire',
  'kitchen knife', 'scissors', 'glass shard', 'syringe', 'needle',
  'broken glass on floor', 'spilled liquid',
  'car', 'truck', 'bus', 'train',
]);
const HIGH_HAZARDS = new Set([
  'staircase', 'step', 'curb', 'escalator', 'wet floor sign', 'puddle',
  'cable on floor', 'extension cord on floor', 'rug edge', 'pothole',
  'motorcycle', 'bicycle', 'electric scooter',
]);

const DETECTION_THRESHOLD = 0.30; // Grounding DINO scores are softer than DETR's.

function classifyHazardSeverity(label) {
  const l = (label || '').toLowerCase();
  if (CRITICAL_HAZARDS.has(l)) return 'critical';
  if (HIGH_HAZARDS.has(l)) return 'high';
  return 'medium';
}

function buildNarrative(caption, detections, hazards) {
  let narrative = caption || 'Scene analysis complete.';
  if (hazards.length > 0) {
    narrative += ` Hazard${hazards.length > 1 ? 's' : ''} detected: ${
      hazards.map((h) => h.label).join(', ')
    }.`;
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

/**
 * Run the loaded detector against a frame using the right call signature
 * for the underlying model — Grounding DINO needs the open-vocab prompt
 * list, while DETR/YOLOS take a plain threshold.
 */
async function runDetection(detectionPipe, imageSource) {
  const isOpenVocab = detectionPipe.lumynTask === 'zero-shot-object-detection';

  if (isOpenVocab) {
    // Grounding DINO accepts an array of label strings as the second arg;
    // the third arg controls per-phrase score / threshold behaviour.
    const raw = await detectionPipe(imageSource, OPEN_VOCAB_HAZARD_PROMPTS, {
      threshold: DETECTION_THRESHOLD,
      // top-k high enough that the open-vocab list isn't truncated mid-frame
      // but low enough to keep WASM latency reasonable.
      topk: 25,
    });
    return Array.isArray(raw) ? raw : [];
  }

  // Closed-vocab fallback path (DETR-50 / YOLOS-small).
  const raw = await detectionPipe(imageSource, { threshold: DETECTION_THRESHOLD });
  return Array.isArray(raw) ? raw : [];
}

/**
 * Best-effort device-capability probe so we can auto-pick between the
 * 2.2 B HQ caption model and the 500 M fallback. Runs once per session.
 */
let deviceCapsPromise = null;
async function getDeviceCaps() {
  if (deviceCapsPromise) return deviceCapsPromise;
  deviceCapsPromise = (async () => {
    let webgpu = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        webgpu = !!adapter;
      }
    } catch (_) { webgpu = false; }
    const deviceMemoryGB =
      typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number'
        ? navigator.deviceMemory
        : undefined;
    return { webgpu, deviceMemoryGB };
  })();
  return deviceCapsPromise;
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
    captionModelId: null,
    detectorModelId: null,
  });

  const analyzeFrame = useCallback(
    async (imageSource) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      setAgentStatus('environmental', 'active');
      updatePrivacy({ cameraProcessingLocal: true, lastProcessingMode: 'on-device' });

      try {
        // Load the safety-critical detector first. On a cold start,
        // downloading multiple large models in parallel is brittle and was
        // causing first-run failures for users on normal connections.
        const detectionPipe = detectionPipeRef.current
          ? detectionPipeRef.current
          : await loadPipeline(
              MODELS.DETECTION.task,
              MODELS.DETECTION.id,
              { dtype: MODELS.DETECTION.dtype }
            ).then((p) => {
              detectionPipeRef.current = p;
              return p;
            });

        // Run detection first — faster and safety-critical.
        const rawDetections = await withTimeout(
          runDetection(detectionPipe, imageSource),
          INFERENCE_TIMEOUT_MS
        );

        const detections = Array.isArray(rawDetections) ? rawDetections : [];

        // Open-vocab detector emits anything from the prompt list; severity
        // is decided by lookup, not by a separate hazard set. Detections
        // that aren't in either bucket fall through as "medium" and still
        // surface in the UI list — better recall than the old approach.
        const hazards = detections
          .filter((d) => {
            const l = (d.label || '').toLowerCase();
            return CRITICAL_HAZARDS.has(l) || HIGH_HAZARDS.has(l);
          })
          .map((d) => ({
            label: d.label,
            score: d.score,
            severity: classifyHazardSeverity(d.label),
            box: d.box,
          }))
          .sort(
            (a, b) =>
              ({ critical: 0, high: 1, medium: 2 }[a.severity] -
                { critical: 0, high: 1, medium: 2 }[b.severity])
          );

        // Show detection results immediately
        setState((s) => ({
          ...s,
          detections,
          hazards,
          detectorModelId: detectionPipe.lumynModelId || MODELS.DETECTION.id,
          caption: s.caption || (detections.length > 0
            ? `Detected ${detections.length} object${detections.length > 1 ? 's' : ''} — generating description…`
            : 'Analysing scene…'),
        }));

        vibrate(hazards.length > 0 ? 'warning' : 'light');

        // Pick the best caption model for this device. WebGPU + ≥4 GB
        // memory ⇒ SmolVLM-Instruct (2.2 B), otherwise the 500 M variant.
        const caps = await getDeviceCaps();
        const captionEntry = pickCaptionForDevice(caps);

        const vlmMessages = [
          {
            role: 'user',
            content: [
              { type: 'image', url: imageSource },
              { type: 'text', text: SCENE_PROMPT },
            ],
          },
        ];

        const captionVLM = captionVLMRef.current
          ? captionVLMRef.current
          : await loadVLM(captionEntry).then((v) => {
              captionVLMRef.current = v;
              return v;
            });

        let rawCaption = null;
        try {
          rawCaption = await withTimeout(
            captionVLM.generate(vlmMessages, {
              max_new_tokens: 320,
              do_sample: false,
              repetition_penalty: 1.05,
            }),
            INFERENCE_TIMEOUT_MS
          );
        } catch (captionErr) {
          // eslint-disable-next-line no-console
          console.warn('[Lumyn] caption generation failed; using detections fallback', captionErr);
        }

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
          captionModelId: captionVLM.modelId || captionEntry.id,
          detectorModelId: detectionPipe.lumynModelId || MODELS.DETECTION.id,
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
      // 800 px gives Grounding DINO and SmolVLM enough resolution for
      // small-text and small-object recall without hammering WASM.
      const dataUrl = captureFrameToDataURL(videoElement, 800);
      if (!dataUrl) return null;
      return analyzeFrame(dataUrl);
    },
    [analyzeFrame]
  );

  return { ...state, analyzeFrame, analyzeFromVideo };
}
