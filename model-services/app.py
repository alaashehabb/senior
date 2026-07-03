import io
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

POSES_DIR = Path(__file__).parent / "poses"
POSES_DIR.mkdir(exist_ok=True)

app = FastAPI(title="SLR Model Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mock prediction (existing endpoint) ──────────────────────────────────────

AR_LETTERS = ["ا", "ب", "ت", "ث", "ج"]
EN_LETTERS = ["A", "B", "C", "D", "E"]
AR_WORDS   = ["مرحبا", "شكرا", "نعم", "لا"]
EN_WORDS   = ["hello", "thanks", "yes", "no"]


@app.get("/health")
def health():
    return {"status": "ok", "service": "model-services"}


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "model-services",
        "message": "Model service is running. Use /predict or /health.",
    }


class PredictRequest(BaseModel):
    language: str
    mode: str
    landmarks: list[float] | None = None
    imageBase64: str | None = None
    videoBase64: str | None = None


@app.post("/predict")
def predict(payload: PredictRequest):
    language = payload.language.lower()
    mode     = payload.mode.lower()
    if language not in {"ar", "en"} or mode not in {"letters", "words"}:
        return {"message": "Invalid language or mode"}

    if language == "en" and mode == "letters":
        try:
            from asl_mlp_inference import predict_letter

            result = predict_letter(
                image_base64=payload.imageBase64,
                landmarks=payload.landmarks,
            )
            return {"prediction": result}
        except FileNotFoundError as exc:
            return {"message": str(exc)}
        except Exception as exc:
            return {"message": f"ASL model inference failed: {exc}"}

    if language == "ar" and mode == "letters":
        try:
            from arsl_mlp_inference import predict_letter

            result = predict_letter(
                image_base64=payload.imageBase64,
                landmarks=payload.landmarks,
            )
            return {"prediction": result}
        except FileNotFoundError as exc:
            return {"message": str(exc)}
        except Exception as exc:
            return {"message": f"ArSL model inference failed: {exc}"}

    if language == "ar" and mode == "words":
        if not payload.videoBase64:
            return {"prediction": {"text": "", "message": "videoBase64 is required for Arabic words mode (video clip needed)"}}
        try:
            from arsl_word_inference import predict_word
            
            result = predict_word(video_base64=payload.videoBase64)
            return {"prediction": result}
        except FileNotFoundError as exc:
            return {"prediction": {"text": "", "message": str(exc)}}
        except Exception as exc:
            return {"prediction": {"text": "", "message": f"Inference failed: {exc}"}}
            
    if not payload.landmarks and not payload.imageBase64 and not payload.videoBase64:
        return {"message": "landmarks, imageBase64, or videoBase64 is required"}

    if language == "en" and mode == "words":
        if not payload.videoBase64:
            return {"message": "videoBase64 is required for English words mode"}
            
        try:
            from en_word_inference import predict_word
            
            result = predict_word(video_base64=payload.videoBase64)
            return {"prediction": result}
        except FileNotFoundError as exc:
            return {"prediction": {"text": "", "message": str(exc)}}
        except Exception as exc:
            return {"prediction": {"text": "", "message": f"Inference failed: {exc}"}}

    text = (AR_LETTERS if language == "ar" else EN_LETTERS)[0]
    return {"prediction": {"text": text, "confidence": 0.85, "source": "mock"}}


# ── ASL Pose endpoints ────────────────────────────────────────────────────────

def _check_lang(lang: str) -> str:
    if lang not in ("en", "ar"):
        raise HTTPException(status_code=400, detail="lang must be 'en' or 'ar'")
    return lang


def _parse_seq_params(items: str, mode: str) -> tuple[tuple[str, ...], str]:
    names = tuple(n.strip().lower() for n in items.split(",") if n.strip())
    if not names:
        raise HTTPException(status_code=400, detail="items is required (comma-separated)")
    if len(names) > 30:
        raise HTTPException(status_code=400, detail="Too many items (max 30)")
    if mode not in ("words", "spell"):
        raise HTTPException(status_code=400, detail="mode must be 'words' or 'spell'")
    return names, mode


@app.get("/api/pose-seq")
def get_pose_seq(items: str, mode: str = "words", lang: str = "en"):
    """
    One smooth, continuous .pose stitched from several signs — sign.mt's own
    concatenation (trim/connect/interpolate/smooth), so sentence playback and
    fingerspelling flow like natural signing instead of separate clips.
    mode="spell" holds each letter's peak handshape at a uniform rhythm.
    """
    names, mode = _parse_seq_params(items, mode)
    try:
        from pose_concat import build_sequence
        data, _ = build_sequence(names, mode, _check_lang(lang))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/api/pose-seq/meta")
