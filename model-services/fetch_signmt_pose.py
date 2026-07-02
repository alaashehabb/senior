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

Usage:
    python fetch_signmt_pose.py mother father "thank you"
    python fetch_signmt_pose.py --all      # every word in the education tab

New files land in poses/ and are picked up automatically by /api/poses and
the Education tab (words with a .pose file play as a sign.mt skeleton).
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

# Keep in sync with WORD_ANIMS in frontend/src/utils/aslWordPoses.js
EDUCATION_WORDS = [
    "hello", "thank you", "yes", "no", "please", "sorry", "i love you",
    "eat", "drink", "water", "more", "help", "stop", "go", "come", "learn",
    "name", "see", "want", "know", "finish",
    "me", "you", "mother", "father", "love",
    "happy", "sad", "cry",
    "where", "what",
    "now", "tomorrow",
    "one", "two", "three", "four", "five",
    # fingerspelling alphabet (per-letter clips used by the Fingerspelling tab)
    *"abcdefghijklmnopqrstuvwxyz",
]


def fetch_word(word: str) -> Path:
    params = urllib.parse.urlencode({"text": word.lower(), "spoken": "en", "signed": "ase"})
    with urllib.request.urlopen(f"{API}?{params}", timeout=60) as resp:
        data = resp.read()
    if len(data) < 1000 or b"POSE_LANDMARKS" not in data[:64]:
        raise ValueError(f"Response for '{word}' does not look like a .pose file ({len(data)} bytes)")
    out = POSES_DIR / f"{word.lower().replace(' ', '_')}.pose"
    out.write_bytes(data)
    return out


def main():
    args = sys.argv[1:]
    words = EDUCATION_WORDS if args == ["--all"] else [a.lower() for a in args]
    if not words:
        print(__doc__)
        sys.exit(1)
    for word in words:
        try:
            out = fetch_word(word)
            print(f"  [{word}] saved → {out} ({out.stat().st_size // 1024} KB)")
        except Exception as e:
            print(f"  [{word}] FAILED: {e}")
        time.sleep(1)  # be polite to the public endpoint


if __name__ == "__main__":
    main()
