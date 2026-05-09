import React from 'react';

export function OfflineBadge({ online }) {
  // We always emphasize "Works Offline" because models persist locally
  // — but flip the dot color based on real network state.
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1 border ${
        online
          ? 'bg-success/10 text-success border-success/30'
          : 'bg-success/15 text-success border-success/50'
      }`}
      role="status"
      aria-live="polite"
      title={
        online
          ? 'You are online. Models cache for offline use.'
          : 'You are offline. AccessibleAID still works.'
      }
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          online ? 'bg-success' : 'bg-success animate-pulse-soft'
        }`}
        aria-hidden="true"
      />
      {online ? 'Works Offline' : 'Offline ✓'}
    </span>
  );
}
