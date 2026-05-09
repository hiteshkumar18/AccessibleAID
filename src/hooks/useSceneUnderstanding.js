import { useCallback, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { vibrate } from '../utils/haptics.js';

const CAPTION_MODEL = 'Xenova/vit-gpt2-image-captioning';
const DETECTION_MODEL = 'Xenova/detr-resnet-50';
const DEPTH_MODEL = 'Xenova/depth-anything-v2-small-hf';

const HAZARD_LABELS = new Set([
  'fire', 'smoke', 'person', 'stairs', 'car', 'truck', 'bus',
  'bicycle', 'motorcycle', 'knife', 'gun', 'scissors',
  'obstacle', 'barrier', 'debris', 'flood', 'water',
]);

function classifyHazardSeverity(label) {
  const critical = new Set(['fire', 'smoke', 'gun', 'knife', 'flood', 'water']);
  const high = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'stairs']);
  if (critical.has(label.toLowerCase())) return 'critical';
  if (high.has(label.toLowerCase())) return 'high';
  return 'medium';
}

function buildNarrativeFromDetections(caption, detections) {
  const labels = detections.map((d) => d.label.toLowerCase());
  const hazardLabels = labels.filter((l) => HAZARD_LABELS.has(l));
  let narrative = caption || 'Scene analysis complete.';
  if (hazardLabels.length > 0) {
    narrative += ` Detected: ${hazardLabels.join(', ')}.`;
  }
  if (labels.includes('stairs')) {
    narrative += ' Caution: stairs ahead.';
  }
  if (labels.includes('fire') || labels.includes('smoke')) {
    narrative += ' WARNING: fire or smoke detected — seek exit immediately.';
  }
  return narrative;
}

export function useSceneUnderstanding() {
  const { loadPipeline } = useModelLoader();
  const { remember, announce, setAgentStatus, updatePrivacy } = useLumyn();

  const captionPipeRef = useRef(null);
  const detectionPipeRef = useRef(null);

  const [state, setState] = useState({
    busy: false,
    caption: '',
    detections: [],
    hazards: [],
    narrative: '',
    depthHints: '',
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
        // Load caption model (lazy, cached)
        if (!captionPipeRef.current) {
          captionPipeRef.current = await loadPipeline('image-to-text', CAPTION_MODEL);
        }

        // Load object detection model (lazy, cached)
        if (!detectionPipeRef.current) {
          detectionPipeRef.current = await loadPipeline(
            'object-detection',
            DETECTION_MODEL,
            { dtype: 'q8' }
          );
        }

        // Run both in parallel for speed
        const [captionResult, detectionResult] = await Promise.all([
          captionPipeRef.current(imageSource),
          detectionPipeRef.current(imageSource, { threshold: 0.4 }),
        ]);

        const rawCaption = Array.isArray(captionResult)
          ? captionResult[0]?.generated_text
          : captionResult?.generated_text;
        const caption = rawCaption
          ? rawCaption.charAt(0).toUpperCase() + rawCaption.slice(1) + '.'
          : 'Unable to describe scene.';

        const detections = Array.isArray(detectionResult) ? detectionResult : [];
        const hazards = detections
          .filter((d) => HAZARD_LABELS.has(d.label?.toLowerCase()))
          .map((d) => ({
            label: d.label,
            score: d.score,
            severity: classifyHazardSeverity(d.label),
            box: d.box,
          }))
          .sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2 };
            return order[a.severity] - order[b.severity];
          });

        const narrative = buildNarrativeFromDetections(caption, detections);

        setState({
          busy: false,
          caption,
          detections,
          hazards,
          narrative,
          depthHints: '',
          error: null,
          lastAnalysisTime: Date.now(),
          processingMode: 'on-device',
        });

        remember({
          lastSceneDescription: caption,
          lastHazards: hazards,
          environmentContext: narrative,
        });

        announce(narrative);
        vibrate(hazards.length > 0 ? 'warning' : 'success');

        return { caption, detections, hazards, narrative };
      } catch (err) {
        const msg = err?.message || 'Scene analysis failed.';
        setState((s) => ({ ...s, busy: false, error: msg }));
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

  return {
    ...state,
    analyzeFrame,
    analyzeFromVideo,
  };
}
