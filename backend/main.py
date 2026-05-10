"""
EnableCare AI Backend — Python FastAPI server.

Models (all PC-local, lazy-loaded on first request):
  VLM          vikhyatk/moondream2                      ~1.8 GB
  Detection    ultralytics YOLOv8l                      ~87  MB
  Speech       openai/whisper-large-v3-turbo             ~1.5 GB
  Sound        MIT/ast-finetuned-audioset-10-10-0.4593  ~340 MB
  OCR          EasyOCR                                  ~100 MB
  Summarizer   sshleifer/distilbart-cnn-12-6             ~306 MB
  Embeddings   all-MiniLM-L6-v2                          ~90  MB
  Depth        depth-anything/Depth-Anything-V2-Small-hf ~99  MB

Endpoints:
  GET  /api/health
  POST /api/infer/detect
  POST /api/infer/caption
  POST /api/infer/transcribe
  POST /api/infer/classify-audio
  POST /api/infer/embed
  POST /api/infer/summarize
  POST /api/infer/ocr
  POST /api/infer/depth
"""

import base64
import io
import os
import sys
import traceback
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# ─── Device selection ─────────────────────────────────────────────────────────
# Apple Silicon: use MPS for 2-4× speedup over CPU.
# NVIDIA GPU:   use CUDA if available.
# Fallback:     CPU.
def _pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

DEVICE = _pick_device()
print(f"[backend] Using device: {DEVICE}")

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="EnableCare AI Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Model caches (lazy-loaded) ───────────────────────────────────────────────
_moondream_model = None
_moondream_tokenizer = None
_yolo_model = None
_whisper_pipe = None
_ocr_reader = None
_summarizer_model = None
_summarizer_tokenizer = None
_embedder = None
_depth_model = None
_depth_processor = None

# ─── Image helpers ────────────────────────────────────────────────────────────
def _decode_image(data_url: str) -> Image.Image:
    """Decode a base64 data-URL or raw base64 string into a PIL Image."""
    if data_url.startswith("data:"):
        data_url = data_url.split(",", 1)[1]
    img_bytes = base64.b64decode(data_url)
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")

# ─── Model loaders ────────────────────────────────────────────────────────────

def _get_moondream():
    global _moondream_model, _moondream_tokenizer
    if _moondream_model is None:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        print("[backend] ⬇  Loading moondream2 VLM …")
        _moondream_tokenizer = AutoTokenizer.from_pretrained(
            "vikhyatk/moondream2", trust_remote_code=True
        )
        _moondream_model = AutoModelForCausalLM.from_pretrained(
            "vikhyatk/moondream2",
            trust_remote_code=True,
            torch_dtype=torch.float32,
        ).to(DEVICE)
        _moondream_model.eval()
        print("[backend] ✓  moondream2 ready")
    return _moondream_model, _moondream_tokenizer


def _get_yolo():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        print("[backend] ⬇  Loading YOLOv8l …")
        _yolo_model = YOLO("yolov8l.pt")
        print("[backend] ✓  YOLOv8l ready")
    return _yolo_model


def _get_whisper():
    global _whisper_pipe
    if _whisper_pipe is None:
        from transformers import pipeline
        print("[backend] ⬇  Loading whisper-large-v3-turbo …")
        dtype = torch.float16 if DEVICE != "cpu" else torch.float32
        _whisper_pipe = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-large-v3-turbo",
            torch_dtype=dtype,
            device=DEVICE,
        )
        print("[backend] ✓  Whisper ready")
    return _whisper_pipe


def _get_ocr():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        print("[backend] ⬇  Loading EasyOCR …")
        use_gpu = DEVICE != "cpu"
        _ocr_reader = easyocr.Reader(["en"], gpu=use_gpu)
        print("[backend] ✓  EasyOCR ready")
    return _ocr_reader


def _get_summarizer():
    global _summarizer_model, _summarizer_tokenizer
    if _summarizer_model is None:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        print("[backend] ⬇  Loading DistilBART summarizer …")
        _summarizer_tokenizer = AutoTokenizer.from_pretrained("sshleifer/distilbart-cnn-12-6")
        _summarizer_model = AutoModelForSeq2SeqLM.from_pretrained(
            "sshleifer/distilbart-cnn-12-6"
        ).to("cpu")  # MPS has limited seq2seq support; CPU is reliable
        _summarizer_model.eval()
        print("[backend] ✓  Summarizer ready")
    return _summarizer_model, _summarizer_tokenizer


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        print("[backend] ⬇  Loading MiniLM embeddings …")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2", device=DEVICE)
        print("[backend] ✓  Embedder ready")
    return _embedder


