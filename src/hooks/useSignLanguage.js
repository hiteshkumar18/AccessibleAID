import { useCallback, useEffect, useRef, useState } from 'react';
import { MODELS } from '../config/models.js';

/**
 * useSignLanguage — live camera mode.
 *
 * The recognizer binds to a <video> element and runs continuously in a
 * requestAnimationFrame loop while translation is active.
 *
 * API:
 *   const { bind, start, stop, captureSign, busy, ready, loading, error, last } =
 *     useSignLanguage({ onResult });
 *
 *   captureSign(videoElement) → Promise<result | null>
 *     Grabs the current frame from the <video>, runs the gesture recognizer
 *     and hand-landmark kNN on it once, updates `last`, and returns the result.
 */

// ---------------------------------------------------------------------------
// Gesture → phrase mapping
// ---------------------------------------------------------------------------
const GESTURE_TO_PHRASE = {
  Open_Palm:   { phrase: 'Hello',     sign: '👋',  description: 'Open hand wave' },
  Closed_Fist: { phrase: 'Yes',       sign: '✊',  description: 'Fist nod up and down' },
  Thumb_Up:    { phrase: 'Yes',       sign: '👍',  description: 'Thumbs up — affirmative' },
  Thumb_Down:  { phrase: 'No',        sign: '👎',  description: 'Thumbs down — negative' },
  Pointing_Up: { phrase: 'Stop',      sign: '☝️', description: 'Pointing up — attention' },
  Victory:     { phrase: 'Please',    sign: '✌️', description: 'Two-finger victory' },
  ILoveYou:    { phrase: 'Thank you', sign: '🤟',  description: '"I love you" / thanks' },
};

// ---------------------------------------------------------------------------
// Fingerspelling kNN (21-point hand landmarks)
// ---------------------------------------------------------------------------
const FINGERSPELL_BANK = [
  { letter: 'A', sign: '✊',  description: 'A — closed fist (fingerspelling)',
    vec: flatten21([
      [0,0,0],[0.12,-0.05,0],[0.20,-0.12,0],[0.24,-0.20,0],[0.28,-0.28,0],
      [0.05,-0.35,0],[0.04,-0.50,0],[0.04,-0.42,0],[0.05,-0.34,0],
      [0,-0.38,0],[0,-0.55,0],[0,-0.45,0],[0,-0.36,0],
      [-0.05,-0.35,0],[-0.06,-0.50,0],[-0.05,-0.42,0],[-0.05,-0.34,0],
      [-0.10,-0.30,0],[-0.13,-0.42,0],[-0.12,-0.36,0],[-0.10,-0.30,0],
    ]) },
  { letter: 'B', sign: '🖐️', description: 'B — flat hand (fingerspelling)',
    vec: flatten21([
      [0,0,0],[0.10,-0.10,0],[0.16,-0.18,0],[0.18,-0.30,0],[0.14,-0.40,0],
      [0.08,-0.40,0],[0.08,-0.65,0],[0.08,-0.85,0],[0.08,-1.00,0],
      [0,-0.42,0],[0,-0.70,0],[0,-0.92,0],[0,-1.08,0],
      [-0.08,-0.40,0],[-0.08,-0.65,0],[-0.08,-0.85,0],[-0.08,-1.00,0],
      [-0.16,-0.36,0],[-0.16,-0.58,0],[-0.16,-0.78,0],[-0.16,-0.92,0],
    ]) },
  { letter: 'L', sign: '🖖', description: 'Help / L — thumb + index out',
    vec: flatten21([
      [0,0,0],[0.15,-0.05,0],[0.30,-0.10,0],[0.45,-0.12,0],[0.55,-0.12,0],
      [0.05,-0.35,0],[0.05,-0.65,0],[0.05,-0.90,0],[0.05,-1.10,0],
      [0,-0.40,0],[0,-0.45,0],[0,-0.42,0],[0,-0.38,0],
      [-0.05,-0.40,0],[-0.05,-0.42,0],[-0.05,-0.40,0],[-0.05,-0.36,0],
      [-0.10,-0.36,0],[-0.10,-0.40,0],[-0.10,-0.38,0],[-0.10,-0.34,0],
    ]) },
  { letter: 'V', sign: '✌️', description: 'Please / V — two fingers up',
    vec: flatten21([
      [0,0,0],[0.10,-0.05,0],[0.18,-0.10,0],[0.20,-0.18,0],[0.18,-0.25,0],
      [0.06,-0.40,0],[0.10,-0.65,0],[0.14,-0.90,0],[0.18,-1.10,0],
      [-0.02,-0.40,0],[-0.06,-0.65,0],[-0.10,-0.90,0],[-0.14,-1.10,0],
      [-0.10,-0.38,0],[-0.10,-0.42,0],[-0.10,-0.40,0],[-0.10,-0.36,0],
      [-0.16,-0.34,0],[-0.16,-0.38,0],[-0.16,-0.36,0],[-0.16,-0.32,0],
    ]) },
  { letter: 'Y', sign: '🤙', description: 'Y — thumb + pinky out',
    vec: flatten21([
      [0,0,0],[0.20,-0.05,0],[0.34,-0.05,0],[0.46,-0.05,0],[0.55,-0.05,0],
      [0.10,-0.35,0],[0.10,-0.45,0],[0.10,-0.40,0],[0.10,-0.35,0],
      [0,-0.38,0],[0,-0.45,0],[0,-0.40,0],[0,-0.35,0],
      [-0.10,-0.36,0],[-0.10,-0.42,0],[-0.10,-0.38,0],[-0.10,-0.32,0],
      [-0.20,-0.30,0],[-0.30,-0.45,0],[-0.36,-0.62,0],[-0.40,-0.78,0],
    ]) },
];

