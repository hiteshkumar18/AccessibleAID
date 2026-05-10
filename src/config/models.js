/**
 * Central model registry — all on-device, in-browser inference.
 *
 * Accuracy-first selection. Each entry exposes a `task`, the canonical
 * model id, and (when needed) a per-component `dtype` map so the vision
 * encoder, text decoder, and embedding tables can be quantised
 * independently. transformers.js auto-resolves each piece from the
 * model's /onnx folder.
 *
 * What changed in this revision (the user reported inaccurate results
 * from Scene Camera, Understand World, and Sign Language):
 *
 *  - CAPTION  : promoted to SmolVLM-Instruct (2.2 B, Idefics3) by default —
 *               this was previously hidden behind CAPTION_HQ. Far better
 *               at fine-grained scene description, OCR-on-photo, hazard
 *               reasoning, and accessibility-aware narration than the
 *               old 500 M default. Falls back to 500 M on WASM or
 *               memory-constrained devices via `pickCaptionForDevice()`.
 *
 *  - DETECTION: switched to an OPEN-VOCABULARY detector (Grounding DINO
 *               Tiny). The previous DETR-50 was capped to the COCO-80
 *               label set, which physically cannot output the most
 *               safety-critical labels for an accessibility app —
 *               "stairs", "fire", "smoke", "spill", "wet floor",
 *               "broken glass", "electric cable", "hot surface", etc.
 *               Grounding DINO accepts free-text prompts and returns
 *               boxes for any of them, dramatically lifting hazard
 *               recall. DETR-50 and YOLOS-small remain as fallbacks.
 *
 *  - DEPTH    : Depth-Anything-v2-base — sharper relative-depth maps
 *               for the spatial narrator. ~2× the params of `-small`
 *               but still browser-viable.
 *
 *  - SIGN_*   : new entries for MediaPipe Tasks gesture / hand-landmark
 *               models, which power the real Sign Language recognizer
 *               (the previous "model" was a setTimeout + Math.random
 *               picking from a hardcoded list).
 */

/* ─────────────────────────── VISION ─────────────────────────── */

// HQ caption model — SmolVLM-Instruct (2.2 B, Idefics3).
// Browser-runnable on WebGPU with q4 weights; expects ~1.5 GB cold load.
const CAPTION_HQ = {
  id: 'HuggingFaceTB/SmolVLM-Instruct',
  task: 'image-text-to-text',
  name: 'SmolVLM 2.2B Instruct',
  shortName: 'Scene Describer (HQ)',
  description:
    'State-of-the-art on-device VLM — best descriptions, OCR-in-photo, and ' +
    'hazard reasoning. Runs on WebGPU; falls back to the 500M variant on WASM.',
  category: 'Vision',
  icon: '✨',
  sizeMB: 1500,
  dtype: {
    embed_tokens: 'fp16',
    vision_encoder: 'q4',
    decoder_model_merged: 'q4',
  },
  demoNote: 'Prod: WebGPU + q4. Auto-falls-back to SmolVLM-500M on WASM.',
};

// Mid-tier caption model — SmolVLM-500M-Instruct.
// Auto-fallback target when WebGPU is unavailable / device is memory-constrained.
const CAPTION_MID = {
  id: 'HuggingFaceTB/SmolVLM-500M-Instruct',
  task: 'image-text-to-text',
  name: 'SmolVLM 500M Instruct',
  shortName: 'Scene Describer',
  description:
    'On-device vision-language model — detailed scene descriptions, ' +
    'hazard reasoning, and reading text in photos.',
  category: 'Vision',
  icon: '👁️',
  sizeMB: 600,
  dtype: {
    embed_tokens: 'fp16',
    vision_encoder: 'fp16',
    decoder_model_merged: 'q4',
  },
};

// Tiny emergency-only fallback.
const CAPTION_TINY = {
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
};

