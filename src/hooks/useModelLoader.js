import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * Lazy loader / cache for transformers.js pipelines.
 *
 * Key design decisions:
 *   • Pipelines are cached per (task, model, dtype) tuple in a module-level Map
 *     so they survive remounts (the user can switch modes back and forth).
 *   • We dynamically import @huggingface/transformers so the main bundle
 *     stays small and a network failure during initial load surfaces nicely.
 *   • Per-FILE progress is mirrored into AppContext via setLoader so the
 *     user sees individual ONNX shards downloading (an LLM has 3–4 files;
 *     a single bar that flips between them looks frozen).
 *   • If WebGPU isn't available we silently fall back to WASM and toast once.
 */

const PIPELINE_CACHE = new Map();

let webgpuChecked = false;
let webgpuAvailable = false;
async function detectWebGPU() {
  if (webgpuChecked) return webgpuAvailable;
  webgpuChecked = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      webgpuAvailable = !!adapter;
    }
  } catch (_) {
    webgpuAvailable = false;
  }
  return webgpuAvailable;
}

export function useModelLoader() {
  const { setLoader, clearLoader, state } = useApp();
  const toastShownRef = useRef(false);

  const loadPipeline = useCallback(
    async (task, model, options = {}) => {
      const cacheKey = `${task}::${model}::${options.dtype || 'auto'}`;
      if (PIPELINE_CACHE.has(cacheKey)) return PIPELINE_CACHE.get(cacheKey);

      const baseLoaderKey = `model:${task}:${model}`;
      // Track per-file progress so we can show a list, not a single
      // confused bar.
      const fileProgress = new Map(); // filename -> {progress, loaded, total}

      const updateLoaderUI = () => {
        const files = Array.from(fileProgress.entries());
        if (!files.length) {
          setLoader(baseLoaderKey, {
            loading: true,
            progress: 0,
            label: `Connecting to ${prettyTaskName(task)}…`,
          });
          return;
        }
        // Average progress across files for the overall bar.
        const avg =
          files.reduce((s, [, v]) => s + (v.progress || 0), 0) / files.length;
        const lines = files
          .map(
            ([name, v]) =>
              `${name} — ${Math.round(v.progress || 0)}%${
                v.total ? ` (${humanBytes(v.loaded)} / ${humanBytes(v.total)})` : ''
              }`
          )
          .join('\n');
        setLoader(baseLoaderKey, {
          loading: true,
          progress: Math.round(avg),
          label: `Downloading ${prettyTaskName(task)} ${Math.round(avg)}%`,
          detail: lines,
        });
      };

      updateLoaderUI();

      try {
        const tjs = await import('@huggingface/transformers');
        const { pipeline, env } = tjs;
        env.allowRemoteModels = true;
        env.useBrowserCache = true;

        // IMPORTANT: do NOT pin a custom CDN path for the ONNX runtime
        // here. transformers.js bundles a specific ORT version whose
        // Tensor API matches the inference path it uses internally. If we
        // load a different ORT build from a CDN, tensors come back without
        // `.getValue()` and inference throws "t.getValue is not a function".
        // We just nudge ORT to single-threaded WASM, which is the most
        // compatible mode given we don't ship COEP headers.
        try {
          if (env?.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.numThreads = 1;
          }
        } catch (_) {
          /* env shape varies across versions — best effort */
        }

        // Decide device. Default to WASM for maximum compatibility —
        // WebGPU has known tensor-API quirks across transformers.js v3
        // patch versions ("t.getValue is not a function" originates here)
        // so we only opt in when the user explicitly selects WebGPU in
        // settings.
        let device = 'wasm';
        const desired = state.prefs.backend || 'auto';
        if (desired === 'webgpu') {
          const ok = await detectWebGPU();
          if (ok) device = 'webgpu';
        }
        if (
          desired === 'auto' &&
          !toastShownRef.current &&
          typeof window !== 'undefined'
        ) {
          toastShownRef.current = true;
          try {
            window.dispatchEvent(
              new CustomEvent('aaid:toast', {
                detail: {
                  type: 'info',
                  message: 'Running on WASM (most compatible). Switch to WebGPU in settings if your hardware supports it.',
                },
              })
            );
          } catch (_) {
            /* ignore */
          }
        }

        const progress_callback = (p) => {
          // p ~ { status, name, progress, loaded, total, file }
          if (!p) return;
          const fileName = p.file || p.name || 'model';
          if (p.status === 'progress' || p.status === 'download') {
            const pct =
              typeof p.progress === 'number'
                ? p.progress
                : p.loaded && p.total
                ? (p.loaded / p.total) * 100
                : 0;
            fileProgress.set(fileName, {
              progress: pct,
              loaded: p.loaded || 0,
              total: p.total || 0,
            });
            updateLoaderUI();
          } else if (p.status === 'done') {
            fileProgress.set(fileName, { progress: 100, loaded: p.total || 0, total: p.total || 0 });
            updateLoaderUI();
          } else if (p.status === 'initiate') {
            fileProgress.set(fileName, { progress: 0, loaded: 0, total: 0 });
            updateLoaderUI();
          }
          // Useful for hackathon debugging in DevTools console.
          // eslint-disable-next-line no-console
          if (typeof console !== 'undefined' && console.debug) {
            console.debug('[AccessibleAID model]', p);
          }
        };

        const pipe = await pipeline(task, model, {
          device,
          dtype: options.dtype, // undefined → transformers.js picks best
          progress_callback,
        });
        PIPELINE_CACHE.set(cacheKey, pipe);
        clearLoader(baseLoaderKey);
        return pipe;
      } catch (err) {
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.error('[AccessibleAID] model load failed', err);
        const friendly =
          'Could not load the AI model. Check your connection on first load — after that the app works offline. (Open DevTools → Console for details.)';
        const wrapped = new Error(friendly);
        wrapped.cause = err;
        throw wrapped;
      }
    },
    [setLoader, clearLoader, state.prefs.backend]
  );

  return { loadPipeline };
}

function prettyTaskName(task) {
  switch (task) {
    case 'image-to-text':
      return 'vision model';
    case 'object-detection':
      return 'object detector';
    case 'depth-estimation':
      return 'depth model';
    case 'audio-classification':
      return 'sound classifier';
    case 'automatic-speech-recognition':
      return 'speech recognizer';
    case 'text2text-generation':
    case 'text-generation':
      return 'language model';
    case 'feature-extraction':
      return 'embedding model';
    default:
      return task;
  }
}

function humanBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}
