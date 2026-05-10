import { useCallback, useEffect, useRef, useState } from 'react';
import { MODELS } from '../config/models.js';

/**
 * useSignLanguage — real-time ASL recognition via MediaPipe Tasks.
 *
 * Pipeline:
 *   1. GestureRecognizer  → detects 7 high-accuracy named gestures
 *      (Open_Palm, Closed_Fist, Thumb_Up, Thumb_Down, Pointing_Up, Victory, ILoveYou)
 *   2. HandLandmarker     → 21 3-D landmarks → feature extraction → letter classifier
 *      Covers all static ASL letters (A-Z minus J/Z which need motion).
 *
 * The gesture recognizer wins when confidence ≥ 0.60.
 * The landmark classifier runs as a fallback and for fingerspelling.
 */

// ─── MediaPipe gesture → phrase ─────────────────────────────────────────────
const GESTURE_MAP = {
  Open_Palm:    { phrase: 'Hello',     sign: '👋',  description: 'Open palm — Hello' },
  Closed_Fist:  { phrase: 'Yes',       sign: '✊',  description: 'Closed fist — Yes' },
  Thumb_Up:     { phrase: 'Good / Yes',sign: '👍',  description: 'Thumbs up — Good' },
  Thumb_Down:   { phrase: 'No / Bad',  sign: '👎',  description: 'Thumbs down — No' },
  Pointing_Up:  { phrase: 'Stop',      sign: '☝️', description: 'One finger up — Stop' },
  Victory:      { phrase: 'Peace / V', sign: '✌️', description: 'Peace sign — V' },
  ILoveYou:     { phrase: 'I Love You',sign: '🤟',  description: 'ILY — thumb + index + pinky' },
};

// ─── ASL letter → display ────────────────────────────────────────────────────
const LETTER_MAP = {
  A:   { phrase: 'A',           sign: '🤛', description: 'Closed fist, thumb to side' },
  B:   { phrase: 'B',           sign: '🖐', description: 'Four fingers up, thumb folded' },
  C:   { phrase: 'C',           sign: '🤏', description: 'Curved hand — C shape' },
  D:   { phrase: 'D',           sign: '☝️',description: 'Index up, others curl to thumb' },
  E:   { phrase: 'E',           sign: '✊', description: 'All fingers hooked, thumb under' },
  F:   { phrase: 'F',           sign: '👌', description: 'Index+thumb circle, 3 fingers up' },
  G:   { phrase: 'G',           sign: '👉', description: 'Index + thumb horizontal' },
  H:   { phrase: 'H',           sign: '✌️',description: 'Index + middle horizontal' },
  I:   { phrase: 'I',           sign: '🤙', description: 'Pinky extended alone' },
  K:   { phrase: 'K',           sign: '✌️',description: 'Index + middle up, thumb between' },
  L:   { phrase: 'L / Help',    sign: '🖖', description: 'Index + thumb out — L shape' },
  M:   { phrase: 'M',           sign: '✊', description: 'Three fingers over thumb' },
  N:   { phrase: 'N',           sign: '✊', description: 'Two fingers over thumb' },
  O:   { phrase: 'O',           sign: '👌', description: 'All fingers form circle with thumb' },
  P:   { phrase: 'P',           sign: '✌️',description: 'K shape pointing down' },
  Q:   { phrase: 'Q',           sign: '👇', description: 'G shape pointing down' },
  R:   { phrase: 'R',           sign: '🤞', description: 'Index + middle crossed' },
  S:   { phrase: 'S',           sign: '✊', description: 'Closed fist, thumb over fingers' },
  T:   { phrase: 'T',           sign: '👊', description: 'Thumb between index + middle' },
  U:   { phrase: 'U',           sign: '✌️',description: 'Index + middle up together' },
  V:   { phrase: 'V / Please',  sign: '✌️',description: 'Two fingers spread — Peace' },
  W:   { phrase: 'W',           sign: '🖐', description: 'Three fingers spread up' },
  X:   { phrase: 'X',           sign: '☝️',description: 'Index finger hooked' },
  Y:   { phrase: 'Y / Yes',     sign: '🤙', description: 'Thumb + pinky out' },
};

