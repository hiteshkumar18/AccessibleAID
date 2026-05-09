// Canvas helpers for camera capture / model preprocessing.

/**
 * Capture a still frame from a <video> element to a data URL (PNG).
 * Resizes the longest edge down to `maxEdge` for snappier inference.
 */
export function captureFrameToDataURL(videoEl, maxEdge = 640) {
  if (!videoEl || !videoEl.videoWidth) return null;
  const { videoWidth: w, videoHeight: h } = videoEl;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, cw, ch);
  return canvas.toDataURL('image/png');
}

/**
 * Read a File (image upload) as a data URL.
 */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize an image data URL to a max edge, returning a new data URL.
 * Useful before passing to the model.
 */
export function resizeDataURL(dataUrl, maxEdge = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const cw = Math.max(1, Math.round(img.width * scale));
      const ch = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
