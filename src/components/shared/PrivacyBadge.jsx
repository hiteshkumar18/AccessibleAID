import React from 'react';
import { useLumyn } from '../../context/LumynContext.jsx';

export function PrivacyBadge({ variant = 'default', className = '' }) {
  const { state } = useLumyn();
  const mode = state.privacy.lastProcessingMode;
  const isOffline = !state.online;

  if (variant === 'camera') {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <span className="privacy-badge">
          On-Device AI Active
        </span>
        {isOffline && (
          <span className="privacy-badge privacy-badge-offline">
            Offline Mode
          </span>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span className={`privacy-badge ${className}`}>
        {isOffline ? 'Offline AI Running' : 'Processed Locally'}
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <span className="privacy-badge">On-Device AI Active</span>
        <span className="privacy-badge">No Cloud Upload</span>
        {isOffline && <span className="privacy-badge privacy-badge-offline">Offline Mode</span>}
        <span className="privacy-badge">Private Processing Enabled</span>
      </div>
    );
  }

  return (
    <span className={`privacy-badge ${className}`}>
      {mode === 'offline' || isOffline
        ? 'Offline AI Running'
        : mode === 'on-device'
        ? 'Processed Locally'
        : 'On-Device AI'}
    </span>
  );
}

export function ProcessingIndicator({ label = 'Processing on device…', className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-[#059669] text-sm font-medium ${className}`}>
      <span className="inline-block w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
      {label}
    </div>
  );
}

export function ModelLoadingBadge({ modelName, progress = 0, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between text-xs text-[#475569]">
        <span>Loading {modelName}…</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}
