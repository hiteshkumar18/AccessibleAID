// Haptic feedback wrapper. Silently no-ops on devices without vibration
// (most desktops). Different patterns for different alert types so deafblind
// users can distinguish them.

const PATTERNS = {
  tap: [30],
  success: [40, 60, 40],
  warning: [80, 80, 80],
  alert: [120, 60, 120, 60, 220],
  sos: [200, 100, 200, 100, 200, 100, 600, 100, 600, 100, 600, 100, 200, 100, 200, 100, 200],
};

export function vibrate(kind = 'tap') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const pattern = PATTERNS[kind] || PATTERNS.tap;
  try {
    navigator.vibrate(pattern);
  } catch (_) {
    /* ignore */
  }
}

export const HAPTIC_KINDS = Object.keys(PATTERNS);