// ─── Feature extraction from 21 MediaPipe hand landmarks ────────────────────
//
// Landmark indices (MediaPipe convention):
//   0: wrist
//   1-4:  thumb  (cmc, mcp, ip, tip)
//   5-8:  index  (mcp, pip, dip, tip)
//   9-12: middle (mcp, pip, dip, tip)
//  13-16: ring   (mcp, pip, dip, tip)
//  17-20: pinky  (mcp, pip, dip, tip)
//
// Coordinate system: x,y ∈ [0,1] (image-relative), y increases downward.

function d3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function extractFeatures(lm) {
  if (!lm || lm.length < 21) return null;

  // Scale: wrist → middle MCP distance
  const scale = d3(lm[0], lm[9]) || 0.01;

  // Finger extension: tip is ABOVE pip in screen coords → tip.y < pip.y
  const idxExt  = lm[8].y  < lm[6].y;
  const midExt  = lm[12].y < lm[10].y;
  const rngExt  = lm[16].y < lm[14].y;
  const pkyExt  = lm[20].y < lm[18].y;

  // Thumb: extended when tip is far from the palm (wrist-relative lateral distance)
  const thumbExt = d3(lm[4], lm[9]) > d3(lm[2], lm[9]) * 1.1;

  // How far curled is each finger? (ratio tip-to-mcp vs pip-to-mcp)
  // 0 = extended, 1 = fully curled
  const idxCurl  = Math.min(1, d3(lm[8], lm[5]) / (d3(lm[6], lm[5]) + 0.001));
  const midCurl  = Math.min(1, d3(lm[12], lm[9]) / (d3(lm[10], lm[9]) + 0.001));

  // Normalised fingertip distances
  const th2id = d3(lm[4], lm[8])  / scale;
  const th2mi = d3(lm[4], lm[12]) / scale;
  const th2rn = d3(lm[4], lm[16]) / scale;
  const th2pk = d3(lm[4], lm[20]) / scale;
  const id2mi = d3(lm[8], lm[12]) / scale;
  const mi2rn = d3(lm[12], lm[16]) / scale;

  // Is index pointing sideways (horizontal)?
  const idxHoriz = Math.abs(lm[8].x - lm[5].x) > Math.abs(lm[8].y - lm[5].y);
  const idHorizMid = idxHoriz && Math.abs(lm[12].x - lm[9].x) > Math.abs(lm[12].y - lm[9].y);

  // Are index + middle crossed?
  const crossed = idxExt && midExt && Math.abs(lm[8].x - lm[12].x) < 0.04;

  // Thumb tip touching index pip (for T, N, M)
  const thAtIdxPIP = d3(lm[4], lm[6]) / scale < 0.30;

  const extCount = [idxExt, midExt, rngExt, pkyExt].filter(Boolean).length;

  return {
    thumbExt, idxExt, midExt, rngExt, pkyExt, extCount,
    th2id, th2mi, th2rn, th2pk, id2mi, mi2rn,
    idxCurl, midCurl,
    idxHoriz, idHorizMid, crossed,
    thAtIdxPIP,
  };
}

// Touch threshold (normalised by hand scale)
const TOUCH = 0.30;

/**
 * Classify 21 MediaPipe hand landmarks into a static ASL letter.
 * Returns { letter, conf } or null.
 */
