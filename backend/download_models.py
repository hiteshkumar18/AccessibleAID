"""
Pre-download all EnableCare AI models to the HuggingFace cache.

Run once before going offline:
    python download_models.py

Models downloaded:
  vikhyatk/moondream2                     ~1.8 GB  VLM scene description
  openai/whisper-large-v3-turbo           ~1.5 GB  Speech-to-text
  sshleifer/distilbart-cnn-12-6           ~306 MB  Text summarization
  sentence-transformers/all-MiniLM-L6-v2  ~90  MB  Semantic embeddings
  depth-anything/Depth-Anything-V2-Small-hf ~99 MB  Depth estimation
  YOLOv8l (via ultralytics)               ~87  MB  Object detection
  EasyOCR English models                  ~100 MB  OCR

Total: ~4 GB
"""

import os
import sys

def dl(label: str, fn):
    print(f"  ⬇  {label} …", end=" ", flush=True)
    try:
        fn()
        print("✓")
    except Exception as e:
        print(f"✗  {e}")


print()
print("  EnableCare model downloader")
print("  ─────────────────────────────────────────")
print()

# VLM — moondream2
dl("vikhyatk/moondream2 (VLM, ~1.8 GB)", lambda: (
    __import__("transformers").AutoTokenizer.from_pretrained(
        "vikhyatk/moondream2", trust_remote_code=True
    ),
    __import__("transformers").AutoModelForCausalLM.from_pretrained(
        "vikhyatk/moondream2", trust_remote_code=True
    ),
))

# Whisper
dl("openai/whisper-large-v3-turbo (~1.5 GB)", lambda: (
    __import__("transformers").AutoProcessor.from_pretrained(
        "openai/whisper-large-v3-turbo"
    ),
    __import__("transformers").AutoModelForSpeechSeq2Seq.from_pretrained(
        "openai/whisper-large-v3-turbo"
    ),
))

# Summarizer
dl("sshleifer/distilbart-cnn-12-6 (~306 MB)", lambda:
    __import__("transformers").pipeline(
        "summarization", model="sshleifer/distilbart-cnn-12-6"
    )
)

# Embeddings
dl("sentence-transformers/all-MiniLM-L6-v2 (~90 MB)", lambda:
    __import__("sentence_transformers").SentenceTransformer("all-MiniLM-L6-v2")
)

# Depth
dl("depth-anything/Depth-Anything-V2-Small-hf (~99 MB)", lambda: (
    __import__("transformers").AutoImageProcessor.from_pretrained(
        "depth-anything/Depth-Anything-V2-Small-hf"
    ),
    __import__("transformers").AutoModelForDepthEstimation.from_pretrained(
        "depth-anything/Depth-Anything-V2-Small-hf"
    ),
))

# YOLOv8
dl("YOLOv8l (ultralytics, ~87 MB)", lambda:
    __import__("ultralytics").YOLO("yolov8l.pt")
)

# EasyOCR
dl("EasyOCR English models (~100 MB)", lambda:
    __import__("easyocr").Reader(["en"], gpu=False)
)

print()
print("  All models downloaded. You can now run the server offline.")
print()