const LETTER_TO_PHRASE = {
  A: { phrase: 'A',      sign: '✊',  description: 'A — closed fist (fingerspelling)' },
  B: { phrase: 'B',      sign: '🖐️', description: 'B — flat hand (fingerspelling)' },
  L: { phrase: 'Help',   sign: '🖖', description: 'Help / L — thumb + index out' },
  V: { phrase: 'Please', sign: '✌️', description: 'Please / V — two fingers up' },
  Y: { phrase: 'Yes',    sign: '🤙',  description: 'Y — thumb + pinky out' },
};

const FINGERSPELL_THRESHOLD = 0.45;

function flatten21(points) {
  const out = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    out[i * 3]     = points[i][0];
    out[i * 3 + 1] = points[i][1];
    out[i * 3 + 2] = points[i][2];
  }
  return out;
}

function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== 21) return null;
  const wrist = landmarks[0];
  const mcp9  = landmarks[9];
  const span  =
    Math.hypot(mcp9.x - wrist.x, mcp9.y - wrist.y, (mcp9.z || 0) - (wrist.z || 0)) || 1e-6;
  const out = new Float32Array(63);
  for (let i = 0; i < 21; i++) {
    out[i * 3]     = (landmarks[i].x - wrist.x) / span;
    out[i * 3 + 1] = (landmarks[i].y - wrist.y) / span;
    out[i * 3 + 2] = ((landmarks[i].z || 0) - (wrist.z || 0)) / span;
  }
  return out;
}

function l2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

function classifyFingerspelling(landmarks) {
  const v = normalizeLandmarks(landmarks);
  if (!v) return null;
  let best = null, bestDist = Infinity;
  for (const ref of FINGERSPELL_BANK) {
    const d = l2(v, ref.vec);
    if (d < bestDist) { bestDist = d; best = ref; }
  }
  if (!best || bestDist > FINGERSPELL_THRESHOLD) return null;
  return { letter: best.letter, score: Math.max(0, 1 - bestDist / FINGERSPELL_THRESHOLD) };
}

// ---------------------------------------------------------------------------
// MediaPipe loader — VIDEO mode for live camera frames
// ---------------------------------------------------------------------------
let mpModulePromise = null;
async function loadMediaPipeModule() {
  if (mpModulePromise) return mpModulePromise;
  mpModulePromise = import(
    /* @vite-ignore */
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  );
  return mpModulePromise;
}