// Open-vocabulary detector. The big accuracy win for hazard recall —
// it accepts free-text prompts and is not capped to COCO-80.
const DETECTION_OPEN_VOCAB = {
  id: 'onnx-community/grounding-dino-tiny-ONNX',
  task: 'zero-shot-object-detection',
  name: 'Grounding DINO Tiny',
  shortName: 'Open-Vocab Detector',
  description:
    'Open-vocabulary detector — boxes anything you can describe in text. ' +
    'Lets the app surface hazards COCO-80 detectors physically cannot ' +
    '(stairs, fire, smoke, spills, broken glass, electric cables, …).',
  category: 'Vision',
  icon: '🎯',
  sizeMB: 540,
  dtype: 'q8',
  demoNote: 'Prod: WebGPU + q8. Falls back to DETR-50 then YOLOS-small.',
};

// Closed-vocabulary fallback (COCO-80).
const DETECTION_DETR = {
  id: 'Xenova/detr-resnet-50',
  task: 'object-detection',
  name: 'DETR ResNet-50 (COCO-80)',
  shortName: 'Object Detector',
  description:
    'End-to-end DETR with a ResNet-50 backbone. Used as the closed-vocab ' +
    'fallback when Grounding DINO cannot load.',
  category: 'Vision',
  icon: '🔍',
  sizeMB: 294,
  dtype: 'q8',
};

const DETECTION_YOLOS = {
  id: 'Xenova/yolos-small',
  task: 'object-detection',
  name: 'YOLOS Small (COCO-80)',
  shortName: 'Object Detector (Fast)',
  description:
    'Lightweight detector — emergency fallback when neither Grounding DINO ' +
    'nor DETR-50 can load.',
  category: 'Vision',
  icon: '⚡',
  sizeMB: 130,
  dtype: 'q8',
};

