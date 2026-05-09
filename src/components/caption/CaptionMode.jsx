import React from 'react';
import { LiveCaptions } from './LiveCaptions.jsx';
import { EmergencyPhrases } from './EmergencyPhrases.jsx';
import { SoundAlert } from './SoundAlert.jsx';
import { useApp } from '../../context/AppContext.jsx';

export function CaptionMode() {
  const { setMode } = useApp();
  return (
    <main className="px-4 sm:px-6 py-5 mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMode('home')}
          className="tap-target text-success font-medium px-2 rounded-lg hover:bg-success/10"
          aria-label="Back to mode selection"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-ink">Caption Companion</h1>
        <span aria-hidden="true" className="text-2xl">🎤</span>
      </div>

      <div className="space-y-5">
        <LiveCaptions />
        <SoundAlert />
        <EmergencyPhrases />
      </div>
    </main>
  );
}