let recognizersCache = null;
async function getRecognizers() {
  if (recognizersCache) return recognizersCache;
  const { FilesetResolver, GestureRecognizer, HandLandmarker } = await loadMediaPipeModule();

  const filesetResolver = await FilesetResolver.forVisionTasks(MODELS.SIGN_GESTURE.runtimeUrl);

  const createWithFallback = async (factory, assetUrl) => {
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: assetUrl, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    try {
      return await factory.createFromOptions(filesetResolver, options('GPU'));
    } catch (_) {
      return factory.createFromOptions(filesetResolver, options('CPU'));
    }
  };

  const [gestureRecognizer, handLandmarker] = await Promise.all([
    createWithFallback(GestureRecognizer, MODELS.SIGN_GESTURE.assetUrl),
    createWithFallback(HandLandmarker, MODELS.SIGN_LANDMARKS.assetUrl),
  ]);

  recognizersCache = { gestureRecognizer, handLandmarker };
  return recognizersCache;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------
function readSignFromFrame(recs, videoElement, timestampMs = performance.now()) {
  let result = null;

  const gestureOut = recs.gestureRecognizer.recognizeForVideo(
    videoElement,
    timestampMs
  );
  const landmarkOut = recs.handLandmarker.detectForVideo(
    videoElement,
    timestampMs
  );

  const topGesture = gestureOut?.gestures?.[0]?.[0];
  if (topGesture && topGesture.score >= 0.5 && topGesture.categoryName !== 'None') {
    const phrase = GESTURE_TO_PHRASE[topGesture.categoryName];
    if (phrase) result = { ...phrase, score: topGesture.score, source: 'gesture' };
  }

  if (!result) {
    const lm = landmarkOut?.landmarks?.[0];
    if (lm && lm.length === 21) {
      const cls = classifyFingerspelling(lm);
      if (cls && LETTER_TO_PHRASE[cls.letter]) {
        result = { ...LETTER_TO_PHRASE[cls.letter], score: cls.score, source: 'fingerspell' };
      }
    }
  }

  return result;
}

function waitForVideo(videoElement) {
  if (
    videoElement?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    videoElement.videoWidth > 0
  ) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      videoElement.removeEventListener('loadeddata', onReady);
      videoElement.removeEventListener('playing', onReady);
      resolve(ok);
    };
    const onReady = () => finish(videoElement.videoWidth > 0);

    videoElement.addEventListener('loadeddata', onReady, { once: true });
    videoElement.addEventListener('playing', onReady, { once: true });
    setTimeout(() => finish(videoElement.videoWidth > 0), 2500);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSignLanguage({ onResult } = {}) {
  const recognizersRef = useRef(null);
  const videoRef = useRef(null);
  const onResultRef = useRef(onResult);
  const runningRef = useRef(false);
  const rafRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [last,    setLast]    = useState(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const bind = useCallback((node) => {
    videoRef.current = node;
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (recognizersRef.current) return recognizersRef.current;
    setLoading(true);
    setError(null);
    try {
      const r = await getRecognizers();
      recognizersRef.current = r;
      setReady(true);
      return r;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Lumyn] sign-language model load failed', e);
      setError(
        'Could not load the sign-language recognizer. ' +
        'Check your connection — it caches after first load.'
      );
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastVideoTimeRef.current = -1;
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    const videoElement = videoRef.current;
    const recs = recognizersRef.current;

    if (
      recs &&
      videoElement?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoElement.videoWidth > 0 &&
      videoElement.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = videoElement.currentTime;
      const result = readSignFromFrame(recs, videoElement);

      if (result) {
        setLast(result);
        onResultRef.current?.(result);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      setError('Camera preview is not ready yet. Try again in a moment.');
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      await ensureLoaded();
      const videoReady = await waitForVideo(videoElement);
      if (!videoReady) {
        setError('Camera frame is not ready yet. Try again in a moment.');
        return false;
      }

      if (!runningRef.current) {
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(tick);
      }

      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Lumyn] sign-language start failed', e);
      setError(e?.message || 'Recognition failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureLoaded, tick]);

  /**
   * captureSign(videoElement)
   *
   * Reads the current frame of the supplied <video> element, runs the
   * gesture recognizer and fingerspelling kNN on it once, and returns
   * the best match (or null if no hand was detected).
   */
  const captureSign = useCallback(async (videoElement) => {
    if (!videoElement || videoElement.readyState < 2) {
      setError('Camera is not ready yet. Try again in a moment.');
      return null;
    }

    setBusy(true);
    setError(null);

    try {
      const recs = await ensureLoaded();
      await waitForVideo(videoElement);
      const result = readSignFromFrame(recs, videoElement);

      if (result) {
        setLast(result);
      } else {
        // No hand or unrecognised gesture — give clear feedback.
        setLast({
          phrase:      'No sign detected',
          sign:        '❓',
          description: 'Make sure your hand is clearly visible and try again.',
          score:       0,
          source:      'none',
        });
      }

      return result;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Lumyn] captureSign error', e);
      setError(e?.message || 'Recognition failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [ensureLoaded]);

  useEffect(() => stop, [stop]);

  return { bind, start, stop, captureSign, busy, ready, loading, error, last };
}
