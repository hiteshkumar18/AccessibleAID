/**
 * useModelLoader — local-CPU edition.
 *
 * Instead of running models inside the browser with WebAssembly / WebGPU,
 * every inference call is forwarded to the Lumyn local inference server
 * (server/index.mjs) running on http://localhost:3001.  The server uses
 * onnxruntime-node (native ONNX) so models run on the Mac's CPU — or via
 * CoreML on Apple Silicon — with no WASM overhead.
 *
 * Public API is identical to the old browser-side loader:
 *   const { loadPipeline, loadVLM } = useModelLoader();
 *
 * loadPipeline(task, model, opts) → async proxy fn that mirrors the
 *   transformers.js pipeline call signature for each task.
 *
 * loadVLM(modelOrEntry) → { generate(messages, opts), modelId }
 *
 * No other hook (useSceneUnderstanding, useWhisper, useRAG, …) needs to
 * change — they call loadPipeline / loadVLM exactly as before.
 */

import { useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { MODEL_BY_ID } from '../config/models.js';

const API_BASE = '/api/infer';

// 5-minute timeout covers first-run model downloads on slow connections.
const TIMEOUT_MS = 5 * 60 * 1000;

// Module-level proxy cache — survives React remounts just like the old
// PIPELINE_CACHE did.
const proxyCache = new Map();

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function post(endpoint, body) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Task dispatcher ──────────────────────────────────────────────────────────
// Maps a transformers.js pipeline call to the matching server endpoint and
// returns a value in the same shape the original pipeline would have returned.

async function dispatch(task, model, args) {
  switch (task) {

    case 'zero-shot-object-detection': {
      const [image, labels, opts = {}] = args;
      const result = await post('detect', {
        task, model, image, labels,
        threshold: opts.threshold ?? 0.3,
        topk:      opts.topk      ?? 25,
      });
      if (result?.error) throw new Error(result.error);
      return Array.isArray(result) ? result : [];
    }

    case 'object-detection': {
      const [image, opts = {}] = args;
      const threshold = (typeof opts === 'object' ? opts.threshold : undefined) ?? 0.3;
      const result = await post('detect', { task, model, image, threshold });
      if (result?.error) throw new Error(result.error);
      return Array.isArray(result) ? result : [];
    }

    case 'automatic-speech-recognition': {
      const [audioData, opts = {}] = args;
      // Float32Array must be serialised to a plain array for JSON transport.
      const result = await post('transcribe', {
        audio:    Array.from(audioData),
        language: opts.language,
        task:     opts.task || 'transcribe',
      });
      if (result?.error) throw new Error(result.error);
      // Preserve both shapes callers expect: result.text  or  result[0].text
      return result;
    }

    case 'feature-extraction': {
      const [text, opts = {}] = args;
      const result = await post('embed', {
        text,
        pooling:   opts.pooling   || 'mean',
        normalize: opts.normalize ?? true,
      });
      if (result?.error) throw new Error(result.error);
      // Callers do `Array.from(out.data)` — return a tensor-shaped object.
      return { data: new Float32Array(result.embedding) };
    }

    case 'summarization': {
      const [text, opts = {}] = args;
      const result = await post('summarize', {
        text,
        max_new_tokens: opts.max_new_tokens,
        min_length:     opts.min_length,
      });
      if (result?.error) throw new Error(result.error);
      return [{ summary_text: result.text }];
    }

    case 'image-to-text': {
      const [image] = args;
      const result = await post('ocr', { image });
      if (result?.error) throw new Error(result.error);
      return [{ generated_text: result.text }];
    }

    case 'depth-estimation': {
      const [image] = args;
      const result = await post('depth', { image });
      if (result?.error) throw new Error(result.error);
      return {
        depth: {
          data:   new Float32Array(result.data),
          width:  result.width,
          height: result.height,
        },
      };
    }

    case 'audio-classification': {
      const [audioData, opts = {}] = args;
      const result = await post('classify-audio', {
        audio: Array.from(audioData),
        topk:  opts.topk ?? 5,
      });
      if (result?.error) throw new Error(result.error);
      return Array.isArray(result) ? result : [];
    }

    default:
      throw new Error(`[Lumyn] No server route configured for task: "${task}"`);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useModelLoader() {
  const { setLoader, clearLoader } = useApp();

  /**
   * loadPipeline(task, model, options?)
   *
   * Returns a callable proxy that forwards every invocation to the local
   * inference server.  The proxy is cached by (task, model) so subsequent
   * calls in the same session are free.
   */
  const loadPipeline = useCallback(
    async (task, model, _options = {}) => {
      const cacheKey = `${task}::${model}`;
      if (proxyCache.has(cacheKey)) return proxyCache.get(cacheKey);

      const meta        = MODEL_BY_ID[model];
      const displayName = meta?.shortName || task;

      const proxy = async (...args) => {
        const loaderKey = `infer:${task}:${model}`;
        setLoader(loaderKey, {
          loading:  true,
          progress: 0,
          label:    `${displayName} — running on Mac CPU…`,
        });
        try {
          return await dispatch(task, model, args);
        } catch (err) {
          // Surface a clear error if the inference server is not running.
          if (err?.name === 'TypeError' && /fetch/i.test(err.message)) {
            throw new Error(
              `${displayName}: cannot reach the local inference server. ` +
              `Run  npm run server  in a separate terminal and retry.`
            );
          }
          throw err;
        } finally {
          clearLoader(loaderKey);
        }
      };

      // Attach metadata — useSceneUnderstanding branches on lumynTask to
      // choose between zero-shot and closed-vocab call signatures.
      proxy.lumynTask    = task;
      proxy.lumynModelId = model;

      proxyCache.set(cacheKey, proxy);
      return proxy;
    },
    [setLoader, clearLoader]
  );

  /**
   * loadVLM(modelOrEntry)
   *
   * Returns { generate(messages, opts) → string, modelId } backed by the
   * /api/infer/caption endpoint on the local server.
   */
  const loadVLM = useCallback(
    async (modelOrEntry) => {
      const entry =
        typeof modelOrEntry === 'string'
          ? MODEL_BY_ID[modelOrEntry] || { id: modelOrEntry }
          : modelOrEntry;
      const model = entry.id;

      const cacheKey = `vlm::${model}`;
      if (proxyCache.has(cacheKey)) return proxyCache.get(cacheKey);

      const meta        = MODEL_BY_ID[model];
      const displayName = meta?.shortName || 'Vision model';

      const vlm = {
        modelId: model,

        generate: async (messages, opts = {}) => {
          const loaderKey = `vlm:${model}`;
          setLoader(loaderKey, {
            loading:  true,
            progress: 0,
            label:    `${displayName} — running on Mac CPU…`,
          });
          try {
            const result = await post('caption', {
              model,
              messages,
              max_new_tokens:      opts.max_new_tokens      ?? 320,
              do_sample:           opts.do_sample           ?? false,
              repetition_penalty:  opts.repetition_penalty,
            });
            if (result?.error) throw new Error(result.error);
            return result.text || '';
          } catch (err) {
            if (err?.name === 'TypeError' && /fetch/i.test(err.message)) {
              throw new Error(
                `${displayName}: cannot reach the local inference server. ` +
                `Run  npm run server  in a separate terminal and retry.`
              );
            }
            throw err;
          } finally {
            clearLoader(loaderKey);
          }
        },
      };

      proxyCache.set(cacheKey, vlm);
      return vlm;
    },
    [setLoader, clearLoader]
  );

  return { loadPipeline, loadVLM };
}
