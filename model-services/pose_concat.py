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
LANG_DIRS = {"en": POSES_DIR, "ar": POSES_DIR / "ar"}
PADDING_S = 0.20     # interpolated transition gap between signs (sign.mt default)
SPELL_PEAK_S = 0.20  # how much of a letter's central held shape to keep
SPELL_HOLD_S = 0.35  # extra freeze on each letter so learners can read it

AR_LETTERS = set("ابتثجحخدذرزسشصضطظعغفقكلمنهوي")
# Orthographic variants folded onto the base letters we have poses for.
AR_FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
                         "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ء": ""})
AR_DIACRITICS = set("ًٌٍَُِّْـ")


def _pose_file(name: str, lang: str = "en") -> Path:
    slug = name.lower().strip().replace(" ", "_")
    return LANG_DIRS[lang] / f"{slug}.pose"


def _load(name: str, lang: str = "en") -> Pose:
    path = _pose_file(name, lang)
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
def build_sequence(names: tuple[str, ...], mode: str = "words", lang: str = "en") -> tuple[bytes, tuple[int, ...]]:
    """Returns (pose_file_bytes, per_segment_duration_ms on the final timeline)."""
    if not names:
        raise ValueError("names must be non-empty")

    poses = [_load(n, lang) for n in names]
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


# ── Free-text → signed sequence ──────────────────────────────────────────────
# Tokenizes a typed sentence; tokens with a dictionary .pose are SIGNED,
# unknown tokens are FINGERSPELLED letter by letter (sign.mt's behaviour).
# Everything is stitched into one continuous pose with per-token / per-letter
# timings so the UI can highlight what's currently playing.