def get_pose_seq_meta(items: str, mode: str = "words", lang: str = "en"):
    """Per-segment durations (ms, final stitched timeline) for UI highlights."""
    names, mode = _parse_seq_params(items, mode)
    try:
        from pose_concat import build_sequence
        _, durations = build_sequence(names, mode, _check_lang(lang))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"items": list(names), "durations_ms": list(durations), "total_ms": sum(durations)}


def _pose_text_meta(text: str, lang: str) -> dict:
    from pose_concat import build_text_sequence
    _, meta = build_text_sequence(text.strip().lower(), lang)
    return {
        "tokens": [
            {
                "text": t, "mode": mode, "start_ms": start, "duration_ms": dur,
                "letters": [{"ch": ch, "start_ms": ls, "duration_ms": ld} for ch, ls, ld in letters],
            }
            for t, mode, start, dur, letters in meta
        ],
        "total_ms": meta[-1][2] + meta[-1][3] if meta else 0,
    }


@app.get("/api/pose-text")
def get_pose_text(text: str, lang: str = "en"):
    """
    Sign a whole typed sentence as ONE stitched pose: words with a dictionary
    .pose are signed, unknown words are fingerspelled letter by letter
    (sign.mt's behaviour for out-of-vocabulary words).
    """
    try:
        from pose_concat import build_text_sequence
        data, _ = build_text_sequence(text.strip().lower(), _check_lang(lang))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Response(content=data, media_type="application/octet-stream",
                    headers={"Cache-Control": "no-cache"})


@app.get("/api/pose-text/meta")
def get_pose_text_meta(text: str, lang: str = "en"):
    """Token/letter timings for the stitched sentence, for UI highlighting."""
    try:
        return _pose_text_meta(text, _check_lang(lang))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


def _pose_path(word: str, lang: str = "en") -> Path:
    slug = word.lower().replace(" ", "_").replace("%20", "_")
    base = POSES_DIR / "ar" if lang == "ar" else POSES_DIR
    path = base / f"{slug}.pose"
    if not path.exists():
        # Arabic orthography fold (ام ↔ أم etc.) — same resolution the
        # sentence plan builder uses, so viewer and free-text agree.
        from pose_concat import resolve_pose_name
        resolved = resolve_pose_name(word, lang)
        if resolved is not None:
            return base / f"{resolved}.pose"
    return path


@app.get("/api/poses/{word}")
def get_pose(word: str, lang: str = "en"):
    """
    Serve a pre-generated .pose file for a given ASL word.
    Run  python generate_asl_poses.py  first to populate the poses/ folder.
    """
    path = _pose_path(word, _check_lang(lang))
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No pose file for '{word}'. "
                   f"Run: python generate_asl_poses.py {word.lower()}"
        )
    from urllib.parse import quote
    return Response(
        content=path.read_bytes(),
        media_type="application/octet-stream",
        headers={
            # RFC 5987 form — plain filename="…" breaks on non-latin-1 names
            # (Arabic pose files) because HTTP headers are latin-1 only.
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(path.name)}",
            "Cache-Control": "no-cache",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000)


@app.head("/api/poses/{word}")
def head_pose(word: str, lang: str = "en"):
    """Lightweight existence check used by the frontend."""
    path = _pose_path(word, _check_lang(lang))
    if not path.exists():
        raise HTTPException(status_code=404)
    return Response(headers={"Content-Length": str(path.stat().st_size)})


@app.get("/api/poses")
def list_poses(lang: str = "en"):
    """List which words have pre-generated .pose files ready."""
    base = POSES_DIR / "ar" if _check_lang(lang) == "ar" else POSES_DIR
    available = sorted(p.stem.replace("_", " ") for p in base.glob("*.pose"))
    return {"available": available, "count": len(available)}


@app.post("/api/poses/{word}/upload")
async def upload_pose_video(word: str, video: UploadFile = File(...)):
    """
    Accept a video upload (webcam recording or local file), run MediaPipe
    Holistic on it, and save the resulting .pose file for the given word.

    This lets you record your own ASL signs instead of downloading from YouTube.
    """
    try:
        from asl_pipeline import video_bytes_to_pose
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Pipeline not ready: {e}")

    video_bytes = await video.read()
    if len(video_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Video too small / empty")

    try:
        pose_bytes = video_bytes_to_pose(video_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pose extraction failed: {e}")

    out = _pose_path(word)
    out.write_bytes(pose_bytes)

    return {
        "word": word,
        "pose_file": str(out),
        "size_kb": len(pose_bytes) // 1024,
        "url": f"/api/poses/{word}",
    }
