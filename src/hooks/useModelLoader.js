import { useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import {
  MODELS,
  MODEL_BY_ID,
  LOCAL_MODEL_PATH,
  isBundledModel,
} from '../config/models.js';

/**
 * Lazy loader / cache for transformers.js pipelines AND vision-language
 * models loaded via the lower-level AutoProcessor + AutoModel APIs.
 *
 * Key design decisions:
 *   • Both classic pipelines and VLM bundles are cached per
 *     (task|kind, model, dtype, device) tuple in a module-level Map so they
 *     survive remounts (the user can switch modes back and forth).
 *   • We dynamically import @huggingface/transformers so the main bundle
 *     stays small and a network failure during initial load surfaces nicely.
 *   • Per-FILE progress is mirrored into AppContext via setLoader so the
 *     user sees individual ONNX shards downloading (an LLM has 3–4 files;
 *     a single bar that flips between them looks frozen).
 *   • Vision-language models (SmolVLM, Florence-2, …) cannot be loaded via
 *     `pipeline()` because v3.x has no `image-text-to-text` pipeline tag.
 *     For those we expose `loadVLM()` which wraps the manual
 *     AutoProcessor + AutoModelForImageTextToText flow behind the same
 *     chat-message API used by all of our consumers.
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
      const fallbackCandidates =
        task === 'object-detection' && model === MODELS.DETECTION.id
          ? [
              { model, dtype: options.dtype },
              { model: MODELS.DETECTION_FAST.id, dtype: MODELS.DETECTION_FAST.dtype },
            ]
          : [{ model, dtype: options.dtype }];

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
        env.localModelPath = LOCAL_MODEL_PATH;
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
            // The webpack bundle resolves WASM paths relative to its own URL,
            // which in Vite dev mode is inside @huggingface/transformers/dist/ —
            // but the actual .wasm files live in onnxruntime-web/dist/.
            // We copy them to public/ and point wasmPaths to the root so every
            // environment (dev + prod) finds them reliably.
            env.backends.onnx.wasm.wasmPaths = '/';
          }
        } catch (_) {
          /* env shape varies across versions — best effort */
        }

        // Device selection.
        //   • 'webgpu'  → force WebGPU (will throw if missing — that's the
        //                 user's explicit choice).
        //   • 'wasm'    → force WASM single-threaded (max compatibility).
        //   • 'auto'    → try WebGPU first (much faster for VLMs); fall back
        //                 to WASM transparently if no GPU adapter is found.
        const desired = state.prefs.backend || 'auto';
        let device = 'wasm';
        if (desired === 'webgpu') {
          device = 'webgpu';
        } else if (desired === 'auto') {
          const ok = await detectWebGPU();
          device = ok ? 'webgpu' : 'wasm';
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

        let pipe;
        let loadedModel = model;
        let lastError = null;

        for (const candidate of fallbackCandidates) {
          try {
            const useBundledFilesOnly = isBundledModel(candidate.model);
            env.allowLocalModels = useBundledFilesOnly;
            pipe = await pipeline(task, candidate.model, {
              device,
              dtype: candidate.dtype, // undefined → transformers.js picks best
              progress_callback,
              local_files_only: useBundledFilesOnly,
            });
            loadedModel = candidate.model;
            break;
          } catch (candidateError) {
            lastError = candidateError;
            if (candidate.model === model || fallbackCandidates.length === 1) {
              // eslint-disable-next-line no-console
              console.warn(
                `[Lumyn] failed to load ${candidate.model}; ${
                  fallbackCandidates.length > 1 ? 'trying detector fallback…' : 'no fallback available.'
                }`,
                candidateError
              );
            }
          }
        }

        if (!pipe) throw lastError || new Error(`Could not load ${displayName}.`);

        PIPELINE_CACHE.set(cacheKey, pipe);
        if (loadedModel !== model) {
          const resolvedCacheKey = `${task}::${loadedModel}::${MODELS.DETECTION_FAST.dtype || 'auto'}`;
          PIPELINE_CACHE.set(resolvedCacheKey, pipe);
        }
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.log(
          `%c🚀 Ready      %c ${displayName} (${loadedModel}) is loaded and cached`,
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

        // Build a precise, user-actionable error message instead of the
        // old generic "check your connection" toast that hid every real
        // failure mode (404 model id, OOM, fetch abort, etc.).
        const raw = `${err?.name || 'Error'}: ${err?.message || err}`;
        let friendly;
        if (/local_files_only=true|file was not found locally|missing locally/i.test(raw)) {
          friendly =
            `Bundled files for ${displayName} are missing or incomplete. ` +
            `Rebuild the app and make sure /public/models contains that model.`;
        } else if (/Unexpected token '<'|<!doctype|not valid JSON/i.test(raw)) {
          friendly =
            `${displayName} received app HTML instead of model JSON. ` +
            `Hard-refresh or restart the dev server so the latest loader is used.`;
        } else if (/404|not found|Could not find/i.test(raw)) {
          friendly =
            `Model "${model}" was not found on Hugging Face. ` +
            `Check the model id in src/config/models.js.`;
        } else if (/network|fetch|Failed to fetch|abort|timeout/i.test(raw)) {
          friendly =
            `Network error while downloading ${displayName}. ` +
            `Check your connection on first load — after that the app works offline.`;
        } else if (/memory|out of memory|RuntimeError|allocation|wasm/i.test(raw)) {
          friendly =
            `Not enough memory to load ${displayName}. ` +
            `Try the smaller variant (set MODELS.CAPTION = MODELS.CAPTION_TINY) ` +
            `or close other tabs and retry.`;
        } else if (
          task === 'object-detection' &&
          model === MODELS.DETECTION.id
        ) {
          friendly =
            `Could not load ${displayName}. The app also tried the smaller ` +
            `${MODELS.DETECTION_FAST.shortName} fallback, but that failed too. ` +
            `Check your connection and retry.`;
        } else {
          friendly =
            `Could not load ${displayName}. ${err?.message || ''} ` +
            `(See DevTools → Console for the full stack trace.)`;
        }

        const wrapped = new Error(friendly);
        wrapped.cause = err;
        throw wrapped;
      }
    },
    [setLoader, clearLoader, state.prefs.backend]
  );

  /**
   * Load a vision-language model (e.g. SmolVLM, Florence-2) and return a
   * thin wrapper with a `generate(messages, opts)` method so consumer code
   * looks identical to the (now-removed) `image-text-to-text` pipeline call:
   *
   *   const vlm = await loadVLM(MODELS.CAPTION);
   *   const text = await vlm.generate([
   *     { role: 'user',
   *       content: [
   *         { type: 'image', url: dataUrl },
   *         { type: 'text',  text: 'Describe this scene.' },
   *       ] },
   *   ], { max_new_tokens: 200 });
   *
   * Internally this skips the high-level `pipeline()` factory (which has no
   * `image-text-to-text` task tag in transformers.js v3) and uses the
   * lower-level AutoProcessor + AutoModelForImageTextToText pair instead.
   */
  const loadVLM = useCallback(
    async (modelOrEntry) => {
      const entry =
        typeof modelOrEntry === 'string'
          ? MODEL_BY_ID[modelOrEntry] || { id: modelOrEntry, dtype: undefined }
          : modelOrEntry;
      const model = entry.id;
      const dtype = entry.dtype;
      const fallbackCandidates =
        model === MODELS.CAPTION.id
          ? [
              entry,
              MODELS.CAPTION_TINY,
            ]
          : [entry];

      const desired = state.prefs.backend || 'auto';
      let device = 'wasm';
      if (desired === 'webgpu') {
        device = 'webgpu';
      } else if (desired === 'auto') {
        const ok = await detectWebGPU();
        device = ok ? 'webgpu' : 'wasm';
      }

      const cacheKey = `vlm::${model}::${stableStringify(dtype)}::${device}`;
      if (PIPELINE_CACHE.has(cacheKey)) return PIPELINE_CACHE.get(cacheKey);

      const baseLoaderKey = `vlm:${model}`;
      const fileProgress = new Map();
      const displayName = entry.shortName || 'vision-language model';

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
        const { RawImage, env } = tjs;
        const ProcessorCtor =
          tjs.AutoProcessor ||
          tjs.SmolVLMProcessor ||
          tjs.Idefics3Processor ||
          tjs.Processor;
        const ModelCtor =
          tjs.AutoModelForImageTextToText ||
          tjs.AutoModelForVision2Seq ||
          tjs.SmolVLMForConditionalGeneration ||
          tjs.Idefics3ForConditionalGeneration;

        if (
          typeof ProcessorCtor?.from_pretrained !== 'function' ||
          typeof ModelCtor?.from_pretrained !== 'function'
        ) {
          const available = Object.keys(tjs)
            .filter((k) => /Processor|SmolVLM|Vision2Seq|ImageTextToText/.test(k))
            .sort()
            .join(', ');
          throw new Error(
            `Transformers VLM constructors are unavailable. Clear cached site data and reload. ` +
            `Available exports: ${available || 'none'}`
          );
        }

        env.allowRemoteModels = true;
        env.localModelPath = LOCAL_MODEL_PATH;
        env.useBrowserCache = true;
        try {
          if (env?.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.wasmPaths = '/';
          }
        } catch (_) { /* env shape varies — best effort */ }

        // eslint-disable-next-line no-console
        console.log(
          `%c🤖 Lumyn VLM %c Loading: ${displayName} (${model}) — device: ${device}`,
          'background:#1e3a5f;color:#60a5fa;font-weight:bold;padding:2px 6px;border-radius:4px;',
          'color:#94a3b8;',
          entry.sizeMB ? `| ~${entry.sizeMB} MB` : ''
        );

        const progress_callback = (p) => {
          if (!p) return;
          const fileName = p.file || p.name || 'model';
          if (p.status === 'initiate') {
            fileProgress.set(fileName, { progress: 0, loaded: 0, total: 0 });
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
            updateLoaderUI();
          } else if (p.status === 'done') {
            fileProgress.set(fileName, {
              progress: 100,
              loaded: p.total || 0,
              total: p.total || 0,
            });
            updateLoaderUI();
          }
        };

        let processor;
        let innerModel;
        let loadedEntry = entry;
        let lastError = null;

        for (const candidate of fallbackCandidates) {
          try {
            const useBundledFilesOnly = isBundledModel(candidate.id);
            env.allowLocalModels = useBundledFilesOnly;

            const ctorPairs = buildVlmCtorPairs(tjs, candidate.id);
            let pairError = null;

            for (const { processorCtor, modelCtor } of ctorPairs) {
              try {
                processor = await processorCtor.from_pretrained(candidate.id, {
                  progress_callback,
                  local_files_only: useBundledFilesOnly,
                });
                innerModel = await modelCtor.from_pretrained(candidate.id, {
                  dtype: candidate.dtype,
                  device,
                  progress_callback,
                  local_files_only: useBundledFilesOnly,
                });
                pairError = null;
                break;
              } catch (ctorError) {
                pairError = ctorError;
                processor = null;
                innerModel = null;
              }
            }

            if (!processor || !innerModel) {
              throw pairError || new Error(`Could not load ${candidate.id}.`);
            }

            loadedEntry = candidate;
            break;
          } catch (candidateError) {
            lastError = candidateError;
            // eslint-disable-next-line no-console
            console.warn(
              `[Lumyn] failed to load VLM ${candidate.id}; ${
                fallbackCandidates.length > 1 && candidate.id === model
                  ? 'trying smaller VLM fallback…'
                  : 'no further VLM fallback available.'
              }`,
              candidateError
            );
          }
        }

        if (!processor || !innerModel) {
          throw lastError || new Error(`Could not load ${displayName}.`);
        }

        async function generate(messages, generationOpts = {}) {
          const imageUrls = [];
          for (const m of messages) {
            if (Array.isArray(m.content)) {
              for (const c of m.content) {
                if (c.type === 'image' && c.url) imageUrls.push(c.url);
              }
            }
          }
          // The chat template uses `{ type: 'image' }` placeholders; we feed
          // the actual decoded RawImage objects to the processor separately.
          const cleanedMessages = messages.map((m) => ({
            role: m.role,
            content: Array.isArray(m.content)
              ? m.content.map((c) =>
                  c.type === 'image' ? { type: 'image' } : c
                )
              : m.content,
          }));

          const rawImages = await Promise.all(
            imageUrls.map((u) => RawImage.read(u))
          );

          const text = processor.apply_chat_template(cleanedMessages, {
            add_generation_prompt: true,
          });
          const inputs = await processor(text, rawImages, {
            do_image_splitting: false,
          });

          const generatedIds = await innerModel.generate({
            ...inputs,
            max_new_tokens: generationOpts.max_new_tokens ?? 200,
            do_sample: generationOpts.do_sample ?? false,
            ...(generationOpts.repetition_penalty != null
              ? { repetition_penalty: generationOpts.repetition_penalty }
              : {}),
          });

          // Slice off the prompt tokens so we only decode what was generated.
          const promptLen = inputs.input_ids.dims.at(-1);
          const newTokens = generatedIds.slice(null, [promptLen, null]);
          const decoded = processor.batch_decode(newTokens, {
            skip_special_tokens: true,
          });
          return (decoded?.[0] || '').trim();
        }

        const vlm = { processor, model: innerModel, generate, modelId: loadedEntry.id };
        PIPELINE_CACHE.set(cacheKey, vlm);
        if (loadedEntry.id !== model) {
          const resolvedCacheKey = `vlm::${loadedEntry.id}::${stableStringify(loadedEntry.dtype)}::${device}`;
          PIPELINE_CACHE.set(resolvedCacheKey, vlm);
        }
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.log(
          `%c🚀 Ready      %c ${displayName} (${loadedEntry.id}) is loaded and cached`,
          'background:#14532d;color:#4ade80;font-weight:bold;padding:2px 6px;border-radius:4px;',
          'color:#4ade80;font-weight:bold;'
        );
        return vlm;
      } catch (err) {
        clearLoader(baseLoaderKey);
        // eslint-disable-next-line no-console
        console.error(
          `%c✖ VLM Failed %c ${displayName} (${model})\n`,
          'background:#450a0a;color:#f87171;font-weight:bold;padding:2px 6px;border-radius:4px;',
          'color:#f87171;',
          err
        );
        const raw = `${err?.name || 'Error'}: ${err?.message || err}`;
        let friendly;
        if (/local_files_only=true|file was not found locally|missing locally/i.test(raw)) {
          friendly =
            `Bundled files for ${displayName} are missing or incomplete. ` +
            `Rebuild the app and make sure /public/models contains that model.`;
        } else if (/Unexpected token '<'|<!doctype|not valid JSON/i.test(raw)) {
          friendly =
            `${displayName} received app HTML instead of model JSON. ` +
            `Hard-refresh or restart the dev server so the latest loader is used.`;
        } else if (/404|not found|Could not find/i.test(raw)) {
          friendly = `Model "${model}" was not found on Hugging Face.`;
        } else if (/constructors are unavailable|cached site data/i.test(raw)) {
          friendly =
            `${displayName} assets are out of sync. Clear site data or hard-refresh, then retry.`;
        } else if (/Unsupported model type:\s*idefics3/i.test(raw)) {
          friendly =
            `${displayName} hit an incompatible auto-loader path for SmolVLM. ` +
            `Hard-refresh or restart the app and retry.`;
        } else if (/network|fetch|abort|timeout/i.test(raw)) {
          friendly =
            model === MODELS.CAPTION.id
              ? `Network error while downloading ${displayName}. ` +
                `The app also tried the smaller ${MODELS.CAPTION_TINY.shortName} fallback. ` +
                `Check your connection on first load, then retry.`
              : `Network error while downloading ${displayName}. ` +
                `Check your connection on first load.`;
        } else if (/memory|allocation|RuntimeError|wasm/i.test(raw)) {
          friendly =
            model === MODELS.CAPTION.id
              ? `Not enough memory to load ${displayName}. ` +
                `The app will work best with the smaller ${MODELS.CAPTION_TINY.shortName} fallback; ` +
                `close other tabs and retry.`
              : `Not enough memory to load ${displayName}. Close other tabs and retry, ` +
                `or switch to a smaller VLM (CAPTION_TINY).`;
        } else {
          friendly = `Could not load ${displayName}. ${err?.message || ''}`;
        }
        const wrapped = new Error(friendly);
        wrapped.cause = err;
        throw wrapped;
      }
    },
    [setLoader, clearLoader, state.prefs.backend]
  );

  return { loadPipeline, loadVLM };
}

function stableStringify(v) {
  if (v == null) return 'auto';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, Object.keys(v).sort());
  } catch (_) {
    return String(v);
  }
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

function buildVlmCtorPairs(tjs, modelId) {
  const genericPairs = [
    {
      processorCtor: tjs.AutoProcessor,
      modelCtor: tjs.AutoModelForImageTextToText,
    },
    {
      processorCtor: tjs.AutoProcessor,
      modelCtor: tjs.AutoModelForVision2Seq,
    },
  ];

  const smolPairs = /SmolVLM/i.test(modelId)
    ? [
        {
          processorCtor: tjs.SmolVLMProcessor,
          modelCtor: tjs.SmolVLMForConditionalGeneration,
        },
        {
          processorCtor: tjs.Idefics3Processor,
          modelCtor: tjs.Idefics3ForConditionalGeneration,
        },
        ...genericPairs,
      ]
    : genericPairs;

  const seen = new Set();
  return smolPairs.filter(({ processorCtor, modelCtor }) => {
    if (
      typeof processorCtor?.from_pretrained !== 'function' ||
      typeof modelCtor?.from_pretrained !== 'function'
    ) {
      return false;
    }
    const key = `${processorCtor.name}::${modelCtor.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