function classifyASL(lm) {
  const f = extractFeatures(lm);
  if (!f) return null;

  const {
    thumbExt, idxExt, midExt, rngExt, pkyExt, extCount,
    th2id, th2mi, th2rn, th2pk, id2mi, mi2rn,
    idxHoriz, idHorizMid, crossed,
    thAtIdxPIP,
  } = f;

  // ── 0 fingers extended (all curled) ──────────────────────────────────────
  if (extCount === 0) {
    // A: thumb to side
    if (thumbExt) return { letter: 'A', conf: 0.78 };
    // E: fingertips very close to thumb (hooked)
    if (th2id < TOUCH * 0.9 && th2mi < TOUCH * 1.1) return { letter: 'E', conf: 0.68 };
    // T: thumb between index and middle PIP
    if (thAtIdxPIP) return { letter: 'T', conf: 0.68 };
    // S: closed fist, thumb over fingers
    return { letter: 'S', conf: 0.68 };
  }

  // ── 4 fingers extended ───────────────────────────────────────────────────
  if (extCount === 4) {
    // Open palm / B: thumb determines
    if (thumbExt) return { letter: 'Open_Palm', conf: 0.85 }; // handled by gesture recognizer too
    return { letter: 'B', conf: 0.82 };
  }

  // ── 1 finger extended ────────────────────────────────────────────────────
  if (extCount === 1) {
    if (idxExt) {
      // L: index + thumb out
      if (thumbExt) return { letter: 'L', conf: 0.88 };
      // G: index horizontal
      if (idxHoriz && !thumbExt) return { letter: 'G', conf: 0.72 };
      // X: index hooked (partial extension)
      if (f.idxCurl > 0.55 && f.idxCurl < 0.80) return { letter: 'X', conf: 0.65 };
      // D: index fully extended up
      return { letter: 'D', conf: 0.72 };
    }
    if (pkyExt) {
      // Y: thumb + pinky
      if (thumbExt) return { letter: 'Y', conf: 0.88 };
      // I: pinky alone
      return { letter: 'I', conf: 0.82 };
    }
    // Middle only (rare in standard ASL)
    if (midExt) return { letter: 'D', conf: 0.50 };
  }

  // ── 2 fingers extended ───────────────────────────────────────────────────
  if (extCount === 2) {
    if (idxExt && midExt) {
      // H: both horizontal and parallel
      if (idHorizMid) return { letter: 'H', conf: 0.74 };
      // R: index + middle crossed
      if (crossed) return { letter: 'R', conf: 0.72 };
      // K: thumb between them
      if (thumbExt && th2id < TOUCH * 1.2) return { letter: 'K', conf: 0.72 };
      // U: tips very close together
      if (id2mi < 0.22) return { letter: 'U', conf: 0.80 };
      // V: spread apart
      return { letter: 'V', conf: 0.82 };
    }
    if (idxExt && pkyExt) {
      // H variant or unusual shape — call as N
      return { letter: 'N', conf: 0.58 };
    }
    if (thumbExt && idxExt) return { letter: 'L', conf: 0.85 };
    if (thumbExt && pkyExt) return { letter: 'Y', conf: 0.85 };
  }

  // ── 3 fingers extended ───────────────────────────────────────────────────
  if (extCount === 3) {
    if (idxExt && midExt && rngExt) {
      // W: three fingers spread
      if (id2mi > 0.18 && mi2rn > 0.18) return { letter: 'W', conf: 0.78 };
      // M: three fingers over thumb (curled-ish tips)
      if (th2id < TOUCH * 1.2) return { letter: 'M', conf: 0.68 };
      return { letter: 'W', conf: 0.68 };
    }
    if (idxExt && midExt && pkyExt) {
      // F: index+middle+pinky up, ring curled, thumb+index touch
      if (th2id < TOUCH) return { letter: 'F', conf: 0.72 };
      return { letter: 'W', conf: 0.60 };
    }
  }

  // ── Pinch / O / C ─────────────────────────────────────────────────────────
  // These are harder to detect by extension alone — use tip proximity
  if (th2id < TOUCH && extCount <= 1) {
    // All fingertips curving toward thumb = O
    if (th2mi < TOUCH * 1.3 && th2rn < TOUCH * 1.5) return { letter: 'O', conf: 0.72 };
    // F: pinky extended, rest curl to thumb
    if (pkyExt) return { letter: 'F', conf: 0.70 };
    return { letter: 'O', conf: 0.65 };
  }

  // C: curved hand — none extended but not closed fist
  if (extCount === 0 && th2id > TOUCH && th2id < TOUCH * 2.5) {
    return { letter: 'C', conf: 0.62 };
  }

  // P: K shape pointing downward (index + middle angled down)
  if (extCount === 2 && idxExt && midExt && thumbExt) {
    if (lm[8].y > lm[5].y + 0.03) return { letter: 'P', conf: 0.65 };
    return { letter: 'K', conf: 0.68 };
  }

  // Q: G pointing down
  if (extCount === 1 && idxExt && thumbExt && lm[8].y > lm[5].y) {
    return { letter: 'Q', conf: 0.65 };
  }

  return null;
}

