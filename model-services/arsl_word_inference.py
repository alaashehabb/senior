"""
ARSL Word-level recognition using Holistic BiLSTM model
Ported from Holistic_keypoints_BiLSTM_model_3_signers.ipynb
"""

import base64
import os
import tempfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "arsl_words_bilstm.h5"

WORDS = [
    'السلام عليكم', 'وعليكم السلام', 'تفضل', 'كيف', 'حال', 'انت', 'انا', 'سعيد', 'جدا', 'الحمد لله', 
    'هل', 'شرب', 'قهوة', 'شاي', 'لا', 'شكرا', 'لك', 'اسم', 'ماذا', 'عمر', 'كم', 'سنة', 'صباح الخير', 
    'مساء الخير', 'لو سمحت', 'دقيقة', 'ممكن', 'مساعدة', 'عفوا', 'مع السلامة', 'اسف', 'نعم'
]

MIN_CONFIDENCE = 0.50

_model = None
_holistic = None

def _get_model():
    global _model
    if _model is None:
        from legacy_h5 import load_legacy_h5
        _model = load_legacy_h5(MODEL_PATH)
    return _model

def _get_holistic():
    global _holistic
    if _holistic is None:
        _holistic = mp.solutions.holistic.Holistic(
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        )
    return _holistic

def adjust_landmarks(arr, center):
    arr_reshaped = arr.reshape(-1, 3)
    center_repeated = np.tile(center, (len(arr_reshaped), 1))
    arr_adjusted = arr_reshaped - center_repeated
    return arr_adjusted.reshape(-1)

def extract_keypoints(results):
    pose = np.array([[res.x, res.y, res.z] for res in results.pose_landmarks.landmark]).flatten() if results.pose_landmarks else np.zeros(33*3)
    lh = np.array([[res.x, res.y, res.z] for res in results.left_hand_landmarks.landmark]).flatten() if results.left_hand_landmarks else np.zeros(21*3)
    rh = np.array([[res.x, res.y, res.z] for res in results.right_hand_landmarks.landmark]).flatten() if results.right_hand_landmarks else np.zeros(21*3)
    
    nose = pose[:3]
    lh_wrist = lh[:3]
    rh_wrist = rh[:3]
    
    pose_adjusted = adjust_landmarks(pose, nose)
    lh_adjusted = adjust_landmarks(lh, lh_wrist)
    rh_adjusted = adjust_landmarks(rh, rh_wrist)
    
    return pose_adjusted, lh_adjusted, rh_adjusted

def decode_video_base64(video_base64: str) -> str:
    payload = video_base64.strip()
    if "," in payload:
        payload = payload.split(",", 1)[1]
    raw = base64.b64decode(payload)
    
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    with os.fdopen(fd, 'wb') as f:
        f.write(raw)
    return temp_path

def predict_word(*, video_base64: str = None) -> dict:
    if not video_base64:
        raise ValueError("video_base64 is required")
        
    temp_video_path = decode_video_base64(video_base64)
    
    try:
        video = cv2.VideoCapture(temp_video_path)
        if not video.isOpened():
            raise ValueError("Could not open decoded video file")
            
        pose_keypoints, lh_keypoints, rh_keypoints = [], [], []
        holistic = _get_holistic()
        
        while True:
            ret, frame = video.read()
            if not ret:
                break
                
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            results = holistic.process(image)
            
            pose, lh, rh = extract_keypoints(results)
            pose_keypoints.append(pose)
            lh_keypoints.append(lh)
            rh_keypoints.append(rh)
            
        video.release()
    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            
    if not pose_keypoints:
        return {
            "text": "",
            "confidence": 0.0,
            "source": "arsl-words-bilstm",
            "message": "No frames could be extracted from video"
        }
        
    # Stack sequences
    holistic_keypoints = np.concatenate((pose_keypoints, lh_keypoints, rh_keypoints), axis=1)
    
    # Pad or truncate to 48 frames
    f_avg = 48
    num_frames = min(holistic_keypoints.shape[0], f_avg)
    holistic_keypoints = holistic_keypoints[:num_frames, :]
    
    while num_frames < f_avg:
        holistic_keypoints = np.concatenate((holistic_keypoints, np.expand_dims(holistic_keypoints[-1, :], axis=0)), axis=0)
        num_frames += 1
        
    features = np.expand_dims(holistic_keypoints, axis=0)
    
    model = _get_model()
    prediction = model.predict(features, verbose=0)[0]
    
    class_idx = int(np.argmax(prediction))
    confidence = float(prediction[class_idx])

    # The deployed BiLSTM has 100 output classes (KArSL-100, per the
    # "3 signers" notebook this was ported from), but WORDS only names 32
    # of them. Until the full 100-class list from the training notebook is
    # added, an out-of-range argmax is "a sign we can't name", not a crash.
    if class_idx >= len(WORDS):
        print(f"[ARSL Words] predicted class idx {class_idx} has no label (WORDS has {len(WORDS)}), confidence: {confidence:.3f}")
        return {
            "text": "",
            "confidence": confidence,
            "source": "arsl-words-bilstm",
            "message": "Sign not in the supported vocabulary. Please try again.",
        }

    label = WORDS[class_idx]
    
    print(f"[ARSL Words] predicted class idx: {class_idx}, confidence: {confidence:.3f}")
    
    if confidence < MIN_CONFIDENCE:
        return {
            "text": "",
            "confidence": confidence,
            "source": "arsl-words-bilstm",
            "message": f"Low confidence ({confidence:.2f}) or no sign detected. (Extracted {len(pose_keypoints)} frames)",
            "raw_label": label,
        }
        
    return {"text": label, "confidence": confidence, "source": "arsl-words-bilstm"}
