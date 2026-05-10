/**
 * Central model registry for all on-device AI models used in Lumyn.
 *
 * These are the DEMO models — best-available open-source ONNX models for
 * maximum accuracy. Production would use quantized variants (q4/q8) or
 * platform-native models (Core ML on iPhone, NNAPI on Android) to
 * run offline on a 6 GB RAM phone.
 *
 * All models are open-source, run fully on-device via transformers.js (ONNX),
 * and never send user data to any server.
 */

export const MODELS = {
  CAPTION: {
    id: 'Xenova/vit-gpt2-image-captioning',
    task: 'image-to-text',
    name: 'ViT-GPT2 Image Captioning',
    shortName: 'Scene Describer',
    description: 'Describes scenes, environments, and objects in natural language',
    category: 'Vision',
    icon: '👁️',
    sizeMB: 85,
    dtype: undefined,
    demoNote: 'Prod: BLIP-2 quantized via Core ML / NNAPI',
  },
  DETECTION: {
    id: 'Xenova/yolos-small',
    task: 'object-detection',
    name: 'YOLOS Small',
    shortName: 'Object Detector',
    description: 'Detects and locates objects, hazards, and obstacles in real time',
    category: 'Vision',
    icon: '🔍',
    sizeMB: 130,
    dtype: 'q8',
    demoNote: 'Prod: YOLOS-tiny q4 — 12 MB on-device',
  },
  DEPTH: {
    id: 'onnx-community/depth-anything-v2-base',
    task: 'depth-estimation',
    name: 'Depth Anything v2 Base',
    shortName: 'Depth Sensor',
    description: 'Estimates scene depth for obstacle and distance awareness',
    category: 'Vision',
    icon: '📏',
    sizeMB: 390,
    dtype: 'fp32',
    demoNote: 'Prod: Depth-Anything-v2-Small q8 — 49 MB',
  },
  OCR: {
    id: 'Xenova/trocr-base-printed',
    task: 'image-to-text',
    name: 'TrOCR Base Printed',
    shortName: 'Text Reader',
    description: 'Reads printed text from signs, menus, labels, and documents',
    category: 'Vision',
    icon: '📝',
    sizeMB: 610,
    dtype: undefined,
    demoNote: 'Prod: TrOCR-small q8 — 80 MB',
  },
  WHISPER: {
    id: 'onnx-community/whisper-large-v3-turbo',
    task: 'automatic-speech-recognition',
    name: 'Whisper Large v3 Turbo',
    shortName: 'Speech Recognition',
    description: 'State-of-the-art speech transcription — 99 languages, near-human accuracy',
    category: 'Audio',
    icon: '🎤',
    sizeMB: 1600,
    dtype: 'q4',
    demoNote: 'Prod: Whisper-base.en q8 — 145 MB',
  },
  SOUND: {
    id: 'Xenova/ast-finetuned-audioset-10-10-0.4593',
    task: 'audio-classification',
    name: 'Audio Spectrogram Transformer',
    shortName: 'Sound Detector',
    description: 'Identifies sounds — sirens, alarms, speech, glass breaks, doorbells',
    category: 'Audio',
    icon: '🔊',
    sizeMB: 305,
    dtype: 'q8',
    demoNote: 'Prod: same model — already compact',
  },
  EMBEDDING: {
    id: 'Xenova/all-roberta-large-v1',
    task: 'feature-extraction',
    name: 'RoBERTa Large Embeddings',
    shortName: 'Knowledge Search',
    description: 'Powers medication identification and semantic knowledge search',
    category: 'Language',
    icon: '🧠',
    sizeMB: 1420,
    dtype: undefined,
    demoNote: 'Prod: all-MiniLM-L6-v2 q8 — 22 MB',
  },
  SUMMARIZE: {
    id: 'Xenova/distilbart-cnn-6-6',
    task: 'summarization',
    name: 'DistilBART CNN',
    shortName: 'Text Simplifier',
    description: 'Rewrites complex medical, legal, and government text in plain language',
    category: 'Language',
    icon: '📖',
    sizeMB: 290,
    dtype: undefined,
    demoNote: 'Prod: same model q4 — 75 MB',
  },
};

export const MODEL_BY_ID = Object.fromEntries(
  Object.values(MODELS).map((m) => [m.id, m])
);

export const ALL_MODELS = Object.values(MODELS);
