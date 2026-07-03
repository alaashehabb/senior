"""
ArSL letter recognition using arsl_mediapipe_mlp_model_bestV2.2.h5
Ported from SLR-Main Production_Architecture_Arabic.ipynb
"""

from __future__ import annotations

import base64
import re
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "arsl_mediapipe_mlp_model_bestV2.2.h5"

CLASS_LABELS = [
    "ain", "al", "aleff", "bb", "dal", "dha", "dhad", "fa",
    "gaaf", "ghain", "ha", "haa", "jeem", "kaaf", "khaa", "la",
    "laam", "meem", "nun", "ra", "saad", "seen", "sheen", "ta",
    "taa", "thaa", "thal", "toot", "waw", "ya", "yaa", "zay",
]

ARABIC_MAP = {
    "ain": "ع", "al": "ال", "aleff": "أ", "bb": "ب", "dal": "د",
    "dha": "ظ", "dhad": "ض", "fa": "ف", "gaaf": "ق", "ghain": "غ",
    "ha": "ه", "haa": "ح", "jeem": "ج", "kaaf": "ك", "khaa": "خ",
    "la": "لا", "laam": "ل", "meem": "م", "nun": "ن", "ra": "ر",
    "saad": "ص", "seen": "س", "sheen": "ش", "ta": "ة", "taa": "ت",
    "thaa": "ث", "thal": "ذ", "toot": "ط", "waw": "و", "ya": "ي",
    "yaa": "ي", "zay": "ز",
}

MIN_CONFIDENCE = 0.75
MP_DETECTION_CONFIDENCE = 0.50
MP_TRACKING_CONFIDENCE = 0.50

_model = None
_hands = None


def normalize_bbox(landmarks_array: np.ndarray) -> np.ndarray:
    xs, ys, zs = landmarks_array[:, 0], landmarks_array[:, 1], landmarks_array[:, 2]
    x_min, x_max = np.min(xs), np.max(xs)
    y_min, y_max = np.min(ys), np.max(ys)
    x_range, y_range = max(x_max - x_min, 1e-6), max(y_max - y_min, 1e-6)
    
    normalized = np.zeros_like(landmarks_array)
    normalized[:, 0] = (xs - x_min) / x_range
    normalized[:, 1] = (ys - y_min) / y_range
    normalized[:, 2] = zs / x_range
    return normalized

def landmarks_list_to_features(landmarks: list[float]) -> np.ndarray | None:
    arr = np.asarray(landmarks, dtype=np.float32)
    if arr.size == 63:
        arr_reshaped = arr.reshape(21, 3)
        arr_norm = normalize_bbox(arr_reshaped)
        return arr_norm.reshape(1, -1)
    return None


def _get_model():
    global _model
    if _model is None:
        from legacy_h5 import load_legacy_h5
        _model = load_legacy_h5(MODEL_PATH)
    return _model


def _get_hands():
    global _hands
    if _hands is None:
        _hands = mp.solutions.hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=MP_DETECTION_CONFIDENCE,
            min_tracking_confidence=MP_TRACKING_CONFIDENCE,
        )
    return _hands


def _features_from_image(image_bgr: np.ndarray) -> np.ndarray | None:
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = _get_hands().process(rgb)
    if not results.multi_hand_landmarks:
        return None

    lm = results.multi_hand_landmarks[0].landmark
    arr_reshaped = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)
    arr_norm = normalize_bbox(arr_reshaped)
    return arr_norm.reshape(1, -1)


def decode_image_base64(image_base64: str) -> np.ndarray:
    payload = image_base64.strip()
    if "," in payload:
        payload = payload.split(",", 1)[1]
    raw = base64.b64decode(re.sub(r"\s+", "", payload))
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")
    return image


def predict_letter(
    *,
    image_base64: str | None = None,
    landmarks: list[float] | None = None,
) -> dict:
    if image_base64:
        image_bgr = decode_image_base64(image_base64)
        print("[ArSL] decoded image shape:", image_bgr.shape)
        features = _features_from_image(image_bgr)
    elif landmarks:
        features = landmarks_list_to_features(landmarks)
    else:
        raise ValueError("imageBase64 or landmarks is required")

    if features is None:
        return {
            "text": "",
            "confidence": 0.0,
            "source": "arsl-mlp-bestV2.2",
            "message": "No hand detected",
        }

    print("[ArSL] features shape:", features.shape, "sample:", features.flatten()[:10].tolist())
    model = _get_model()
    prediction = model.predict(features, verbose=0)[0]
    print("[ArSL] raw model output:", prediction.tolist())
    class_idx = int(np.argmax(prediction))
    confidence = float(prediction[class_idx])
    raw_label = CLASS_LABELS[class_idx] if class_idx < len(CLASS_LABELS) else "nothing"
    text = ARABIC_MAP.get(raw_label, raw_label)
    print("[ArSL] predicted class idx:", class_idx, "label:", raw_label, "text:", text, "confidence:", confidence)

    if confidence < MIN_CONFIDENCE:
        return {
            "text": "",
            "confidence": confidence,
            "source": "arsl-mlp-bestV2.2",
            "message": "Low confidence or no sign detected",
            "raw_label": raw_label,
        }

    return {
        "text": text,
        "confidence": confidence,
        "source": "arsl-mlp-bestV2.2",
        "raw_label": raw_label,
    }
