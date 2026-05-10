import React, { useState } from 'react';
import { TextInput } from './TextInput.jsx';
import { SimplifiedOutput } from './SimplifiedOutput.jsx';
import { FollowUp } from './FollowUp.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { MODELS } from '../../config/models.js';

// distilbart-cnn-6-6 (Apache 2.0, ~150 MB) running the `summarization`
// pipeline. Why this combo over the alternatives:
//   1. BART architecture, NOT T5 — sidesteps the well-known
//      "t.getValue is not a function" bug in transformers.js v3 that hits
//      every T5/flan-t5 model during inference.
//   2. distilbart-cnn-6-6 is the canonical summarization example in
//      transformers.js v3 — actively maintained, version-tested.
//   3. Summarization models naturally produce shorter, simpler output
//      than the input. That maps directly to "rewrite at 5th-grade level."
//   4. Apache 2.0 — truly open source.
//
// Other open-source options if you want chat-style or longer outputs:
//   - 'Xenova/distilbart-xsum-12-6'             (Apache 2.0, more abstractive)
//   - 'Xenova/Qwen2.5-0.5B-Instruct'            (Apache 2.0, ~350MB, chat)
//   - 'HuggingFaceTB/SmolLM2-360M-Instruct'     (Apache 2.0, ~200MB, chat)
//   - 'onnx-community/Qwen2.5-1.5B-Instruct'    (Apache 2.0, ~1GB, WebGPU)
const LLM = MODELS.SUMMARIZE.id;
const TASK = MODELS.SUMMARIZE.task;

export function SimplifyMode() {
  const { setMode, remember, state } = useApp();
  const { loadPipeline } = useModelLoader();
  const [original, setOriginal] = useState('');
  const [simplified, setSimplified] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Run the summarization pipeline. The `summarization` task in
  // transformers.js v3 takes the input text directly (no chat template, no
  // prompt prefix) and returns a `summary_text` field. We tune length to
  // keep output meaningfully shorter than the input but still complete.
  const summarize = async (text, maxLen = 130, minLen = 30) => {
    const pipe = await loadPipeline(TASK, LLM);
    const out = await pipe(text, {
      max_new_tokens: maxLen,
      min_new_tokens: minLen,
    });
    const item = Array.isArray(out) ? out[0] : out;
    return String(item?.summary_text || item?.generated_text || '').trim();
  };

  const onSimplify = async (text) => {
    setError(null);
    setOriginal(text);
    setSimplified('');
    setBusy(true);
    try {
      // Length budget scales with input — short inputs get short outputs.
      const wordCount = text.trim().split(/\s+/).length;
      const maxLen = Math.max(40, Math.min(200, Math.round(wordCount * 0.6)));
      const minLen = Math.max(15, Math.round(maxLen * 0.4));
      const result = await summarize(text, maxLen, minLen);
      setSimplified(result);
      remember({ lastSimplified: result });
    } catch (e) {
      setError(
        (e?.message || 'Could not simplify the text.') +
          (e?.cause?.message ? `\n\nDetails: ${e.cause.message}` : '')
      );
    } finally {
      setBusy(false);
    }
  };

  // Follow-up: prepend the question to the simplified passage and ask the
  // model to summarize the combined text. distilbart will produce a
  // sentence or two that's strongly conditioned on the question wording —
  // imperfect, but reliable, and avoids needing a second model.
  const onAsk = async (question) => {
    if (!simplified) return '';
    try {
      const conditioned = `Question: ${question}\n\nPassage: ${simplified}`;
      return await summarize(conditioned, 80, 20);
    } catch (e) {
      return 'Sorry, I could not answer that.';
    }
  };

  return (
    <main className="px-4 sm:px-6 py-5 mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMode('home')}
          className="tap-target text-purple-700 font-medium px-2 rounded-lg hover:bg-purple-700/10"
          aria-label="Back to mode selection"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-ink">Simplify</h1>
        <span aria-hidden="true" className="text-2xl">📖</span>
      </div>

      <p className="text-base text-gray-700 mb-4">
        Paste any complex text — medical instructions, a legal notice, a
        government form. AccessibleAID rewrites it in plain language using an
        on-device language model.
      </p>

      {(state.memory.lastOcrText || state.memory.lastSceneDescription) && (
        <div className="mb-4 bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <div className="text-sm font-semibold text-ink mb-2">
            From Sight Assistant
          </div>
          <div className="flex flex-wrap gap-2">
            {state.memory.lastOcrText && (
              <button
                onClick={() => onSimplify(state.memory.lastOcrText)}
                disabled={busy}
                className="tap-target bg-primary text-white px-4 rounded-xl font-medium disabled:opacity-50"
                aria-label="Simplify last OCR text from Sight"
              >
                Simplify last scanned text
              </button>
            )}
            {state.memory.lastSceneDescription && (
              <button
                onClick={() => onSimplify(state.memory.lastSceneDescription)}
                disabled={busy}
                className="tap-target bg-surface border border-primary text-primary px-4 rounded-xl font-medium disabled:opacity-50"
                aria-label="Simplify last scene description"
              >
                Simplify last scene
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <TextInput onSubmit={onSimplify} busy={busy} />
        {error && (
          <div className="text-danger bg-danger/10 border border-danger/30 rounded-lg p-3 whitespace-pre-wrap">
            {error}
          </div>
        )}
        {(busy || simplified) && (
          <SimplifiedOutput
            original={original}
            simplified={simplified}
            loading={busy}
          />
        )}
        {simplified && <FollowUp onAsk={onAsk} />}
      </div>
    </main>
  );
}
