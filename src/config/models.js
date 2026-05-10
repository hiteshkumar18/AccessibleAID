/**
 * Central model registry — all ONNX, all on-device, in-browser inference.
 *
 * Accuracy-first selection (size is no longer a constraint, ~5–7 GB total
 * cold download is acceptable). Each entry exposes a `task`, the canonical
 * HuggingFace model id, and (when needed) a per-component `dtype` map so the
 * vision encoder, text decoder, and embedding tables can be quantised
 * independently. transformers.js auto-resolves each piece from the model's
 * /onnx folder.
 *
 * Vision stack rationale:
 *  - CAPTION       : SmolVLM-Instruct (2.2 B, Idefics3 architecture). The
 *                    biggest production-grade VLM that currently runs in a
 *                    browser via transformers.js. Far better at fine-grained
 *                    scene description, OCR-on-photo, hazard reasoning, and
 *                    accessibility-aware narration than the previous 256 M
 *                    variant — at the cost of ~1.5 GB of weights (q4f16) on
 *                    first load (cached afterwards).
 *  - CAPTION_FAST  : SmolVLM-500M-Instruct — ~500 MB fallback when WebGPU
 *                    is unavailable / device is memory-constrained.
 *  - DETECTION     : DETR-ResNet-50 (COCO-80). This is still a strong
 *                    detector, but its first-load download is materially
 *                    smaller and more reliable than ResNet-101 in browser
 *                    environments.
 *  - DETECTION_FAST: YOLOS-small kept as an emergency fallback when even
 *                    DETR-50 cannot be fetched or initialized.
 *  - OCR           : TrOCR-large-printed — best public ONNX OCR for
 *                    medication labels, signs, menus.
 *  - DEPTH         : Depth-Anything-v2-base — sharper relative-depth maps
 *                    for the spatial narrator. Roughly 2× the params of
 *                    `-small` but still browser-viable.
 *
 * Audio + language stack stays as-is; user feedback was specifically about
 * image accuracy.
 */