def _get_depth():
    global _depth_model, _depth_processor
    if _depth_model is None:
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        print("[backend] ⬇  Loading Depth-Anything-V2-Small …")
        _depth_processor = AutoImageProcessor.from_pretrained(
            "depth-anything/Depth-Anything-V2-Small-hf"
        )
        _depth_model = AutoModelForDepthEstimation.from_pretrained(
            "depth-anything/Depth-Anything-V2-Small-hf"
        ).to(DEVICE)
        _depth_model.eval()
        print("[backend] ✓  Depth model ready")
    return _depth_model, _depth_processor


_audio_classifier_pipe = None

def _get_audio_classifier():
    global _audio_classifier_pipe
    if _audio_classifier_pipe is None:
        from transformers import pipeline
        print("[backend] ⬇  Loading Audio Spectrogram Transformer …")
        _audio_classifier_pipe = pipeline(
            "audio-classification",
            model="MIT/ast-finetuned-audioset-10-10-0.4593",
            device=DEVICE,
        )
        print("[backend] ✓  Audio classifier ready")
    return _audio_classifier_pipe

# ─── Request / Response models ────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image: str
    task: Optional[str] = "object-detection"
    model: Optional[str] = None
    labels: Optional[List[str]] = None
    threshold: Optional[float] = 0.3
    topk: Optional[int] = 25

class CaptionRequest(BaseModel):
    model: Optional[str] = None
    messages: List[Dict[str, Any]]
    max_new_tokens: Optional[int] = 320
    do_sample: Optional[bool] = False
    repetition_penalty: Optional[float] = None

class TranscribeRequest(BaseModel):
    audio: List[float]
    language: Optional[str] = "english"
    task: Optional[str] = "transcribe"

class EmbedRequest(BaseModel):
    text: str
    pooling: Optional[str] = "mean"
    normalize: Optional[bool] = True

class SummarizeRequest(BaseModel):
    text: str
    max_new_tokens: Optional[int] = 200
    min_length: Optional[int] = None

class OcrRequest(BaseModel):
    image: str

class DepthRequest(BaseModel):
    image: str

class ClassifyAudioRequest(BaseModel):
    audio: List[float]
    topk: Optional[int] = 5

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "device": DEVICE}


@app.post("/api/infer/detect")
def detect(req: DetectRequest):
    try:
        image = _decode_image(req.image)
        yolo = _get_yolo()

        # Run YOLOv8 — returns detections for all 80 COCO classes.
        results = yolo(image, verbose=False)[0]
        threshold = req.threshold or 0.3

        detections = []
        for box in results.boxes:
            score = float(box.conf[0])
            if score < threshold:
                continue
            label = yolo.names[int(box.cls[0])]
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
            detections.append({
                "label": label,
                "score": score,
                "box": {"xmin": x1, "ymin": y1, "xmax": x2, "ymax": y2},
            })

        # For zero-shot requests, filter by requested labels if provided,
        # but keep all YOLO hits if no label filter matches (better than nothing).
        if req.task == "zero-shot-object-detection" and req.labels:
            req_labels_lower = {l.lower() for l in req.labels}
            filtered = [d for d in detections if d["label"].lower() in req_labels_lower]
            # Fall back to unfiltered if zero matches (COCO vocabulary mismatch)
            detections = filtered if filtered else detections

        # Respect topk
        topk = req.topk or 25
        detections.sort(key=lambda d: d["score"], reverse=True)
        return detections[:topk]

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/caption")
def caption(req: CaptionRequest):
    try:
        # Extract image URL and text prompt from the messages array.
        image_url = None
        prompt_text = "Describe this scene in detail for someone who cannot see it."
        for msg in req.messages:
            content = msg.get("content", [])
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        if part.get("type") == "image" and part.get("url"):
                            image_url = part["url"]
                        elif part.get("type") == "text" and part.get("text"):
                            prompt_text = part["text"]
            elif isinstance(content, str):
                prompt_text = content

        if not image_url:
            return {"text": ""}

        image = _decode_image(image_url)
        model, tokenizer = _get_moondream()

        with torch.no_grad():
            enc_image = model.encode_image(image)
            answer = model.answer_question(enc_image, prompt_text, tokenizer)

        return {"text": answer.strip()}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/transcribe")
