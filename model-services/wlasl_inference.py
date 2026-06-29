import base64
import os
import sys
import time
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

# Stabilization & Cooldown Logic
STAB_WINDOW = 10         # Number of recent predictions to consider
STAB_THRESH = 6          # Minimum matches required to commit
MIN_CONFIDENCE = 0.50    # Minimum confidence to accept a prediction
HOLD_COOLDOWN = 1.2      # Seconds to lock out after committing a word

# Global State
_model = None
_class_names = []
_device = None

# Session State: maps session_id -> dict of state
_active_sessions = {}

def _get_session_state(session_id: str):
    if session_id not in _active_sessions:
        _active_sessions[session_id] = {
            "frames": deque(maxlen=FRAME_BUFFER_SIZE),
            "predictions": deque(maxlen=STAB_WINDOW),
            "last_commit_time": 0.0,
            "last_word": ""
        }
    return _active_sessions[session_id]

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
    if image_base64.startswith("data:image"):
        image_base64 = image_base64.split(",")[1]

    img_data = base64.b64decode(image_base64)
    np_arr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Failed to decode image")

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    scale = 256.0 / min(h, w)
    new_h, new_w = int(round(h * scale)), int(round(w * scale))
    rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    cy, cx = new_h // 2, new_w // 2
    rgb = rgb[cy - 112: cy + 112, cx - 112: cx + 112]
    rgb = (rgb.astype(np.float32) / 255.0) * 2.0 - 1.0

    return rgb.transpose(2, 0, 1)


def predict_word(session_id: str, image_base64: str):
    """
    Appends the frame to the user's session buffer and runs inference if full.
    Uses majority voting and cooldown to prevent repetition.
    """
    _init_model()
    
    # Handle special "clear" or "stop" signals if needed (though continuous doesn't strictly need it)
    if image_base64 == "CLEAR":
        _active_sessions[session_id] = {
            "frames": deque(maxlen=FRAME_BUFFER_SIZE),
            "predictions": deque(maxlen=STAB_WINDOW),
            "last_commit_time": 0.0,
            "last_word": ""
        }
        return {"status": "cleared"}

    state = _get_session_state(session_id)
    buffer = state["frames"]

    try:
        pf = _preprocess_frame(image_base64)
        buffer.append(pf)
    except Exception as e:
        return {"error": f"Frame error: {e}"}

    # Not enough frames yet
    if len(buffer) < FRAME_BUFFER_SIZE:
        return {
            "status": "buffering",
            "frames_collected": len(buffer),
            "frames_needed": FRAME_BUFFER_SIZE
        }

    # We have enough frames, run inference!
    arr = np.stack(list(buffer), axis=1)  # (3, T, 224, 224)
    tensor = torch.from_numpy(arr).unsqueeze(0).to(_device)

    with torch.no_grad():
        logits = _model(tensor)
        probs = F.softmax(torch.mean(logits, dim=2)[0], dim=0)

    probs_np = probs.cpu().numpy()
    top_idx = int(np.argmax(probs_np))
    top_conf = float(probs_np[top_idx])
    word = _class_names[top_idx]

    # Stabilization Logic
    state["predictions"].append(top_idx)
    
    now = time.time()
    
    # Check if we have enough predictions to vote
    if len(state["predictions"]) == STAB_WINDOW:
        # Get most frequent prediction index
        preds_list = list(state["predictions"])
        most_common_idx = max(set(preds_list), key=preds_list.count)
        count = preds_list.count(most_common_idx)
        
        # Check thresholds
        if count >= STAB_THRESH and top_conf >= MIN_CONFIDENCE:
            candidate_word = _class_names[most_common_idx]
            
            # Check cooldown and repetition
            if (now - state["last_commit_time"]) > HOLD_COOLDOWN:
                if candidate_word != state["last_word"] or (now - state["last_commit_time"]) > (HOLD_COOLDOWN * 2):
                    # Commit the word!
                    state["last_commit_time"] = now
                    state["last_word"] = candidate_word
                    state["predictions"].clear()
                    buffer.clear() # Clear frames so we don't immediately re-detect using same video chunk
                    
                    return {
                        "status": "committed",
                        "text": candidate_word,
                        "confidence": top_conf,
                        "source": "wlasl"
                    }

    # If not committed, just return buffering state
    return {
        "status": "buffering",
        "frames_collected": len(buffer),
        "frames_needed": FRAME_BUFFER_SIZE,
        "current_guess": word,
        "guess_confidence": top_conf
    }
