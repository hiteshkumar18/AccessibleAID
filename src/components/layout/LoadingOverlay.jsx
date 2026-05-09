import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

/**
 * Floating progress card that summarizes any in-flight model downloads.
 * Shows per-file detail so a user staring at a "stuck" bar can see
 * which ONNX shard is actually downloading.
 */
export function LoadingOverlay() {
  const { state } = useApp();
  const entries = Object.entries(state.loaders || {});
  if (!entries.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-40 max-w-md"
      role="status"
      aria-live="polite"
    >
      <div className="bg-surface border border-gray-200 rounded-2xl shadow-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse-soft"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-ink">
            Loading on-device AI
          </h2>
        </div>
        <ul className="space-y-3">
          {entries.map(([key, v]) => (
            <li key={key}>
              <div className="text-sm text-gray-700 mb-1">
                {v.label || 'Loading model…'}
              </div>
              <div
                className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={v.progress || 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={v.label || 'Model download progress'}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${v.progress || 0}%` }}
                />
              </div>
              {v.detail && (
                <pre className="mt-1 text-[11px] leading-snug text-gray-500 whitespace-pre-wrap font-mono">
                  {v.detail}
                </pre>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          This download happens once. After this, AccessibleAID works
          offline. If a file stalls, refresh the page — the bytes already
          downloaded are cached.
        </p>
      </div>
    </div>
  );
}
