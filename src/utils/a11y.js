// Tiny accessibility helpers used across the app.

/** Lazily create (or reuse) an aria-live region attached to <body>. */
function ensureLiveRegion(politeness = 'polite') {
  const id = `a11y-live-${politeness}`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Push a message into the live region so assistive tech announces it.
 * The text is briefly cleared first so identical consecutive messages
 * are still read aloud.
 */
export function announce(text, politeness = 'polite') {
  if (!text || typeof document === 'undefined') return;
  const el = ensureLiveRegion(politeness);
  el.textContent = '';
  // Defer to ensure the AT picks up the change.
  setTimeout(() => {
    el.textContent = text;
  }, 30);
}

/** Move keyboard focus to a node by ref, querySelector, or element. */
export function focusElement(target) {
  if (!target) return;
  const node =
    typeof target === 'string'
      ? document.querySelector(target)
      : target.current || target;
  if (node && typeof node.focus === 'function') {
    node.focus({ preventScroll: false });
  }
}

/** Trap focus inside a modal node (called on key handler). */
export function focusTrap(containerEl, e) {
  if (!containerEl || e.key !== 'Tab') return;
  const focusables = containerEl.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Format a 0–1 confidence as a friendly percentage string. */
export function fmtConfidence(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  return `${Math.round(score * 100)}%`;
}
