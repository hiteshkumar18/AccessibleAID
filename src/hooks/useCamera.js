import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook that manages a webcam <video> stream and exposes:
 *   - videoRef:     attach to your <video>
 *   - start/stop:   manage the stream
 *   - error:        user-friendly error string (or null)
 *   - hasPermission: boolean once granted
 *   - supported:    whether getUserMedia is even available
 *
 * Cleans up on unmount.
 */
export function useCamera({ facingMode = 'environment' } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [active, setActive] = useState(false);

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia;

  const start = useCallback(async () => {
    if (!supported) {
      setError(
        'Camera not available in this browser. You can still upload an image instead.'
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setHasPermission(true);
      setActive(true);
      setError(null);
      return true;
    } catch (e) {
      const name = (e && e.name) || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(
          'Camera permission denied. You can upload an image instead, or grant camera access in your browser settings.'
        );
      } else if (name === 'NotFoundError') {
        setError(
          'No camera was found on this device. You can upload an image instead.'
        );
      } else {
        setError(
          'Could not start the camera. You can upload an image instead.'
        );
      }
      setActive(false);
      return false;
    }
  }, [facingMode, supported]);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, start, stop, error, hasPermission, active, supported };
}
