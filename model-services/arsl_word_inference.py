"""
ArSL word-level recognition — exact port of Issam's
Holistic_keypoints_BiLSTM_model_3_signers notebook.

Preprocessing (identical to the original notebook):
  - Features : pose(33×3) + left_hand(21×3) + right_hand(21×3) = 225-D per frame
  - Normalisation: pose relative to nose, each hand relative to its own wrist
  - Sequence length: 48 frames (pad with last frame / truncate)
  - Labels: KArSL SignID 71–170 (100 medical/body Arabic words)
  - Model: Holistic_keypoints_BiLSTM_model_3_signers  (loss 0.026 / acc 99.62 %)
"""

import base64
import os
import tempfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

MODEL_PATH = Path(__file__).parent / "models" / "arsl_words_bilstm.h5"

# KArSL SignID 71–170 — 100 medical/anatomy Arabic words (same order the model was trained on)
WORDS = [
    'هيكل عظمي', 'جمجة', 'عمود فقري', 'قفص صدري', 'جهاز تنفسي',          # 0–4
    'قصبة هوائية', 'رئتان', 'شهيق - زفير', 'جهاز هضمي', 'وجه',             # 5–9
    'بلعوم', 'كبد', 'البنكرياس', 'الأمعاء الدقيقة', 'الأمعاء الغليظة',    # 10–14
    'الزائدة الدودية', 'جهاز عصبي', 'قلب', 'حواس خمس', 'عضلة',             # 15–19
    'أنسجة', 'مستشفى', 'إسعافات أولية', 'جرح نازف', 'حروق',                # 20–24
    'مخدر', 'عملية جراحية', 'شاش / ضمادة', 'شريط لاصق / بلاستر', 'صيدلية', # 25–29
    'تحليل دم', 'فحص سريري', 'فحص النظر', 'ميزان حرارة', 'سماعة أذن',      # 30–34
    'جهاز قياس الضغط', 'نبض القلب', 'تحليل طبي', 'معمل التحاليل', 'صورة اشعة', # 35–39
    'التهاب', 'تورم', 'زكام', 'عدوى', 'صداع',                              # 40–44
    'ألم', 'حمى', 'إسهال', 'إمساك', 'مغص',                                 # 45–49
    'مرض السكر', 'أزمة قلبية', 'سرطان', 'الإيدز', 'تساقط الشعر',           # 50–54
    'سكتة قلبية', 'شلل نصفي', 'شلل دماغي', 'ضغط الدم', 'حساسية',           # 55–59
    'حكة', 'دواء', 'دورة شهرية', 'مريض', 'كبسولة',                         # 60–64
    'دواء شراب', 'مرهم', 'قطارة', 'أخذ إبرة', 'تلقيح',                     # 65–69
    'تطعيم', 'أشعة ليزر', 'مخدرات', 'إدمان', 'توحد',                        # 70–74
    'منغولي', 'بكتريا', 'جرثومة', 'فيروس', 'إنتشار',                        # 75–79
    'إعاقة', 'إعاقة ذهنية', 'إعاقة جسدية', 'إعاقة بصرية', 'إعاقة سمعية',  # 80–84
    'وباء', 'مناعة', 'عصب', 'معافى', 'يأكل',                               # 85–89
    'يشرب', 'ينام', 'يستيقظ', 'يسمع', 'يسكت',                              # 90–94
    'يشم', 'يصعد', 'ينزل', 'يفتح', 'يقفل',                                 # 95–99
]

# Matching English labels (SignID 71–170)
WORDS_EN = [
    'Skeleton', 'Skull', 'Backbone', 'Chest', 'Respiratory device',          # 0–4
    'Trachea', 'Lungs', 'Inhale/Exhale', 'Digestive system', 'Face',         # 5–9
    'Pharynx', 'Liver', 'Pancreas', 'Small intestine', 'Large intestine',    # 10–14
    'Appendix', 'Nervous system', 'Heart', 'Five senses', 'Muscle',          # 15–19
    'Tissue', 'Hospital', 'First aid', 'Wound', 'Burns',                     # 20–24
    'Anesthetic', 'Surgery', 'Gauze', 'Adhesive tape', 'Pharmacy',           # 25–29
    'Blood analysis', 'Physical examination', 'Sight examination',
        'Thermometer', 'Stethoscope',                                         # 30–34
    'Blood pressure device', 'Pulse', 'Medical analysis',
        'Analysis laboratory', 'X-ray',                                       # 35–39
    'Inflammation', 'Swelling', 'Cold', 'Infection', 'Headache',             # 40–44
    'Pain', 'Fever', 'Diarrhea', 'Constipation', 'Colic',                   # 45–49
    'Diabetes', 'Heart attack', 'Cancer', 'AIDS', 'Hair loss',               # 50–54
    'Heart failure', 'Hemiplegia', 'Cerebral paralysis',
        'Blood pressure', 'Allergy',                                          # 55–59
    'Itch', 'Medicine', 'Monthly cycle', 'Sick/Illness', 'Capsule',          # 60–64
    'Liquid medicine', 'Ointment', 'Dropper', 'Injection', 'Vaccination',    # 65–69
    'Inoculation', 'Laser ray', 'Drugs', 'Addiction', 'Autism',              # 70–74
    'Mongoloid', 'Bacterium', 'Microbe', 'Virus', 'Spread',                  # 75–79
    'Disability', 'Mental disability', 'Physical disability',
        'Visual impairment', 'Hearing disability',                            # 80–84
    'Epidemic', 'Immunity', 'Nerve', 'Healthy', 'Eat',                       # 85–89
    'Drink', 'Sleep', 'Wake up', 'Hear', 'Be silent',                        # 90–94
    'Inhale/Smell', 'Go up', 'Go down', 'Open', 'Close',                     # 95–99
]