export const MODELS = {
  /* ─────────────────────────── VISION ─────────────────────────── */

  // Default CAPTION = SmolVLM-500M-Instruct.
  //
  // Why not the 2.2 B variant? The 2.2 B decoder is ~1 GB on disk and
  // unpacks to 2+ GB in memory at runtime — a lot of WASM browsers OOM
  // before the first token is generated. 500 M is the sweet spot:
  //   • ~2× more vision parameters than the original 256 M baseline
  //   • the language decoder is SmolLM2-360M-Instruct (vs SmolLM2-135M
  //     in the 256 M variant), which is the dominant accuracy driver
  //   • total weights ≈ 600 MB on disk, ~1.2 GB resident
  // If you have WebGPU + headroom, swap `MODELS.CAPTION = MODELS.CAPTION_HQ`.
  CAPTION: {
    id: 'HuggingFaceTB/SmolVLM-500M-Instruct',
    task: 'image-text-to-text',
    name: 'SmolVLM 500M Instruct',
    shortName: 'Scene Describer',
    description:
      'On-device vision-language model — detailed, accessibility-aware ' +
      'scene descriptions, hazard reasoning, and reading text in photos.',
    category: 'Vision',
    icon: '👁️',
    sizeMB: 600,
    dtype: {
      embed_tokens: 'fp16',
      vision_encoder: 'fp16',
      decoder_model_merged: 'q4',
    },
    demoNote:
      'Prod: WebGPU + q4f16. Falls back to WASM + q4 decoder when WebGPU ' +
      'is unavailable.',
  },

  // High-accuracy alternative — SmolVLM-Instruct (2.2 B). Opt-in only:
  // export `MODELS.CAPTION = MODELS.CAPTION_HQ` if your target device has
  // WebGPU and at least 4–6 GB of free memory.
  CAPTION_HQ: {
    id: 'HuggingFaceTB/SmolVLM-Instruct',
    task: 'image-text-to-text',
    name: 'SmolVLM 2.2B Instruct',
    shortName: 'Scene Describer (HQ)',
    description:
      'State-of-the-art on-device VLM — best descriptions, longest cold-load.',
    category: 'Vision',
    icon: '✨',
    sizeMB: 1500,
    dtype: {
      embed_tokens: 'fp16',
      vision_encoder: 'q4',
      decoder_model_merged: 'q4',
    },
  },

  CAPTION_TINY: {
    id: 'HuggingFaceTB/SmolVLM-256M-Instruct',
    task: 'image-text-to-text',
    name: 'SmolVLM 256M Instruct',
    shortName: 'Scene Describer (Tiny)',
    description:
      'Original 256 M variant — kept as an emergency low-RAM fallback.',
    category: 'Vision',
    icon: '🌱',
    sizeMB: 460,
    dtype: {
      embed_tokens: 'fp16',
      vision_encoder: 'fp16',
      decoder_model_merged: 'q4',
    },
  },

  DETECTION: {
    id: 'Xenova/detr-resnet-50',
    task: 'object-detection',
    name: 'DETR ResNet-50 (COCO-80)',
    shortName: 'Object Detector',
    description:
      'End-to-end DETR with a ResNet-50 backbone. Better first-load ' +
      'reliability than the heavier ResNet-101 browser export while ' +
      'preserving the same COCO-80 hazard label set.',
    category: 'Vision',
    icon: '🔍',
    sizeMB: 294,
    dtype: 'q8',
    demoNote: 'Falls back to YOLOS-small automatically if DETR cannot load.',
  },

  DETECTION_FAST: {
    id: 'Xenova/yolos-small',
    task: 'object-detection',
    name: 'YOLOS Small (COCO-80)',
    shortName: 'Object Detector (Fast)',
    description:
      'Lightweight detector — used when latency matters more than recall.',
    category: 'Vision',
    icon: '⚡',
    sizeMB: 130,
    dtype: 'q8',
  },

  // NOTE: Xenova has not published trocr-large-printed for transformers.js
  // (only -base-printed is available). We use the base variant — accurate
  // enough for medication labels / menus and ships clean q8 weights.
  OCR: {
    id: 'Xenova/trocr-base-printed',
    task: 'image-to-text',
    name: 'TrOCR Base (Printed)',
    shortName: 'Text Reader',
    description:
      'OCR for printed text — labels, signs, menus, documents.',
    category: 'Vision',
    icon: '📝',
    sizeMB: 320,
    dtype: 'q8',
  },

  DEPTH: {
    id: 'onnx-community/depth-anything-v2-base',
    task: 'depth-estimation',
    name: 'Depth Anything v2 Base',
    shortName: 'Depth Sensor',
    description:
      'Relative depth estimation across the whole frame — used to convert ' +
      'object detections into clock-position + distance narration.',
    category: 'Vision',
    icon: '📏',
    sizeMB: 390,
    dtype: 'fp32',
    demoNote: 'Prod: depth-anything-v2-small q8 — ~49 MB.',
  },

  /* ─────────────────────────── AUDIO ─────────────────────────── */

  WHISPER: {
    id: 'Xenova/whisper-tiny',
    task: 'automatic-speech-recognition',
    name: 'Whisper Tiny',
    shortName: 'Speech Recognition',
    description:
      'On-device speech transcription — ~39 MB, fast, no cloud required.',
    category: 'Audio',
    icon: '🎤',
    sizeMB: 39,
    dtype: undefined, // auto — transformers.js picks q8 on WASM
  },

  /* ──────────────────────── LANGUAGE ──────────────────────── */

  EMBEDDING: {
    id: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    name: 'MiniLM L6 Embeddings',
    shortName: 'Knowledge Search',
    description: 'Semantic medication search — 22 MB on-device.',
    category: 'Language',
    icon: '🧠',
    sizeMB: 22,
    dtype: undefined,
  },

  SUMMARIZE: {
    id: 'Xenova/distilbart-cnn-6-6',
    task: 'summarization',
    name: 'DistilBART CNN',
    shortName: 'Text Simplifier',
    description: 'Rewrites complex text in plain language — Apache 2.0.',
    category: 'Language',
    icon: '📖',
    sizeMB: 290,
    dtype: undefined,
  },
};

export const MODEL_BY_ID = Object.fromEntries(
  Object.values(MODELS).map((m) => [m.id, m])
);

export const ALL_MODELS = Object.values(MODELS);

// Models bundled into public/models so first use does not depend on the
// Hugging Face Hub being reachable from the browser.
export const LOCAL_MODEL_PATH = '/models/';

export const BUNDLED_MODEL_IDS = new Set([
  MODELS.DETECTION.id,
  MODELS.DETECTION_FAST.id,
  MODELS.CAPTION_TINY.id,
]);

export function isBundledModel(modelId) {
  return BUNDLED_MODEL_IDS.has(modelId);
}
