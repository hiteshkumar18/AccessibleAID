/**
 * Lumyn local inference server.
 *
 * Runs every AI model on the Mac's CPU using onnxruntime-node (native ONNX,
 * no browser WASM sandbox). On Apple Silicon the CoreML execution provider
 * is picked up automatically by onnxruntime-node, giving further speed gains.
 *
 * Models are downloaded from HuggingFace Hub on first use and cached in
 * ~/.cache/huggingface/  — subsequent starts are instant.
 *
 * Endpoints
 *   POST /api/infer/detect      zero-shot or closed-vocab object detection
 *   POST /api/infer/caption     SmolVLM image captioning / scene description
 *   POST /api/infer/transcribe  Whisper speech-to-text
 *   POST /api/infer/embed       MiniLM text embeddings
 *   POST /api/infer/summarize   DistilBART text summarisation
 *   POST /api/infer/ocr         TrOCR printed-text OCR
 *   POST /api/infer/depth       Depth-Anything-v2 depth estimation
 *   GET  /api/health            liveness check
 */

import express from 'express';
import cors from 'cors';

const PORT = 3001;
const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ],
}));
// Images arrive as base64 data-URLs — allow up to 100 MB per request.
app.use(express.json({ limit: '100mb' }));

// ─── Model caches ─────────────────────────────────────────────────────────────
const pipelineCache = new Map();   // task::modelId → pipeline fn
const vlmCache      = new Map();   // vlm::modelId  → { processor, innerModel }
const FALLBACK_CAPTION_MODEL = 'Xenova/vit-gpt2-image-captioning';
const FALLBACK_DETECTION_MODEL = 'Xenova/detr-resnet-50';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

async function dataUrlToRawImage(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Invalid image data URL.');

  const [, mime = 'application/octet-stream', base64Flag, payload] = match;
  const bytes = base64Flag
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  const { RawImage } = await import('@huggingface/transformers');
  return RawImage.read(new Blob([bytes], { type: mime }));
}

async function normalizeImageInput(image) {
  if (!isDataUrl(image)) return image;
  return dataUrlToRawImage(image);
}

function withSingleBatchDimension(tensor) {
  if (!tensor?.dims || tensor.dims[0] === 1) return tensor;

  const TensorCtor = tensor.constructor;
  if (typeof TensorCtor !== 'function') return tensor;

  const tokenCount = tensor.data?.length ?? tensor.size ?? tensor.dims.reduce((a, b) => a * b, 1);
  return new TensorCtor(tensor.type, tensor.data, [1, tokenCount]);
}

function normalizeVLMInputs(inputs) {
  for (const key of ['input_ids', 'attention_mask', 'images_seq_mask', 'position_ids']) {
    inputs[key] = withSingleBatchDimension(inputs[key]);
  }
  return inputs;
}

/**
 * Lazy-load a transformers.js pipeline and cache it.
 * On first call the model downloads from HuggingFace (~seconds to minutes
 * depending on size); on subsequent calls it is read from disk cache.
 */
async function getPipeline(task, modelId, options = {}) {
  const key = `${task}::${modelId}`;
  if (pipelineCache.has(key)) return pipelineCache.get(key);

  console.log(`[Lumyn] ⬇  Loading  ${modelId}  (${task})…`);
  const { pipeline } = await import('@huggingface/transformers');
  const pipe = await pipeline(task, modelId, {
    ...options,
    device: 'cpu',   // onnxruntime-node; CoreML kicks in automatically on M-series
  });
  pipelineCache.set(key, pipe);
  console.log(`[Lumyn] ✓  Ready    ${modelId}`);
  return pipe;
}

/**
 * Lazy-load a vision-language model (SmolVLM / Idefics3) and cache it.
 * Returns { processor, innerModel }.
 */
