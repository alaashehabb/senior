"""
ASL Sign Pose Generator
=======================
Converts a video of an ASL sign into a .pose binary file using the exact same
MediaPipe Holistic pipeline that sign.mt (sign/translate) uses internally.

Dependencies (all already in the venv):
  mediapipe < 0.10.30   – provides Holistic landmark extraction
  pose-format            – builds/serialises the .pose binary format
  opencv-python-headless – video decoding
  yt-dlp                 – downloads sign videos from YouTube
"""

import io
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from pose_format import Pose
from pose_format.numpy import NumPyPoseBody
from pose_format.pose_header import PoseHeader, PoseHeaderComponent, PoseHeaderDimensions
from pose_format.utils.holistic import (
    holistic_components,
    load_holistic,
)

POSES_DIR = Path(__file__).parent / "poses"
POSES_DIR.mkdir(exist_ok=True)


def _find_node() -> Optional[str]:
    """Return the path to a node/nodejs binary for yt-dlp JS runtime."""
    import shutil
    for name in ("node", "nodejs"):
        p = shutil.which(name)
        if p:
            return p
    # common nvm location
    nvm = Path.home() / ".nvm" / "versions"
    for exe in nvm.glob("node/*/bin/node"):
        return str(exe)
    return None

# ── Curated YouTube video IDs for common ASL signs ────────────────────────────
# ⚠ SUPERSEDED (July 2026): every video ID below now returns "Video
# unavailable" on YouTube, so this download path is dead. New .pose content
# comes from sign.mt's public dictionary API instead — see
# fetch_signmt_pose.py. This pipeline is kept for the local-video path
# (generate_pose_from_file / the /api/poses/{word}/upload endpoint), which
# still works and lets you record signs yourself.
#
# Each entry: word → (youtube_id, start_sec, end_sec)
# Source: publicly available ASL tutorial channels (Bill Vicars / ASLU,
#         Signed With Heart, ASL Meredith) – all educational / public use.
# Timestamps are approximate; yt-dlp downloads only the relevant segment.
ASL_VIDEO_SOURCES: dict[str, tuple[str, float, float]] = {
    "hello":     ("Rnm25aFCGxs", 1.5,  4.0),
    "thank you": ("GlJrVMqXYrs", 0.5,  3.5),
    "yes":       ("zOmIkFYrWlA", 0.5,  3.5),
    "no":        ("8vZRBGM1UE8", 0.5,  3.5),
    "please":    ("k_1DLpFkH6o", 0.5,  4.0),
    "sorry":     ("0NpUPvCl-qs", 0.5,  3.5),
    "i love you":("2Lm0K2kXXoc", 0.5,  3.5),
    "eat":       ("7O4kxOAn1-0", 0.5,  3.5),
    "drink":     ("ynqEHr6KDTY", 0.5,  3.5),
    "water":     ("G8lTiVSqzco", 0.5,  3.5),
    "more":      ("G5Cp9wqxkwY", 0.5,  3.5),
    "help":      ("kX-DZWf7aA8", 0.5,  3.5),
    "stop":      ("OXuknXvCHvI", 0.5,  3.5),
    "go":        ("GFB5tjjLO7E", 0.5,  3.5),
    "come":      ("Y-LGfZOz1Fo", 0.5,  3.5),
    "learn":     ("oc2Dg6TqAiI", 0.5,  3.5),
    "name":      ("6rQh0xtUqbc", 0.5,  3.5),
}


def pose_path(word: str) -> Path:
    """Canonical .pose file path for a word."""
    slug = word.lower().replace(" ", "_")
    return POSES_DIR / f"{slug}.pose"


def video_bytes_to_pose(video_data: bytes,
                        fps_hint: float = 25.0,
                        start_sec: float = 0.0,
                        end_sec: Optional[float] = None) -> bytes:
    """
    Convert raw video bytes → .pose binary using MediaPipe Holistic.

    start_sec / end_sec trim the video so only the relevant sign is processed;
    trimming is done with OpenCV (no ffmpeg required).

    This is the exact same pipeline sign.mt uses:
      video frames → MediaPipe Holistic → pose_format.Pose → .pose bytes
    """
    tmp_path = tempfile.mktemp(suffix=".mp4")
    try:
        Path(tmp_path).write_bytes(video_data)
        cap = cv2.VideoCapture(tmp_path)
        fps    = cap.get(cv2.CAP_PROP_FPS) or fps_hint
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Seek to start position
        if start_sec > 0:
            cap.set(cv2.CAP_PROP_POS_MSEC, start_sec * 1000)

        end_ms = (end_sec * 1000) if end_sec is not None else float("inf")

        frames = []
        while cap.isOpened():
            pos_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
            if pos_ms > end_ms:
                break
            ok, frame = cap.read()
            if not ok:
                break
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        cap.release()
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not frames:
        raise ValueError("Could not decode any frames from video")

    # Run MediaPipe Holistic — identical to sign.mt's extraction
    pose: Pose = load_holistic(
        frames=frames,
        fps=fps,
        width=width,
        height=height,
        additional_holistic_config={
            "static_image_mode": False,
            "model_complexity": 1,
            "min_detection_confidence": 0.5,
            "min_tracking_confidence": 0.5,
        },
        progress=True,
    )

    buf = io.BytesIO()
    pose.write(buf)
    return buf.getvalue()


