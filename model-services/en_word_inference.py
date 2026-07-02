import base64
import os
import sys
import tempfile
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path

# Setup Paths
SCRIPT_DIR = Path(__file__).parent
WEIGHTS_PATH = SCRIPT_DIR / "models" / "wlasl" / "asl100.pt"
CLASS_LIST_PATH = SCRIPT_DIR / "models" / "wlasl" / "wlasl_class_list.txt"

# WLASL Configuration
NUM_CLASSES = 100
FRAME_BUFFER_SIZE = 32
MIN_CONFIDENCE = 0.50

# Global State
_model = None
_class_names = []
_device = None


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
    print(f"[EN Words] Model loaded successfully on {_device}.")


def _preprocess_frame(frame: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    scale = 256.0 / min(h, w)
    new_h, new_w = int(round(h * scale)), int(round(w * scale))
    rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    cy, cx = new_h // 2, new_w // 2
    rgb = rgb[cy - 112: cy + 112, cx - 112: cx + 112]
    rgb = (rgb.astype(np.float32) / 255.0) * 2.0 - 1.0

    return rgb.transpose(2, 0, 1)


def predict_word(video_base64: str) -> dict:
    _init_model()

    video_base64 = video_base64.strip()
    if "," in video_base64:
        video_base64 = video_base64.split(",", 1)[1]

    video_data = base64.b64decode(video_base64)

    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(video_data)

        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return {"text": "", "message": "Failed to decode video file"}

        frames = []
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        cap.release()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not frames:
        return {"text": "", "message": "No frames extracted"}

    total_frames = len(frames)
    indices = np.linspace(0, total_frames - 1, FRAME_BUFFER_SIZE, dtype=int)
    sampled_frames = [frames[i] for i in indices]

    processed_frames = [_preprocess_frame(f) for f in sampled_frames]
    arr = np.stack(processed_frames, axis=1)  # (3, 32, 224, 224)
    tensor = torch.from_numpy(arr).unsqueeze(0).to(_device)

    with torch.no_grad():
        logits = _model(tensor)
        probs = F.softmax(torch.mean(logits, dim=2)[0], dim=0)

    probs_np = probs.cpu().numpy()
    top_idx = int(np.argmax(probs_np))
    top_conf = float(probs_np[top_idx])
    word = _class_names[top_idx]

    print(f"[EN Words] predicted class idx: {top_idx}, confidence: {top_conf:.3f}")

    if top_conf < MIN_CONFIDENCE:
        return {
            "text": "",
            "confidence": top_conf,
            "message": f"Low confidence ({top_conf:.2f}). Please try again.",
            "raw_label": word,
        }

    return {
        "text": word,
        "confidence": top_conf,
        "source": "wlasl"
    }