async function getVLM(modelId, dtype) {
  const key = `vlm::${modelId}`;
  if (vlmCache.has(key)) return vlmCache.get(key);

  console.log(`[Lumyn] ⬇  Loading VLM  ${modelId}…`);
  const tjs = await import('@huggingface/transformers');

  // Walk processor constructors from most-specific to most-generic.
  const processorCtors = [
    tjs.SmolVLMProcessor,
    tjs.Idefics3Processor,
    tjs.AutoProcessor,
  ].filter((C) => typeof C?.from_pretrained === 'function');

  const modelCtors = [
    tjs.AutoModelForImageTextToText,
    tjs.AutoModelForVision2Seq,
    tjs.SmolVLMForConditionalGeneration,
    tjs.Idefics3ForConditionalGeneration,
  ].filter((C) => typeof C?.from_pretrained === 'function');

  let processor = null;
  for (const Ctor of processorCtors) {
    try {
      processor = await Ctor.from_pretrained(modelId);
      break;
    } catch (_) { processor = null; }
  }
  if (!processor) throw new Error(`Cannot load processor for ${modelId}`);

  let innerModel = null;
  for (const Ctor of modelCtors) {
    try {
      innerModel = await Ctor.from_pretrained(modelId, {
        device: 'cpu',
        // CPU-safe quantisation: vision encoder q8, decoder q4.
        dtype: dtype || {
          embed_tokens:          'q8',
          vision_encoder:        'q8',
          decoder_model_merged:  'q4',
        },
      });
      break;
    } catch (_) { innerModel = null; }
  }
  if (!innerModel) throw new Error(`Cannot load model weights for ${modelId}`);

  const vlm = { processor, innerModel };
  vlmCache.set(key, vlm);
  console.log(`[Lumyn] ✓  Ready VLM  ${modelId}`);
  return vlm;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Object detection (zero-shot Grounding DINO or closed-vocab DETR/YOLOS) ───
app.post('/api/infer/detect', async (req, res) => {
  try {
    const {
      image, labels, model, task,
      threshold = 0.3, topk = 25,
    } = req.body;

    if (task === 'zero-shot-object-detection') {
      const imageInput = await normalizeImageInput(image);
      let result = [];

      try {
        const pipe = await getPipeline('zero-shot-object-detection', model, { dtype: 'q8' });
        result = await pipe(imageInput, labels, { threshold, topk });
      } catch (zeroShotErr) {
        console.warn('[Lumyn] zero-shot detector failed; falling back to DETR:', zeroShotErr.message);
        const fallbackPipe = await getPipeline('object-detection', FALLBACK_DETECTION_MODEL, { dtype: 'q8' });
        result = await fallbackPipe(imageInput, { threshold: Math.max(threshold, 0.5) });
      }

      return res.json(Array.isArray(result) ? result : []);
    }

    // Closed-vocab fallback (DETR / YOLOS)
    const pipe = await getPipeline('object-detection', model, { dtype: 'q8' });
    const imageInput = await normalizeImageInput(image);
    const result = await pipe(imageInput, { threshold });
    return res.json(Array.isArray(result) ? result : []);
  } catch (err) {
    console.error('[Lumyn] detect:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── VLM caption / scene description ──────────────────────────────────────────
app.post('/api/infer/caption', async (req, res) => {
  try {
    const {
      messages,
      max_new_tokens = 320,
    } = req.body;

    // Extract image data-URLs from the messages array.
    const imageUrls = [];
    for (const m of messages) {
      if (Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c.type === 'image' && c.url) imageUrls.push(c.url);
        }
      }
    }
    if (imageUrls.length === 0) return res.json({ text: '' });

    const rawImages  = await Promise.all(imageUrls.map((u) => normalizeImageInput(u)));
    const captioner  = await getPipeline('image-to-text', FALLBACK_CAPTION_MODEL, { dtype: 'q8' });
    const result     = await captioner(rawImages[0], {
      max_new_tokens: Math.min(max_new_tokens, 96),
    });
    const text       = (Array.isArray(result) ? result[0]?.generated_text : result?.generated_text) || '';

    res.json({ text: text.trim() });
  } catch (err) {
    console.error('[Lumyn] caption:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Speech recognition (Whisper) ─────────────────────────────────────────────
app.post('/api/infer/transcribe', async (req, res) => {
  try {
    const { audio, language = 'english', task: whisperTask = 'transcribe' } = req.body;
    const audioData = new Float32Array(audio);
    const pipe = await getPipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
    const result = await pipe(audioData, {
      language,
      task: whisperTask,
      return_timestamps: false,
    });
    const text = ((Array.isArray(result) ? result[0]?.text : result?.text) || '').trim();
    res.json({ text });
  } catch (err) {
    console.error('[Lumyn] transcribe:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Text embeddings (MiniLM) ──────────────────────────────────────────────────
app.post('/api/infer/embed', async (req, res) => {
  try {
    const { text, pooling = 'mean', normalize = true } = req.body;
    const pipe = await getPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const out  = await pipe(text, { pooling, normalize });
    res.json({ embedding: Array.from(out.data) });
  } catch (err) {
    console.error('[Lumyn] embed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Summarisation (DistilBART) ────────────────────────────────────────────────
app.post('/api/infer/summarize', async (req, res) => {
  try {
    const { text, max_new_tokens = 200, min_length } = req.body;
    const pipe   = await getPipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    const result = await pipe(text, {
      max_new_tokens,
      ...(min_length != null ? { min_length } : {}),
    });
    const summary = (Array.isArray(result) ? result[0]?.summary_text : result?.summary_text) || '';
    res.json({ text: summary });
  } catch (err) {
    console.error('[Lumyn] summarize:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── OCR (TrOCR) ───────────────────────────────────────────────────────────────
app.post('/api/infer/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    const pipe   = await getPipeline('image-to-text', 'Xenova/trocr-base-printed', { dtype: 'q8' });
    const imageInput = await normalizeImageInput(image);
    const result = await pipe(imageInput);
    const text   = (Array.isArray(result) ? result[0]?.generated_text : result?.generated_text) || '';
    res.json({ text });
  } catch (err) {
    console.error('[Lumyn] ocr:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Depth estimation (Depth-Anything-v2) ──────────────────────────────────────
app.post('/api/infer/depth', async (req, res) => {
  try {
    const { image } = req.body;
    const pipe   = await getPipeline('depth-estimation', 'onnx-community/depth-anything-v2-base', { dtype: 'fp32' });
    const imageInput = await normalizeImageInput(image);
    const result = await pipe(imageInput);

    // The pipeline returns { depth: RawImage } where depth is a greyscale
    // image whose pixel values encode relative depth. Pull out flat data + dims.
    const raw = result?.depth || result;
    if (!raw?.data) return res.json({ width: 0, height: 0, data: [] });

    res.json({
      width:  raw.width,
      height: raw.height,
      data:   Array.from(raw.data),
    });
  } catch (err) {
    console.error('[Lumyn] depth:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   Lumyn local inference server  (CPU mode)  ║');
  console.log(`  ║   http://localhost:${PORT}                      ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Models download to ~/.cache/huggingface/ on first use.');
  console.log('  Apple Silicon: CoreML acceleration is used automatically.');
  console.log('');
});
