import React, { useCallback, useMemo, useState } from 'react';
import { CameraCapture } from '../shared/CameraCapture.jsx';
import { ResultCard } from '../shared/ResultCard.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { useSpeech } from '../../hooks/useSpeech.js';
import { vibrate } from '../../utils/haptics.js';
import { MODELS } from '../../config/models.js';

const DETECTOR = MODELS.DETECTION.id;  // Xenova/yolos-small
const DEPTH = MODELS.DEPTH.id;         // Xenova/depth-anything-v2-small-hf

/**
 * "Where am I, what's around me, how far is it?"
 *   1. DETR returns labelled bounding boxes with confidence scores.
 *   2. Depth-Anything-v2 returns a per-pixel depth map (relative).
 *   3. We map x-coordinates to clock positions (10 → "10 o'clock"),
 *      sample depth at each box centroid, and convert relative depth into
 *      a coarse "near / a few steps / across the room" descriptor.
 *   4. The narration is short, ordered by closeness, and read aloud.
 */
export function SpatialNarrator() {
  const { loadPipeline } = useModelLoader();
  const { speak } = useSpeech();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]); // {label, score, clock, distanceLabel}
  const [imageUrl, setImageUrl] = useState(null);
  const [boxes, setBoxes] = useState([]); // {label, box, score}
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const onCapture = useCallback(
    async (dataUrl) => {
      setError(null);
      setBusy(true);
      setItems([]);
      setBoxes([]);
      setImageUrl(dataUrl);
      try {
        const [det, depth] = await Promise.all([
          loadPipeline('object-detection', DETECTOR),
          loadPipeline('depth-estimation', DEPTH),
        ]);

        // Read original image dims so clock-position math is right
        const dims = await readImageDims(dataUrl);
        setImgSize(dims);

        const [detection, depthOut] = await Promise.all([
          det(dataUrl, { threshold: 0.5, percentage: false }),
          depth(dataUrl),
        ]);

        const depthMap = extractDepthMap(depthOut);

        // Sample depth at box centroid; lower depth = closer (Depth-Anything
        // outputs *inverse depth* by convention, so larger pixel value = nearer).
        const enriched = (detection || []).map((d) => {
          const cx = (d.box.xmin + d.box.xmax) / 2;
          const cy = (d.box.ymin + d.box.ymax) / 2;
          const xFrac = clamp01(cx / dims.w);
          const yFrac = clamp01(cy / dims.h);
          const depthValue = depthMap
            ? sampleDepth(depthMap, xFrac, yFrac)
            : 0.5;
          return {
            label: d.label,
            score: d.score,
            box: d.box,
            xFrac,
            yFrac,
            depth: depthValue,
          };
        });

        // Normalize depth to 0..1 across this frame.
        const depths = enriched.map((e) => e.depth);
        const dMin = Math.min(...depths, 0);
        const dMax = Math.max(...depths, 1);
        const range = Math.max(1e-6, dMax - dMin);
        for (const e of enriched) {
          e.normDepth = (e.depth - dMin) / range; // 1 = nearest
        }

        // Sort nearest-first, narrate top 6.
        enriched.sort((a, b) => b.normDepth - a.normDepth);
        const narrated = enriched.slice(0, 6).map((e) => ({
          label: e.label,
          score: e.score,
          clock: clockPosition(e.xFrac),
          distanceLabel: distanceFromNorm(e.normDepth),
          box: e.box,
        }));

        setItems(narrated);
        setBoxes(narrated);

        // Speak a single, scannable sentence.
        if (narrated.length) {
          const phrase =
            'I see ' +
            narrated
              .map(
                (n) =>
                  `a ${n.label} at ${n.clock}, ${n.distanceLabel}`
              )
              .join('; ') +
            '.';
          speak(phrase);
          vibrate('success');
        } else {
          speak('I do not see any clearly recognizable objects.');
        }
      } catch (e) {
        setError(e?.message || 'Could not analyze the scene.');
      } finally {
        setBusy(false);
      }
    },
    [loadPipeline, speak]
  );

  const narrationText = useMemo(() => {
    if (!items.length) return '';
    return items
      .map(
        (n, i) =>
          `${i + 1}. ${n.label} — ${n.clock}, ${n.distanceLabel}`
      )
      .join('\n');
  }, [items]);

  return (
    <div className="space-y-4">
      <p className="text-base text-gray-700">
        Spatial scene: detects objects, estimates how far each one is, and
        reports their clock positions ("9 o'clock = directly to your left").
      </p>
      <CameraCapture
        onCapture={onCapture}
        busy={busy}
        captureLabel="Map what's around me"
      />
      {error && (
        <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3">
          {error}
        </div>
      )}

      <ResultCard
        title="What's around you"
        text={narrationText}
        loading={busy}
        meta="DETR + Depth-Anything-v2"
        autoSpeak={false}
      >
        {imageUrl && boxes.length > 0 && (
          <BoxOverlay url={imageUrl} boxes={boxes} dims={imgSize} />
        )}
      </ResultCard>
    </div>
  );
}