// ─── MediaPipe loader ────────────────────────────────────────────────────────
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
  const fs = await FilesetResolver.forVisionTasks(MODELS.SIGN_GESTURE.runtimeUrl);

  const make = async (factory, url) => {
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: url, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    try { return await factory.createFromOptions(fs, opts('GPU')); }
    catch { return factory.createFromOptions(fs, opts('CPU')); }
  };

  const [gestureRecognizer, handLandmarker] = await Promise.all([
    make(GestureRecognizer, MODELS.SIGN_GESTURE.assetUrl),
    make(HandLandmarker,    MODELS.SIGN_LANDMARKS.assetUrl),
  ]);

  recognizersCache = { gestureRecognizer, handLandmarker };
  return recognizersCache;
}

// ─── Detection ───────────────────────────────────────────────────────────────
function detectSign(recs, videoEl, ts = performance.now()) {
  // 1. Gesture recognizer — high accuracy for its 7 categories
  const gestureOut  = recs.gestureRecognizer.recognizeForVideo(videoEl, ts);
  const topGesture  = gestureOut?.gestures?.[0]?.[0];
  if (topGesture && topGesture.score >= 0.60 && topGesture.categoryName !== 'None') {
    const mapped = GESTURE_MAP[topGesture.categoryName];
    if (mapped) return { ...mapped, score: topGesture.score, source: 'gesture' };
  }

  // 2. Hand landmarker → feature-based ASL classifier
  const landmarkOut = recs.handLandmarker.detectForVideo(videoEl, ts);
  const lm          = landmarkOut?.landmarks?.[0];
  if (lm && lm.length === 21) {
    const cls = classifyASL(lm);
    if (cls && cls.conf >= 0.62) {
      // Letter maps to display entry
      const entry = LETTER_MAP[cls.letter];
      if (entry) return { ...entry, score: cls.conf, source: 'fingerspell', letter: cls.letter };
    }
  }

  return null;
}

function waitForVideo(el) {
  if (el?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && el.videoWidth > 0)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    const onReady = () => finish(el.videoWidth > 0);
    el.addEventListener('loadeddata', onReady, { once: true });
    el.addEventListener('playing',    onReady, { once: true });
    setTimeout(() => finish(el.videoWidth > 0), 2500);
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSignLanguage({ onResult } = {}) {
  const recognizersRef    = useRef(null);
  const videoRef          = useRef(null);
  const onResultRef       = useRef(onResult);
  const runningRef        = useRef(false);
  const rafRef            = useRef(null);
  const lastVideoTimeRef  = useRef(-1);

  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState(null);
  const [last,    setLast]    = useState(null);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const bind = useCallback((node) => { videoRef.current = node; }, []);

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
      setError('Could not load the sign-language model. Check your connection.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    lastVideoTimeRef.current = -1;
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const el   = videoRef.current;
    const recs = recognizersRef.current;
    if (
      recs && el?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      el.videoWidth > 0 && el.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = el.currentTime;
      const result = detectSign(recs, el);
      if (result) { setLast(result); onResultRef.current?.(result); }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current) {
      setError('Camera preview not ready. Try again in a moment.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureLoaded();
      const ok = await waitForVideo(videoRef.current);
      if (!ok) { setError('Camera frame not ready.'); return false; }
      if (!runningRef.current) {
        runningRef.current = true;
        rafRef.current = requestAnimationFrame(tick);
      }
      return true;
    } catch (e) {
      setError(e?.message || 'Recognition failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureLoaded, tick]);

  const captureSign = useCallback(async (videoElement) => {
    if (!videoElement || videoElement.readyState < 2) {
      setError('Camera not ready.');
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const recs = await ensureLoaded();
      await waitForVideo(videoElement);
      const result = detectSign(recs, videoElement);
      setLast(result ?? {
        phrase: 'No sign detected', sign: '❓',
        description: 'Show your hand clearly and try again.', score: 0, source: 'none',
      });
      return result;
    } catch (e) {
      setError(e?.message || 'Recognition failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [ensureLoaded]);

  useEffect(() => stop, [stop]);

  return { bind, start, stop, captureSign, busy, ready, loading, error, last };
}