def transcribe(req: TranscribeRequest):
    try:
        audio = np.array(req.audio, dtype=np.float32)
        if audio.size == 0:
            return {"text": ""}

        pipe = _get_whisper()
        lang = req.language or "english"
        result = pipe(
            {"array": audio, "sampling_rate": 16000},
            generate_kwargs={"language": lang, "task": "transcribe"},
            return_timestamps=False,
        )
        text = (result.get("text") or "").strip()
        # Remove hallucination artifacts common with whisper on silence.
        if text.lower() in {"thank you for watching.", "thank you.", "you"}:
            text = ""
        return {"text": text}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/embed")
def embed(req: EmbedRequest):
    try:
        embedder = _get_embedder()
        vec = embedder.encode(req.text, normalize_embeddings=bool(req.normalize))
        return {"embedding": vec.tolist()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/summarize")
def summarize(req: SummarizeRequest):
    try:
        text = req.text.strip()
        if not text:
            return {"text": ""}

        model, tokenizer = _get_summarizer()
        max_new_tokens = min(req.max_new_tokens or 200, 512)
        min_new_tokens = max(15, (req.min_length or 0) or max_new_tokens // 4)

        # DistilBART encoder limit is 1024 tokens; truncate long inputs.
        inputs = tokenizer(
            text,
            return_tensors="pt",
            max_length=1024,
            truncation=True,
        ).to("cpu")

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                min_new_tokens=min_new_tokens,
                num_beams=4,
                length_penalty=2.0,
                early_stopping=True,
            )

        summary = tokenizer.decode(output_ids[0], skip_special_tokens=True).strip()
        return {"text": summary}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/ocr")
def ocr(req: OcrRequest):
    try:
        image = _decode_image(req.image)
        reader = _get_ocr()

        img_array = np.array(image)
        results = reader.readtext(img_array)

        # Filter by confidence; join all detected text segments.
        lines = [text for (_, text, conf) in results if conf > 0.25 and text.strip()]
        combined = " ".join(lines)
        return {"text": combined}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/depth")
def depth(req: DepthRequest):
    try:
        image = _decode_image(req.image)
        model, processor = _get_depth()

        inputs = processor(images=image, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            outputs = model(**inputs)

        predicted_depth = outputs.predicted_depth  # shape: (1, H, W)

        # Resize to original image dimensions.
        import torch.nn.functional as F
        depth_map = F.interpolate(
            predicted_depth.unsqueeze(1).float(),
            size=(image.height, image.width),
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        depth_array = depth_map.cpu().numpy().flatten()
        return {
            "width": image.width,
            "height": image.height,
            "data": depth_array.tolist(),
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/infer/classify-audio")
def classify_audio(req: ClassifyAudioRequest):
    try:
        audio = np.array(req.audio, dtype=np.float32)
        if audio.size == 0:
            return []

        pipe = _get_audio_classifier()
        results = pipe(
            {"array": audio, "sampling_rate": 16000},
            top_k=req.topk or 5,
        )
        # Pipeline returns [{"label": ..., "score": ...}] — pass through directly.
        return results

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Start ────────────────────────────────────────────────────────────────────
def _free_port(port: int) -> None:
    """Kill any process already listening on *port* so we can always bind."""
    import signal
    import subprocess
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True
        )
        pids = result.stdout.strip().split()
        for pid in pids:
            pid = pid.strip()
            if pid and pid.isdigit() and int(pid) != os.getpid():
                try:
                    os.kill(int(pid), signal.SIGKILL)
                    print(f"[backend] Freed port {port} (killed PID {pid})")
                except ProcessLookupError:
                    pass
    except Exception:
        pass  # lsof may not exist on all platforms


if __name__ == "__main__":
    PORT = 8000
    _free_port(PORT)

    print()
    print("  ╔══════════════════════════════════════════════════════╗")
    print("  ║   EnableCare AI Backend  (Python / FastAPI)         ║")
    print(f"  ║   http://localhost:{PORT}                             ║")
    print(f"  ║   Device: {DEVICE:<43}║")
    print("  ╚══════════════════════════════════════════════════════╝")
    print()
    print("  Models are downloaded from HuggingFace on first use.")
    print("  Run  python download_models.py  first for offline support.")
    print()
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
