import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { OfflineBadge } from '../shared/OfflineBadge.jsx';

export function Header() {
  const { openSettings, openHow, setMode, state } = useApp();
  return (
    <header
      className="bg-surface border-b border-gray-200 sticky top-0 z-30"
      role="banner"
    >
      <div className="mx-auto max-w-2xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <button
          onClick={() => setMode('home')}
          className="tap-target flex items-center gap-2 font-bold text-ink text-xl rounded-lg px-2 hover:bg-gray-100"
          aria-label="AccessibleAID home"
        >
          <span aria-hidden="true" className="text-2xl">🤝</span>
          <span>AccessibleAID</span>
        </button>
        <div className="flex items-center gap-2">
          <OfflineBadge online={state.online} />
          <button
            onClick={openHow}
            className="tap-target px-3 rounded-lg text-ink hover:bg-gray-100"
            aria-label="How AccessibleAID works"
            title="How it works"
          >
            <span aria-hidden="true">ℹ️</span>
            <span className="sr-only">How it works</span>
          </button>
          <button
            onClick={openSettings}
            className="tap-target px-3 rounded-lg text-ink hover:bg-gray-100"
            aria-label="Settings"
            title="Settings"
          >
            <span aria-hidden="true">⚙️</span>
            <span className="sr-only">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
