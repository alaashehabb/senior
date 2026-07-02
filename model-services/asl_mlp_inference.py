"""
ASL letter recognition using asl_mediapipe_mlp_model_engineered.h5
Ported from SLR-Main Production_Architecture_English.ipynb
"""

from __future__ import annotations

import base64
import re
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "asl_mediapipe_mlp_model_engineered.h5"

# The deployed model has 28 output classes (verified against the .h5), not
# the Kaggle dataset's 29: the "nothing" class contains no hand, so MediaPipe
# extracts no landmarks from it and it necessarily fell out of this
# landmark-feature training pipeline. Listing 29 labels here shifted every
# index after "Z", so index 27 ("space") was mislabeled as "nothing".
CLASS_LABELS = [
    "A", "B", "C", "D", "E", "F", "G", "H",
    "I", "J", "K", "L", "M", "N", "O", "P",
    "Q", "R", "S", "T", "U", "V", "W", "X",
    "Y", "Z", "del", "space",
]

ANGLE_TRIPLETS = [
    (0, 1, 2), (1, 2, 3), (2, 3, 4),
    (0, 5, 6), (5, 6, 7), (6, 7, 8),
    (0, 9, 10), (9, 10, 11), (10, 11, 12),
    (0, 13, 14), (13, 14, 15), (14, 15, 16),
    (0, 17, 18), (17, 18, 19), (18, 19, 20),
]

MIN_CONFIDENCE = 0.75
MP_DETECTION_CONFIDENCE = 0.70
MP_TRACKING_CONFIDENCE = 0.65

_model = None
_hands = None


def compute_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba = a - b
    bc = c - b
    cosine = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    cosine = np.clip(cosine, -1.0, 1.0)
    return float(np.arccos(cosine))


def extract_engineered_features(landmarks_array: np.ndarray) -> np.ndarray:
    wrist = landmarks_array[0]
    relative = landmarks_array - wrist
    relative_flat = relative.flatten()

    angles = []
    for a_idx, b_idx, c_idx in ANGLE_TRIPLETS:
        angles.append(compute_angle(
            landmarks_array[a_idx],
            landmarks_array[b_idx],
            landmarks_array[c_idx],
        ))

    return np.concatenate([relative_flat, np.array(angles, dtype=np.float32)])


def landmarks_list_to_features(landmarks: list[float]) -> np.ndarray | None:
    arr = np.asarray(landmarks, dtype=np.float32)
    if arr.size == 78:
        return arr.reshape(1, -1)
    if arr.size == 63:
        return extract_engineered_features(arr.reshape(21, 3)).reshape(1, -1)
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
    landmarks_raw = np.array([[p.x, p.y, p.z] for p in lm], dtype=np.float32)
    return extract_engineered_features(landmarks_raw).reshape(1, -1)


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
        print("[ASL] decoded image shape:", image_bgr.shape)
        features = _features_from_image(image_bgr)
    elif landmarks:
        features = landmarks_list_to_features(landmarks)
    else:
        raise ValueError("imageBase64 or landmarks is required")

    if features is None:
        return {
            "text": "",
            "confidence": 0.0,
            "source": "asl-mlp-engineered",
            "message": "No hand detected",
        }

    print("[ASL] features shape:", features.shape, "sample:", features.flatten()[:10].tolist())
    model = _get_model()
    prediction = model.predict(features, verbose=0)[0]
    print("[ASL] raw model output:", prediction.tolist())
    class_idx = int(np.argmax(prediction))
    confidence = float(prediction[class_idx])
    label = CLASS_LABELS[class_idx]
    print("[ASL] predicted class idx:", class_idx, "label:", label, "confidence:", confidence)

    if confidence < MIN_CONFIDENCE or label == "nothing":
        return {
            "text": "",
            "confidence": confidence,
            "source": "asl-mlp-engineered",
            "message": "Low confidence or no sign detected",
            "raw_label": label,
        }

    if label == "del":
        return {"text": "", "confidence": confidence, "source": "asl-mlp-engineered", "action": "delete"}
    if label == "space":
        return {"text": " ", "confidence": confidence, "source": "asl-mlp-engineered"}

    return {"text": label, "confidence": confidence, "source": "asl-mlp-engineered"}