MIN_CONFIDENCE = 0.05

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

# ---------------------------------------------------------------------------
# Preprocessing — identical to Holistic_keypoints_BiLSTM_model_3_signers.ipynb
# ---------------------------------------------------------------------------

F_AVG = 48
N_FEATURES = 33 * 3 + 21 * 3 + 21 * 3  # 225


def adjust_landmarks(arr: np.ndarray, center: np.ndarray) -> np.ndarray:
    """Translate all landmarks so that `center` becomes the origin."""
    arr_reshaped = arr.reshape(-1, 3)
    center_repeated = np.tile(center, (len(arr_reshaped), 1))
    return (arr_reshaped - center_repeated).reshape(-1)


def extract_keypoints(results) -> np.ndarray:
    """Return a single 225-D feature vector for one frame."""
    pose = (
        np.array([[r.x, r.y, r.z] for r in results.pose_landmarks.landmark]).flatten()
        if results.pose_landmarks else np.zeros(33 * 3)
    )
    lh = (
        np.array([[r.x, r.y, r.z] for r in results.left_hand_landmarks.landmark]).flatten()
        if results.left_hand_landmarks else np.zeros(21 * 3)
    )
    rh = (
        np.array([[r.x, r.y, r.z] for r in results.right_hand_landmarks.landmark]).flatten()
        if results.right_hand_landmarks else np.zeros(21 * 3)
    )
    nose     = pose[:3]
    lh_wrist = lh[:3]
    rh_wrist = rh[:3]
    pose_adj = adjust_landmarks(pose, nose)
    lh_adj   = adjust_landmarks(lh,   lh_wrist)
    rh_adj   = adjust_landmarks(rh,   rh_wrist)
    # Concatenate into one 225-D vector (same as original notebook)
    return np.concatenate((pose_adj, lh_adj, rh_adj))


def pad_or_trim(seq: list, f_avg: int = F_AVG) -> np.ndarray:
    """Truncate to f_avg frames, or repeat the last frame to reach f_avg."""
    arr = np.asarray(seq, dtype=np.float32)   # (N, 225)
    n   = min(arr.shape[0], f_avg)
    arr = arr[:n, :]
    while arr.shape[0] < f_avg:
        arr = np.concatenate((arr, arr[-1:, :]), axis=0)
    return arr                                # (48, 225)

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

        seq = []          # list of 225-D vectors, one per frame
        holistic = _get_holistic()

        while True:
            ret, frame = video.read()
            if not ret:
                break
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
            results = holistic.process(image)
            seq.append(extract_keypoints(results))   # 225-D vector

        video.release()
    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

    if not seq:
        return {
            "text": "",
            "confidence": 0.0,
            "source": "arsl-words-bilstm",
            "message": "No frames could be extracted from video",
        }

    print(f"[ARSL Words] extracted {len(seq)} frames from video")

    # Pad / truncate to exactly F_AVG=48 frames  (same as original notebook)
    X = pad_or_trim(seq)[None, ...]  # shape (1, 48, 225)
    features = X
    
    model = _get_model()
    prediction = model.predict(features, verbose=0)[0]
    
    class_idx = int(np.argmax(prediction))
    confidence = float(prediction[class_idx])

    if class_idx >= len(WORDS):
        print(f"[ARSL Words] predicted class idx {class_idx} out of range (WORDS={len(WORDS)}), confidence: {confidence:.3f}")
        return {
            "text": "",
            "confidence": confidence,
            "source": "arsl-words-bilstm",
            "message": "Sign not in the supported vocabulary. Please try again.",
        }

    label = WORDS[class_idx]
    label_en = WORDS_EN[class_idx]
    
    print(f"[ARSL Words] predicted class idx: {class_idx}, confidence: {confidence:.3f}")
    
    if confidence < MIN_CONFIDENCE:
        return {
            "text": "",
            "confidence": confidence,
            "source": "arsl-words-bilstm",
            "message": f"Low confidence ({confidence:.2f}) or no sign detected. (Extracted {len(seq)} frames)",
            "raw_label": label,
            "raw_label_en": label_en,
        }

    return {
        "text": label,
        "text_en": label_en,
        "confidence": confidence,
        "source": "arsl-words-bilstm",
    }