TOKEN_PAD_S = 0.30    # transition gap between tokens (word boundary pause)
LETTER_PAD_S = 0.20   # gap between letters inside a fingerspelled token
DIGIT_WORDS = {
    "en": {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five"},
    "ar": {"1": "واحد", "2": "اثنان", "3": "ثلاثة", "4": "اربعة", "5": "خمسة",
           "١": "واحد", "٢": "اثنان", "٣": "ثلاثة", "٤": "اربعة", "٥": "خمسة"},
}
SPELL_LETTERS = {
    "en": set("abcdefghijklmnopqrstuvwxyz"),
    "ar": AR_LETTERS,
}
MAX_TOKENS = 12
MAX_SEGMENTS = 80


def _tokenize(text: str, lang: str = "en") -> list[str]:
    text = text.lower()
    if lang == "ar":
        text = "".join(c for c in text if c not in AR_DIACRITICS)
    cleaned = "".join(c if (c.isalnum() or c in "' ") else " " for c in text)
    return [t.strip("'") for t in cleaned.split() if t.strip("'")]


def _fold(token: str, lang: str) -> str:
    """Orthographic normalization used for lookup fallback and spelling —
    NOT applied to the primary lookup, since dictionary files keep original
    spellings (e.g. ثلاثة keeps its ة)."""
    return token.translate(AR_FOLD) if lang == "ar" else token


def _fold_index(lang: str) -> dict[str, str]:
    """folded stem → actual file stem. Dictionary files keep proper Arabic
    orthography (أم.pose, آسف.pose) but users type bare spellings (ام, اسف)
    just as often as the reverse — folding BOTH sides is the only lookup
    that works in each direction. Rebuilt per call: the dir holds a few
    dozen files and can gain entries at runtime via the upload endpoint."""
    idx: dict[str, str] = {}
    d = LANG_DIRS[lang]
    if d.exists():
        for f in sorted(d.glob("*.pose")):
            folded = _fold(f.stem, lang)
            idx.setdefault(folded, f.stem)
            # The jos dictionary keys many nouns under their definite form
            # (القلب, السوق) while users type the bare noun (قلب, سوق) —
            # register an ال-stripped alias so both resolve to the file.
            if lang == "ar" and folded.startswith("ال") and len(folded) > 4:
                idx.setdefault(folded[2:], f.stem)
    return idx


def resolve_pose_name(name: str, lang: str = "en") -> str | None:
    """Actual file stem for `name` (exact match first, then fold-index)."""
    slug = name.lower().strip().replace(" ", "_")
    if _pose_file(slug, lang).exists():
        return slug
    return _fold_index(lang).get(_fold(slug, lang))


def _concat_with_pads(poses: list[Pose], pad_frames: list[int], fps: float) -> Pose:
    """Like the library's concatenate, but with a per-boundary padding length."""
    from pose_format.numpy import NumPyPoseBody

    datas, confs = [], []
    for i, p in enumerate(poses):
        datas.append(p.body.data)
        confs.append(p.body.confidence)
        if i < len(poses) - 1 and pad_frames[i] > 0:
            _, people, points, dims = p.body.data.shape
            datas.append(np.zeros((pad_frames[i], people, points, dims)))
            confs.append(np.zeros((pad_frames[i], people, points)))
    body = NumPyPoseBody(fps=fps, data=np.ma.concatenate(datas), confidence=np.concatenate(confs))
    body = body.interpolate(kind="linear")
    return Pose(header=poses[0].header, body=body)


@lru_cache(maxsize=128)
def build_text_sequence(text: str, lang: str = "en") -> tuple[bytes, tuple]:
    """
    Returns (pose_file_bytes, tokens_meta) where tokens_meta is a tuple of
    dict-like tuples: (token, mode, start_ms, duration_ms, letters) with
    letters = ((ch, start_ms, duration_ms), ...) for fingerspelled tokens.
    """
    tokens = _tokenize(text, lang)
    if not tokens:
        raise ValueError("No signable words in text")
    if len(tokens) > MAX_TOKENS:
        raise ValueError(f"Too many words (max {MAX_TOKENS})")

    spell_letters = SPELL_LETTERS[lang]
    digit_words = DIGIT_WORDS[lang]

    # plan: one entry per chip → ("sign", name) or ("spell", [letters]).
    # Greedy longest-phrase matching first: multi-word dictionary entries
    # ("thank you", "السلام عليكم") exist as ONE pose file, but naive
    # per-token lookup would split them into unknown singles and fingerspell
    # a word we actually have. Mirrored client-side for the chip preview.
    plan = []
    i = 0
    while i < len(tokens):
        matched = None
        for n in (3, 2):
            if i + n <= len(tokens):
                phrase = resolve_pose_name(" ".join(tokens[i:i + n]), lang)
                if phrase is not None:
                    matched = (phrase, n)
            if matched:
                break
        if matched:
            # stem → display form (file stems use _ for phrase spaces)
            plan.append(("sign", matched[0].replace("_", " ")))
            i += matched[1]
            continue

        tok = digit_words.get(tokens[i], tokens[i])
        resolved = resolve_pose_name(tok, lang)
        if resolved is not None:
            plan.append(("sign", resolved))
        else:
            folded = _fold(tok, lang)
            letters = [c for c in folded if c in spell_letters] or [
                digit_words[c] for c in folded if c in digit_words
            ]
            if letters:
                plan.append(("spell", letters))
        i += 1
    if not plan:
        raise ValueError("No signable words in text")
    if sum(len(p[1]) if p[0] == "spell" else 1 for p in plan) > MAX_SEGMENTS:
        raise ValueError("Sentence too long to fingerspell — shorten it")

    # Prepare every segment pose. Words keep their natural (trimmed) motion;
    # letters are reduced to a held peak handshape, like fingerspelling mode.
    segments = []  # (token_idx, letter_or_None, Pose)
    for t_idx, (mode, payload) in enumerate(plan):
        if mode == "sign":
            pose = normalize_pose(reduce_holistic(_load(payload, lang)))
            trim_pose(pose, t_idx > 0, t_idx < len(plan) - 1)
            segments.append((t_idx, None, pose))
        else:
            for ch in payload:
                pose = normalize_pose(reduce_holistic(_load(ch, lang)))
                trim_pose(pose, True, True)
                _central_peak(pose, SPELL_PEAK_S)
                segments.append((t_idx, ch, pose))

    fps = segments[0][2].body.fps
    for t_idx, ch, pose in segments:
        if ch is not None:
            _freeze_tail(pose, SPELL_HOLD_S, fps)

    # Per-boundary padding: short inside a fingerspelled word, longer between
    # tokens so word boundaries read clearly.
    pad_frames = []
    for (a_tok, _, _), (b_tok, _, _) in zip(segments, segments[1:]):
        gap = LETTER_PAD_S if a_tok == b_tok else TOKEN_PAD_S
        pad_frames.append(int(round(gap * fps)))

    poses = [s[2] for s in segments]
    if len(poses) == 1:
        stitched = poses[0]
    else:
        stitched = _concat_with_pads(poses, pad_frames, fps)
        stitched = pose_savgol_filter(stitched)
    correct_wrists(stitched)
    normalize_pose_size(stitched)

    # Timing metadata on the final timeline.
    tokens_meta = []
    frame_at = 0
    for s_idx, (t_idx, ch, pose) in enumerate(segments):
        frames = len(pose.body.data) + (pad_frames[s_idx] if s_idx < len(pad_frames) else 0)
        start_ms = round(frame_at / fps * 1000)
        dur_ms = round(frames / fps * 1000)
        mode, payload = plan[t_idx]
        if not tokens_meta or tokens_meta[-1]["index"] != t_idx:
            text_label = payload if mode == "sign" else "".join(payload)
            tokens_meta.append({
                "index": t_idx, "text": text_label, "mode": mode,
                "start_ms": start_ms, "duration_ms": 0, "letters": [],
            })
        tokens_meta[-1]["duration_ms"] += dur_ms
        if ch is not None:
            tokens_meta[-1]["letters"].append({"ch": ch, "start_ms": start_ms, "duration_ms": dur_ms})
        frame_at += frames

    return _serialize(stitched), tuple(
        (m["text"], m["mode"], m["start_ms"], m["duration_ms"],
         tuple((l["ch"], l["start_ms"], l["duration_ms"]) for l in m["letters"]))
        for m in tokens_meta
    )
