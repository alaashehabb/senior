#!/usr/bin/env python3
"""
Fetch .pose skeleton files from sign.mt's public translate API.

sign.mt (https://sign.mt, open source: github.com/sign/translate) exposes a
cloud function that translates spoken-language text into a signed-language
pose sequence drawn from its curated dictionary. The response is a standard
`pose-format` binary — exactly what the frontend's <pose-viewer> plays.

This replaced the YouTube+MediaPipe pipeline (asl_pipeline.py) as the primary
content source in July 2026: all of that pipeline's curated video IDs had
gone dead, while this API serves clean single-sign clips with face + hands.

Two languages:
  en → ASL  (spoken=en, signed=ase), files in poses/
  ar → ArSL (spoken=ar, signed=jos — Jordanian Sign Language, the only
             open Arabic-lookup sign dictionary), files in poses/ar/

Usage:
    python fetch_signmt_pose.py mother father "thank you"
    python fetch_signmt_pose.py --lang ar "شكرا" "نعم"
    python fetch_signmt_pose.py --all             # every English education word
    python fetch_signmt_pose.py --lang ar --all   # every Arabic education word

New files are picked up automatically by /api/poses and the Education tab.
ALWAYS visually review a newly fetched sign before shipping it — for words
missing from the dictionary the API falls back to FINGERSPELLING the word,
which is not the sign learners should be taught.
"""

import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

POSES_DIR = Path(__file__).parent / "poses"
API = "https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose"

LANGS = {
    "en": {"spoken": "en", "signed": "ase", "dir": POSES_DIR},
    "ar": {"spoken": "ar", "signed": "jos", "dir": POSES_DIR / "ar"},
}

# Keep in sync with WORD_ANIMS in frontend/src/utils/aslWordPoses.js
EDUCATION_WORDS_EN = [
    "hello", "thank you", "yes", "no", "please", "sorry", "i love you",
    "eat", "drink", "water", "more", "help", "stop", "go", "come", "learn",
    "name", "see", "want", "know", "finish",
    "me", "you", "mother", "father", "love",
    "happy", "sad", "cry",
    "where", "what",
    "now", "tomorrow",
    "and", "is", "has", "was", "were", "how",
    "one", "two", "three", "four", "five",
    # fingerspelling alphabet (per-letter clips used by the Fingerspelling tab)
    *"abcdefghijklmnopqrstuvwxyz",
]

# Keep in sync with AR_WORDS in frontend/src/utils/arslWords.js.
#
# ⚠ Every word was individually verified to be a GENUINE jos dictionary
# sign (July 2026): the API silently FINGERSPELLS out-of-vocabulary words
# with HTTP 200, so a successful fetch proves nothing. Verification: fetch
# the doubled word (guaranteed OOV → spelled) and DTW-compare handshape
# sequences — near-identical prefix = fallback. Spelling matters: أم is a
# real sign while ام spells; آسف real, اسف spells. Bonus oracle for words
# containing ة: their fingerspelling lexicon has no ة, so OOV ة-words
# return HTTP 500 — a 200 for a ة-word IS a real sign.
EDUCATION_WORDS_AR = [
    "لا", "اسم", "مع السلامة", "آسف", "فهم", "خطأ", "إشارة", "جلس", "اليسار",
    "أنا", "أم", "جد", "امرأة", "أسرة", "الطبيب",
    "حب", "خائف", "جميل", "حلو", "جديد", "أزرق",
    "الرأس", "القلب", "أذن",
    "حصان", "أسد",
    "جبل", "ثلج", "السوق", "الباب", "حمام",
    "امتحان", "العمل",
    "اليوم", "أمس", "الآن", "دقيقة",
    "خبز", "حليب", "جبن", "أرز", "السكر",
    # NOTE the definite-article pattern: many jos nouns are ONLY real under
    # their ال form (القلب real, قلب spelled) — always probe both forms.
    # Numbers (Sentence Builder digits only — no UI category; 1 and 5 are
    # ABSENT from jos, all variants spell or 500):
    "ثلاثة",
    # "اربعة" needs the "أربعة" spelling variant — see poses/ar/اربعة.pose
    # "اثنان" needs the "الاثنان" variant — saved as poses/ar/اثنان.pose
    # fingerspelling alphabet (28 base letters)
    *"ابتثجحخدذرزسشصضطظعغفقكلمنهوي",
]

EDUCATION_WORDS = {"en": EDUCATION_WORDS_EN, "ar": EDUCATION_WORDS_AR}


def fetch_word(word: str, lang: str = "en") -> Path:
    cfg = LANGS[lang]
    params = urllib.parse.urlencode(
        {"text": word.lower(), "spoken": cfg["spoken"], "signed": cfg["signed"]}
    )
    with urllib.request.urlopen(f"{API}?{params}", timeout=60) as resp:
        data = resp.read()
    if len(data) < 1000 or b"POSE_LANDMARKS" not in data[:64]:
        raise ValueError(f"Response for '{word}' does not look like a .pose file ({len(data)} bytes)")
    cfg["dir"].mkdir(exist_ok=True)
    out = cfg["dir"] / f"{word.lower().replace(' ', '_')}.pose"
    out.write_bytes(data)
    return out


def main():
    args = sys.argv[1:]
    lang = "en"
    if args[:1] == ["--lang"]:
        if len(args) < 2 or args[1] not in LANGS:
            print(f"--lang must be one of {list(LANGS)}")
            sys.exit(1)
        lang = args[1]
        args = args[2:]
    words = EDUCATION_WORDS[lang] if args == ["--all"] else [a.lower() for a in args]
    if not words:
        print(__doc__)
        sys.exit(1)
    failed = []
    for word in words:
        try:
            out = fetch_word(word, lang)
            print(f"  [{word}] saved → {out} ({out.stat().st_size // 1024} KB)")
        except Exception as e:
            print(f"  [{word}] FAILED: {e}")
            failed.append(word)
        time.sleep(1)  # be polite to the public endpoint
    if failed:
        print(f"\nFailed: {failed}")


if __name__ == "__main__":
    main()
