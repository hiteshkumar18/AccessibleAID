import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput } from './TextInput.jsx';
import { SimplifiedOutput } from './SimplifiedOutput.jsx';
import { FollowUp } from './FollowUp.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useModelLoader } from '../../hooks/useModelLoader.js';
import { ModelLoadingBadge } from '../shared/PrivacyBadge.jsx';
import { PrivacyBadge } from '../shared/PrivacyBadge.jsx';
import { MODELS } from '../../config/models.js';

const LLM = MODELS.SUMMARIZE.id;
const TASK = MODELS.SUMMARIZE.task;

export function SimplifyMode() {
  const navigate = useNavigate();
  const { remember, state } = useApp();
  const { loadPipeline } = useModelLoader();
  const [original, setOriginal] = useState('');
  const [simplified, setSimplified] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loaderEntry = Object.values(state.loaders).find((v) => v?.label?.toLowerCase().includes('simplif'));

  const summarize = async (text, maxLen = 130, minLen = 30) => {
    const pipe = await loadPipeline(TASK, LLM);
    const out = await pipe(text, { max_new_tokens: maxLen, min_new_tokens: minLen });
    const item = Array.isArray(out) ? out[0] : out;
    return String(item?.summary_text || item?.generated_text || '').trim();
  };

  const onSimplify = async (text) => {
    setError(null);
    setOriginal(text);
    setSimplified('');
    setBusy(true);
    try {
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

  const onAsk = async (question) => {
    if (!simplified) return '';
    try {
      const conditioned = `Question: ${question}\n\nPassage: ${simplified}`;
      return await summarize(conditioned, 80, 20);
    } catch (_) {
      return 'Sorry, I could not answer that.';
    }
  };

  return (
    <main className="px-4 sm:px-6 py-5 mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/home')}
          className="tap-target text-purple-700 font-medium px-2 rounded-lg hover:bg-purple-700/10"
          aria-label="Back to home"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-ink">Simplify Info</h1>
        <PrivacyBadge variant="compact" />
      </div>

      <p className="text-base text-gray-700 mb-4">
        Paste any complex text — medical instructions, a legal notice, a
        government form. The AI rewrites it in plain language, fully on-device.
      </p>

      {busy && loaderEntry && (
        <ModelLoadingBadge modelName="DistilBART (Text Simplifier)" progress={loaderEntry.progress ?? 0} />
      )}

      {(state.memory.lastOcrText || state.memory.lastSceneDescription) && (
        <div className="mb-4 bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <div className="text-sm font-semibold text-ink mb-2">Use from AI memory</div>
          <div className="flex flex-wrap gap-2">
            {state.memory.lastOcrText && (
              <button
                onClick={() => onSimplify(state.memory.lastOcrText)}
                disabled={busy}
                className="tap-target bg-primary text-white px-4 py-2 rounded-xl font-medium disabled:opacity-50 text-sm"
              >
                Simplify last scanned text
              </button>
            )}
            {state.memory.lastSceneDescription && (
              <button
                onClick={() => onSimplify(state.memory.lastSceneDescription)}
                disabled={busy}
                className="tap-target bg-white border border-primary text-primary px-4 py-2 rounded-xl font-medium disabled:opacity-50 text-sm"
              >
                Simplify last scene description
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <TextInput onSubmit={onSimplify} busy={busy} />
        {error && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap text-sm">
            {error}
          </div>
        )}
        {(busy || simplified) && (
          <SimplifiedOutput original={original} simplified={simplified} loading={busy} />
        )}
        {simplified && <FollowUp onAsk={onAsk} />}
      </div>
    </main>
  );
}
