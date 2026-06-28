import base64
import os
import sys
from collections import deque
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F

# Setup Paths
SCRIPT_DIR = Path(__file__).parent
WEIGHTS_PATH = SCRIPT_DIR / "models" / "wlasl" / "asl100.pt"
CLASS_LIST_PATH = SCRIPT_DIR / "models" / "wlasl" / "wlasl_class_list.txt"

# WLASL Configuration
NUM_CLASSES = 100
FRAME_BUFFER_SIZE = 32
CONFIDENCE_THRESHOLD = 0.50

# Global State
_model = None
_class_names = []
_device = None

# Session Buffers: map session_id -> deque of preprocessed frames
_active_sessions = {}


def _load_class_names():
    names = {}
    with open(CLASS_LIST_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            idx, name = line.split("\t", 1)
            names[int(idx)] = name
    return [names.get(i, f"cls_{i}") for i in range(NUM_CLASSES)]


def _init_model():
    global _model, _class_names, _device
    if _model is not None:
        return

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _class_names = _load_class_names()

    # Import I3D from local file
    sys.path.insert(0, str(SCRIPT_DIR))
    from pytorch_i3d import InceptionI3d

    i3d = InceptionI3d(400, in_channels=3)
    i3d.replace_logits(NUM_CLASSES)

    # Load weights
    state = torch.load(str(WEIGHTS_PATH), map_location="cpu", weights_only=False)
    new_state = {k.replace("module.", ""): v for k, v in state.items()}
    i3d.load_state_dict(new_state)
    
    i3d.eval()
    _model = i3d.to(_device)
    print(f"[WLASL] Model loaded successfully on {_device}.")


def _preprocess_frame(image_base64: str) -> np.ndarray:
    """Decodes base64 and transforms image to match WLASL training data."""
    if image_base64.startswith("data:image"):
        image_base64 = image_base64.split(",")[1]

    img_data = base64.b64decode(image_base64)
    np_arr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Failed to decode image")

    # BGR to RGB
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Resize shorter side to 256
    h, w = rgb.shape[:2]
    scale = 256.0 / min(h, w)
    new_h, new_w = int(round(h * scale)), int(round(w * scale))
    rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    # Center crop 224x224
    cy, cx = new_h // 2, new_w // 2
    rgb = rgb[cy - 112: cy + 112, cx - 112: cx + 112]

    # Normalize to [-1, 1]
    rgb = (rgb.astype(np.float32) / 255.0) * 2.0 - 1.0

    # Shape: (3, 224, 224)
    return rgb.transpose(2, 0, 1)


def predict_word(session_id: str, image_base64: str):
    """
    Appends the frame to the user's session buffer. 
    If the buffer reaches FRAME_BUFFER_SIZE, runs inference and clears the buffer.
    Returns: dict with prediction or 'loading' status.
    """
    _init_model()

    if session_id not in _active_sessions:
        _active_sessions[session_id] = deque(maxlen=FRAME_BUFFER_SIZE)

    buffer = _active_sessions[session_id]

    try:
        pf = _preprocess_frame(image_base64)
        buffer.append(pf)
    except Exception as e:
        return {"error": f"Frame error: {e}"}

    # If we don't have enough frames yet, return a loading state
    if len(buffer) < FRAME_BUFFER_SIZE:
        return {
            "text": "Waiting for frames...", 
            "confidence": len(buffer) / FRAME_BUFFER_SIZE,
            "source": "wlasl",
            "status": "buffering",
            "frames_collected": len(buffer),
            "frames_needed": FRAME_BUFFER_SIZE
        }

    # We have exactly FRAME_BUFFER_SIZE frames, run inference!
    arr = np.stack(list(buffer), axis=1)  # (3, T, 224, 224)
    tensor = torch.from_numpy(arr).unsqueeze(0).to(_device)  # (1, 3, T, 224, 224)

    with torch.no_grad():
        logits = _model(tensor)
        probs = F.softmax(torch.mean(logits, dim=2)[0], dim=0)

    probs_np = probs.cpu().numpy()
    top_idx = int(np.argmax(probs_np))
    top_conf = float(probs_np[top_idx])
    word = _class_names[top_idx]

    # Clear buffer after successful prediction to start collecting for the next word
    buffer.clear()

    if top_conf < CONFIDENCE_THRESHOLD:
        return {
            "text": "(Low Confidence)",
            "confidence": top_conf,
            "source": "wlasl",
            "status": "completed"
        }

    return {
        "text": word,
        "confidence": top_conf,
        "source": "wlasl",
        "status": "completed"
    }