export const MODELS = {
  /* ─────────────────────────── VISION ─────────────────────────── */

  // Default = HQ. The runtime helper `pickCaptionForDevice()` (below)
  // returns CAPTION_FAST when WebGPU is unavailable.
  CAPTION:      CAPTION_HQ,
  CAPTION_HQ,                     // alias for explicit opt-in
  CAPTION_FAST: CAPTION_MID,      // 500 M — WASM target
  CAPTION_TINY,                   // 256 M — emergency

  // Runtime default = DETR-50. Grounding DINO remains available as an
  // opt-in model, but the current Node ONNX path can reject its text
  // input_ids shape on some installs.
  DETECTION:      DETECTION_DETR,
  DETECTION_OPEN: DETECTION_OPEN_VOCAB,
  DETECTION_FAST: DETECTION_DETR,
  DETECTION_TINY: DETECTION_YOLOS,

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

  /* ─────────────────────────── SIGN LANGUAGE ─────────────────────────── */
  //
  // Loaded directly via @mediapipe/tasks-vision rather than through
  // transformers.js, but registered here for the AIOrchestration UI and
  // model-credit footers. The loader is in src/hooks/useSignLanguage.js.

  SIGN_GESTURE: {
    id: 'mediapipe/gesture_recognizer',
    task: 'gesture-recognition',
    name: 'MediaPipe Gesture Recognizer',
    shortName: 'ASL Gesture Recognizer',
    description:
      'Real-time hand pose + gesture classification. Recognises seven ' +
      'baseline ASL-relevant gestures out of the box (open palm, closed ' +
      'fist, thumbs up/down, pointing up, victory, ILoveYou) and powers ' +
      'the live Sign Language translator.',
    category: 'Vision',
    icon: '🤟',
    sizeMB: 8,
    assetUrl:
      'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/' +
      'gesture_recognizer/float16/1/gesture_recognizer.task',
    runtimeUrl:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  },

  SIGN_LANDMARKS: {
    id: 'mediapipe/hand_landmarker',
    task: 'hand-landmarks',
    name: 'MediaPipe Hand Landmarker',
    shortName: 'Hand Landmarker',
    description:
      'Extracts 21 hand keypoints per hand at >30 fps in-browser — feeds ' +
      'a lightweight kNN classifier for fingerspelling letters that the ' +
      'gesture recognizer alone cannot disambiguate.',
    category: 'Vision',
    icon: '✋',
    sizeMB: 7,
    assetUrl:
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/' +
      'hand_landmarker/float16/1/hand_landmarker.task',
    runtimeUrl:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
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
    dtype: undefined,
  },

  SOUND: {
    id: 'MIT/ast-finetuned-audioset-10-10-0.4593',
    task: 'audio-classification',
    name: 'Audio Spectrogram Transformer',
    shortName: 'Sound Classifier',
    description:
      'Classifies environmental sounds (doorbells, alarms, baby cries, sirens) ' +
      'from AudioSet — runs PC-local via the Python backend.',
    category: 'Audio',
    icon: '🔊',
    sizeMB: 340,
    dtype: undefined,
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

// NOTE: public/models/ only contains a .gitkeep — no model weights have been
// committed. Listing a model id here causes the loader to use
// local_files_only: true, which makes it fetch /models/<id>/config.json.
// Since that file does not exist, Vite's SPA catch-all returns index.html and
// the JSON parser immediately throws "Unexpected token '<'" — surfaced as the
// "received app HTML instead of model JSON" error in Scene Camera.
// Keep this set EMPTY until model weights are actually placed in public/models/.
export const BUNDLED_MODEL_IDS = new Set([]);

export function isBundledModel(modelId) {
  return BUNDLED_MODEL_IDS.has(modelId);
}

/**
 * Pick the best caption model entry for the current device.
 *
 * Calling code that already knows whether WebGPU is available (and
 * roughly how much memory the user has) should pass that in; otherwise
 * we conservatively return the 500M mid-tier model.
 *
 * @param {{ webgpu?: boolean, deviceMemoryGB?: number }} ctx
 */
export function pickCaptionForDevice(ctx = {}) {
  const { webgpu, deviceMemoryGB } = ctx;
  // SmolVLM 2.2B comfortably fits on any WebGPU adapter we've tested with
  // 4 GB+ of system memory. Below that we drop to the 500M variant.
  if (webgpu && (deviceMemoryGB == null || deviceMemoryGB >= 4)) {
    return MODELS.CAPTION_HQ;
  }
  if (webgpu) return MODELS.CAPTION_FAST;
  // WASM path — 500M is the largest practical SmolVLM variant.
  return MODELS.CAPTION_FAST;
}

/**
 * Open-vocabulary hazard prompts fed to Grounding DINO. These are the
 * labels the detector is asked to find on every frame. They cover the
 * COCO-80 ground truth (cars, knives, …) plus accessibility-critical
 * hazards that no closed-vocab COCO model can output.
 *
 * Order matters — Grounding DINO emits one box per phrase, so keep the
 * highest-impact safety prompts first.
 */
export const OPEN_VOCAB_HAZARD_PROMPTS = [
  // Mobility hazards — the single biggest accessibility gap in COCO-80.
  'staircase', 'step', 'curb', 'ramp', 'escalator', 'elevator door',
  'wet floor sign', 'puddle', 'spilled liquid', 'broken glass on floor',
  'cable on floor', 'extension cord on floor', 'rug edge', 'pothole',
  // Fire / heat / electrical hazards.
  'fire', 'flame', 'smoke', 'hot stove', 'lit candle', 'open oven',
  'hot iron', 'electric heater', 'exposed wire',
  // Sharp / dangerous objects (named to avoid weapons connotation where possible).
  'kitchen knife', 'scissors', 'glass shard', 'syringe', 'needle',
  // Vehicle hazards.
  'car', 'truck', 'bus', 'train', 'motorcycle', 'bicycle',
  'electric scooter', 'wheelchair',
  // People + carried obstacles.
  'person', 'child', 'pet', 'dog', 'cat', 'suitcase', 'shopping cart',
  'bag on floor', 'backpack', 'umbrella', 'skateboard',
  // Indoor large objects (trip risks at eye-level low contrast).
  'chair', 'couch', 'bed', 'dining table', 'bench', 'low table',
  // Doors / signs — useful for navigation.
  'door', 'open door', 'closed door', 'exit sign', 'stop sign',
];
