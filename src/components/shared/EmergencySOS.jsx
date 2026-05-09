import React, { useEffect, useRef, useState } from 'react';
import { announce, focusTrap } from '../../utils/a11y.js';
import { vibrate } from '../../utils/haptics.js';

const PHRASE = 'I need help. Please call 911.';

/**
 * Floating SOS button — always visible. When pressed:
 *   • Full-screen high-contrast emergency phrase
 *   • Vibrates a sustained SOS pattern
 *   • Flashes the screen
 *   • Offers a one-tap tel:911 link (US) and shows current location if granted
 */
export function EmergencySOS() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [coordError, setCoordError] = useState(null);
  const dialogRef = useRef(null);

  const trigger = () => {
    setOpen(true);
    vibrate('sos');
    announce(PHRASE, 'assertive');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) =>
          setCoords({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            acc: p.coords.accuracy,
          }),
        (err) => setCoordError(err?.message || 'Location unavailable'),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    } else {
      setCoordError('Geolocation not supported.');
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      focusTrap(dialogRef.current, e);
    };
    document.addEventListener('keydown', onKey);
    setTimeout(
      () => dialogRef.current?.querySelector('button')?.focus(),
      30
    );
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={trigger}
        className="fixed bottom-4 left-4 z-30 tap-target bg-danger text-white font-bold px-4 py-3 rounded-full shadow-lg border-2 border-white hover:opacity-90 focus:opacity-90"
        aria-label="Emergency SOS — show large help message"
      >
        <span aria-hidden="true" className="mr-1">🆘</span> SOS
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Emergency SOS"
          className="fixed inset-0 z-50 bg-danger flex items-center justify-center p-6 animate-flash"
        >
          <div ref={dialogRef} className="text-center max-w-3xl">
            <p
              className="text-white font-bold leading-tight"
              style={{ fontSize: '11vw' }}
            >
              {PHRASE}
            </p>
            <div className="mt-6 text-white/95 text-lg space-y-2">
              {coords ? (
                <p>
                  Location: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}{' '}
                  <span className="opacity-80">
                    (±{Math.round(coords.acc)} m)
                  </span>
                </p>
              ) : coordError ? (
                <p className="opacity-90">{coordError}</p>
              ) : (
                <p className="opacity-90">Getting location…</p>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <a
                href="tel:911"
                className="tap-target bg-white text-danger font-bold px-6 py-3 rounded-xl"
                aria-label="Call 911 now"
              >
                Call 911
              </a>
              {coords && (
                <a
                  href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tap-target bg-white/20 text-white font-medium px-4 py-3 rounded-xl"
                >
                  Open map
                </a>
              )}
              <button
                onClick={() => setOpen(false)}
                className="tap-target bg-white/20 text-white font-medium px-4 py-3 rounded-xl"
                aria-label="Close emergency screen"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