def video_file_to_pose(video_path: str,
                       start_sec: float = 0.0,
                       end_sec: Optional[float] = None) -> bytes:
    """Convert a local video file → .pose bytes, optionally trimmed."""
    return video_bytes_to_pose(Path(video_path).read_bytes(),
                               start_sec=start_sec, end_sec=end_sec)


def download_youtube_segment(video_id: str, start: float, end: float) -> bytes:
    """
    Download a time-limited segment of a YouTube video as MP4 bytes.
    Uses yt-dlp (installed in the venv).
    """
    python = sys.executable
    tmp = tempfile.mktemp(suffix=".mp4")

    duration = end - start

    node_path = _find_node()
    js_flag = f"--js-runtimes=node:{node_path}" if node_path else []

    cmd = [
        python, "-m", "yt_dlp",
        f"https://www.youtube.com/watch?v={video_id}",
        "--format", "best[height<=480][ext=mp4]/best[height<=480]",
        "--output", tmp,
        "--no-playlist",
        "--quiet",
        "--force-overwrites",
    ]
    if isinstance(js_flag, str):
        cmd.append(js_flag)
    elif js_flag:
        cmd.extend(js_flag)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    # yt-dlp may produce a .mp4 or .mp4.part or nothing — handle all cases
    candidates = [
        tmp,
        tmp.replace(".mp4", ".mp4.mp4"),
    ]
    # also check for yt-dlp generated filenames
    folder = Path(tmp).parent
    base   = Path(tmp).stem
    for f in folder.glob(f"{base}*"):
        if f.suffix in (".mp4", ".webm", ".mkv"):
            candidates.insert(0, str(f))

    data = b""
    for c in candidates:
        p = Path(c)
        if p.exists() and p.stat().st_size > 1000:
            data = p.read_bytes()
            p.unlink(missing_ok=True)
            break

    # clean up any leftovers
    for c in candidates:
        Path(c).unlink(missing_ok=True)

    if not data:
        raise RuntimeError(
            f"yt-dlp failed for {video_id}.\n"
            f"stdout: {result.stdout[:300]}\n"
            f"stderr: {result.stderr[:300]}"
        )

    return data


def generate_pose_for_word(word: str, force: bool = False) -> Path:
    """
    Full pipeline for one word:
      1. Look up curated YouTube video ID + timestamps
      2. Download the segment via yt-dlp
      3. Run MediaPipe Holistic
      4. Save as .pose file
    Returns the Path of the saved .pose file.
    """
    out = pose_path(word)
    if out.exists() and not force:
        print(f"  [skip] {word} — already generated at {out}")
        return out

    key = word.lower()
    if key not in ASL_VIDEO_SOURCES:
        raise ValueError(f"No video source configured for word: '{word}'. "
                         f"Add an entry to ASL_VIDEO_SOURCES in asl_pipeline.py.")

    vid_id, start, end = ASL_VIDEO_SOURCES[key]
    print(f"  [{word}] downloading YouTube video {vid_id} …")
    video_bytes = download_youtube_segment(vid_id, start, end)

    print(f"  [{word}] running MediaPipe Holistic, trimming {start}s–{end}s …")
    pose_bytes = video_bytes_to_pose(video_bytes, start_sec=start, end_sec=end)

    out.write_bytes(pose_bytes)
    print(f"  [{word}] saved → {out} ({len(pose_bytes)//1024} KB)")
    return out


def generate_pose_from_file(word: str, video_path: str,
                            start_sec: float = 0.0,
                            end_sec: Optional[float] = None) -> Path:
    """
    Process a local video file you already have.
    Optionally trim to start_sec–end_sec so only that sign is captured.
    """
    out = pose_path(word)
    trim = f" [{start_sec}s–{end_sec}s]" if end_sec is not None else ""
    print(f"  [{word}] processing {video_path}{trim} …")
    pose_bytes = video_file_to_pose(video_path, start_sec=start_sec, end_sec=end_sec)
    out.write_bytes(pose_bytes)
    print(f"  [{word}] saved → {out} ({len(pose_bytes)//1024} KB)")
    return out
