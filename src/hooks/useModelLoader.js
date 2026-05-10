import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { MODEL_BY_ID } from '../config/models.js';

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

      const modelMeta = MODEL_BY_ID[model];
      const displayName = modelMeta?.shortName || prettyTaskName(task);

      const updateLoaderUI = () => {
        const files = Array.from(fileProgress.entries());
        if (!files.length) {
          setLoader(baseLoaderKey, {
            loading: true,
            progress: 0,
            label: `Loading ${displayName}…`,
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
          label: displayName,
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

        // ─── Console log helpers ──────────────────────────────────────────
        const logStyle = {
          header:  'background:#1e3a5f;color:#60a5fa;font-weight:bold;padding:2px 6px;border-radius:4px;',
          info:    'background:#14532d;color:#4ade80;padding:2px 6px;border-radius:4px;',
          progress:'background:#1e1b4b;color:#a78bfa;padding:2px 6px;border-radius:4px;',
          done:    'background:#14532d;color:#86efac;font-weight:bold;padding:2px 6px;border-radius:4px;',
          error:   'background:#450a0a;color:#f87171;font-weight:bold;padding:2px 6px;border-radius:4px;',
        };
        // eslint-disable-next-line no-console
        console.log(
          `%c🤖 Lumyn AI  %c Loading: ${displayName} (${model}) — device: ${device}`,
          logStyle.header, 'color:#94a3b8;',
          modelMeta ? `| ~${modelMeta.sizeMB} MB` : ''
        );
        if (modelMeta?.demoNote) {
          // eslint-disable-next-line no-console
          console.log(`%c📱 Prod note  %c ${modelMeta.demoNote}`, logStyle.info, 'color:#64748b;');
        }

        const progress_callback = (p) => {
          // p ~ { status, name, progress, loaded, total, file }
          if (!p) return;
          const fileName = p.file || p.name || 'model';

          if (p.status === 'initiate') {
            fileProgress.set(fileName, { progress: 0, loaded: 0, total: 0 });
            // eslint-disable-next-line no-console
            console.log(
              `%c⬇  Fetch     %c ${fileName}`,
              logStyle.progress, 'color:#cbd5e1;font-family:monospace;'
            );
            updateLoaderUI();

          } else if (p.status === 'progress' || p.status === 'download') {
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
            // Throttle: log only at 25 / 50 / 75 %
            const rounded = Math.round(pct);
            if (rounded === 25 || rounded === 50 || rounded === 75) {
              // eslint-disable-next-line no-console
              console.log(
                `%c${rounded.toString().padStart(3)}%       %c ${fileName}  ${humanBytes(p.loaded || 0)} / ${humanBytes(p.total || 0)}`,
                logStyle.progress, 'color:#94a3b8;font-family:monospace;'
              );
            }
            updateLoaderUI();

          } else if (p.status === 'done') {
            fileProgress.set(fileName, { progress: 100, loaded: p.total || 0, total: p.total || 0 });
            // eslint-disable-next-line no-console
            console.log(
              `%c✓  Cached    %c ${fileName}  (${humanBytes(p.total || 0)})`,
              logStyle.done, 'color:#86efac;font-family:monospace;'
            );
            updateLoaderUI();
          }
        };

        const pipe = await pipeline(task, model, {
          device,
          dtype: options.dtype, // undefined → transformers.js picks best
          progress_callback,
        });
        PIPELINE_CACHE.set(cacheKey, pipe);
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.log(
          `%c🚀 Ready      %c ${displayName} (${model}) is loaded and cached`,
          'background:#14532d;color:#4ade80;font-weight:bold;padding:2px 6px;border-radius:4px;',
          'color:#4ade80;font-weight:bold;'
        );
        return pipe;
      } catch (err) {
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.error(
          `%c✖ Failed      %c ${displayName} (${model})\n`,
          'background:#450a0a;color:#f87171;font-weight:bold;padding:2px 6px;border-radius:4px;',
          'color:#f87171;',
          err
        );
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