function BoxOverlay({ url, boxes, dims }) {
  // Renders the still image with bounding boxes for sighted helpers/judges.
  return (
    <div className="mt-3 relative inline-block w-full">
      <img
        src={url}
        alt="Annotated scene with detected objects highlighted"
        className="w-full rounded-xl"
      />
      <svg
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={b.box.xmin}
              y={b.box.ymin}
              width={b.box.xmax - b.box.xmin}
              height={b.box.ymax - b.box.ymin}
              fill="none"
              stroke="#1a56db"
              strokeWidth={Math.max(2, dims.w / 200)}
            />
            <text
              x={b.box.xmin + 4}
              y={b.box.ymin + 18}
              fill="#fff"
              stroke="#1a56db"
              strokeWidth="3"
              paintOrder="stroke"
              fontSize={Math.max(12, dims.w / 40)}
              fontWeight="700"
            >
              {b.label} · {b.clock}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------- helpers ----------

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function clockPosition(xFrac) {
  // xFrac 0 = far left, 1 = far right. Map to 9..3 o'clock through 12.
  // Buckets:
  //   0.00–0.15 → 9 o'clock     0.15–0.30 → 10 o'clock
  //   0.30–0.45 → 11 o'clock    0.45–0.55 → 12 o'clock (straight ahead)
  //   0.55–0.70 → 1 o'clock     0.70–0.85 → 2 o'clock
  //   0.85–1.00 → 3 o'clock
  const buckets = [
    [0.15, '9 o’clock'],
    [0.30, '10 o’clock'],
    [0.45, '11 o’clock'],
    [0.55, '12 o’clock — straight ahead'],
    [0.70, '1 o’clock'],
    [0.85, '2 o’clock'],
    [1.01, '3 o’clock'],
  ];
  for (const [edge, label] of buckets) if (xFrac < edge) return label;
  return '3 o’clock';
}

function distanceFromNorm(norm) {
  // Larger norm = closer (since Depth-Anything emits inverse depth).
  if (norm > 0.85) return 'very close';
  if (norm > 0.65) return 'a step or two ahead';
  if (norm > 0.45) return 'a few steps away';
  if (norm > 0.25) return 'across the room';
  return 'far away';
}

function readImageDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

/**
 * The depth pipeline returns either a `RawImage` or `{ depth: RawImage }`.
 * Pull out a Float32Array view we can sample.
 */
function extractDepthMap(out) {
  const raw = out?.depth || out;
  if (!raw) return null;
  const data = raw.data || raw?.predicted_depth?.data;
  const width = raw.width || raw?.predicted_depth?.dims?.[2] || 0;
  const height = raw.height || raw?.predicted_depth?.dims?.[1] || 0;
  if (!data || !width || !height) return null;
  return { data, width, height };
}

function sampleDepth(map, xFrac, yFrac) {
  const x = Math.min(map.width - 1, Math.max(0, Math.round(xFrac * map.width)));
  const y = Math.min(map.height - 1, Math.max(0, Math.round(yFrac * map.height)));
  return Number(map.data[y * map.width + x] || 0);
}
