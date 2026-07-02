"""
Stitch multiple .pose files into ONE smooth, continuous pose sequence.

This mirrors sign.mt's own gloss-to-pose concatenation (the `spoken-to-signed`
package: reduce → normalize → trim at wrist-above-elbow signing boundaries →
cut at the best connection point between consecutive signs → bridge with a
0.2s interpolated gap → Savitzky-Golay smoothing → wrist correction → size
normalization). Playing one stitched file removes the per-clip fetch/parse
lag and the raise-hand/lower-hand dead time between letters and words, so
fingerspelling and sentences flow like natural signing.

Two modes:

  "words"  — sentences. Keeps each sign's natural rhythm: trim to the signing
             window, cut consecutive signs at their closest-matching frames,
             bridge with an interpolated gap. (sign.mt's algorithm as-is.)

  "spell"  — fingerspelling. Word-style connection cuts leave letters wildly
             uneven (a letter can survive as 3 frames — unreadable) and the
             dictionary's letter clips are inconsistent (some are full 25fps
             raise-hold-lower recordings, some are 3-5 static peak frames at
             30fps). So each letter is reduced to its central PEAK handshape,
             frozen for a fixed hold, and the interpolated gap morphs hand-up
             between letters — the uniform rhythm of real fingerspelling.
             Freezing peaks also makes the 25/30fps mix irrelevant.

We re-implement the ORCHESTRATION (instead of calling the library's
`concatenate_poses`) because the UI needs per-segment durations — to
highlight the current letter/word while the single file plays — and the
library doesn't expose where each segment landed after trimming and cuts.
"""

from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

import numpy as np
from pose_format import Pose
from pose_format.utils.generic import correct_wrists, normalize_pose_size, reduce_holistic
from spoken_to_signed.gloss_to_pose.concatenate import normalize_pose, trim_pose
from spoken_to_signed.gloss_to_pose.smoothing import (
    concatenate_poses as raw_concatenate,
    create_padding,
    find_best_connection_point,
    pose_savgol_filter,
)

POSES_DIR = Path(__file__).parent / "poses"
PADDING_S = 0.20     # interpolated transition gap between signs (sign.mt default)
SPELL_PEAK_S = 0.20  # how much of a letter's central held shape to keep
SPELL_HOLD_S = 0.35  # extra freeze on each letter so learners can read it


def _pose_file(name: str) -> Path:
    slug = name.lower().strip().replace(" ", "_")
    return POSES_DIR / f"{slug}.pose"


def _load(name: str) -> Pose:
    path = _pose_file(name)
    if not path.exists():
        raise FileNotFoundError(f"No pose file for '{name}'")
    with open(path, "rb") as f:
        return Pose.read(f.read())


def _freeze_tail(pose: Pose, seconds: float, fps: float) -> None:
    frames = int(round(seconds * fps))
    if frames <= 0:
        return
    body = pose.body
    body.data = np.ma.concatenate([body.data, np.ma.stack([body.data[-1]] * frames)])
    body.confidence = np.concatenate([body.confidence, np.stack([body.confidence[-1]] * frames)])


def _central_peak(pose: Pose, seconds: float) -> None:
    """Slice the pose down to the central `seconds` of its signing window."""
    length = len(pose.body.data)
    keep = max(1, int(round(seconds * pose.body.fps)))
    if length <= keep:
        return
    mid = length // 2
    first = max(0, mid - keep // 2)
    pose.body = pose.body[first:first + keep]


@lru_cache(maxsize=128)
def build_sequence(names: tuple[str, ...], mode: str = "words") -> tuple[bytes, tuple[int, ...]]:
    """Returns (pose_file_bytes, per_segment_duration_ms on the final timeline)."""
    if not names:
        raise ValueError("names must be non-empty")

    poses = [_load(n) for n in names]
    poses = [reduce_holistic(p) for p in poses]
    poses = [normalize_pose(p) for p in poses]

    if len(poses) == 1 and mode == "words":
        single = poses[0]
        correct_wrists(single)
        normalize_pose_size(single)
        ms = round(len(single.body.data) / single.body.fps * 1000)
        return _serialize(single), (ms,)

    # Output timeline runs at the first pose's fps (frames are concatenated
    # as-is). In spell mode every kept frame is a static peak, so source-fps
    # differences can't distort any visible motion.
    fps = poses[0].body.fps

    if mode == "spell":
        for pose in poses:
            trim_pose(pose, True, True)
            _central_peak(pose, SPELL_PEAK_S)
            _freeze_tail(pose, SPELL_HOLD_S, fps)
    else:
        # Keep the first sign's natural lead-in and the last sign's natural
        # settle; trim everything else to the active signing window.
        poses = [trim_pose(p, i > 0, i < len(poses) - 1) for i, p in enumerate(poses)]

        # Cut each pair at their closest matching frames (same as
        # smooth_concatenate_poses, done inline to record segment lengths).
        start = 0
        for i, pose in enumerate(poses):
            if i != len(poses) - 1:
                end, next_start = find_best_connection_point(poses[i], poses[i + 1])
            else:
                end, next_start = len(pose.body.data), None
            pose.body = pose.body[start:end]
            start = next_start

    # Measure segments BEFORE stitching — raw_concatenate appends the padding
    # onto each non-last pose in place, which would double-count it here.
    pad_frames = int(round(PADDING_S * fps)) if len(poses) > 1 else 0
    seg_frames = [
        len(p.body.data) + (pad_frames if i < len(poses) - 1 else 0)
        for i, p in enumerate(poses)
    ]

    if len(poses) == 1:
        stitched = poses[0]
    else:
        padding = create_padding(PADDING_S, poses[0])
        stitched = raw_concatenate(poses, padding)
        stitched = pose_savgol_filter(stitched)

    correct_wrists(stitched)
    normalize_pose_size(stitched)

    durations_ms = tuple(round(f / fps * 1000) for f in seg_frames)
    return _serialize(stitched), durations_ms


def _serialize(pose: Pose) -> bytes:
    buf = io.BytesIO()
    pose.write(buf)
    return buf.getvalue()
