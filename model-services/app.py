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


class PredictRequest(BaseModel):
    language: str
    mode: str
    landmarks: list[float]


@app.post("/predict")
def predict(payload: PredictRequest):
    language = payload.language.lower()
    mode     = payload.mode.lower()
    if language not in {"ar", "en"} or mode not in {"letters", "words"}:
        return {"message": "Invalid language or mode"}
    text = (AR_LETTERS if language == "ar" else EN_LETTERS)[0] if mode == "letters" \
        else (AR_WORDS if language == "ar" else EN_WORDS)[0]
    return {"prediction": {"text": text, "confidence": 0.85, "source": "mock"}}


# ── ASL Pose endpoints ────────────────────────────────────────────────────────

def _pose_path(word: str) -> Path:
    slug = word.lower().replace(" ", "_").replace("%20", "_")
    return POSES_DIR / f"{slug}.pose"


@app.get("/api/poses/{word}")
def get_pose(word: str):
    """
    Serve a pre-generated .pose file for a given ASL word.
    Run  python generate_asl_poses.py  first to populate the poses/ folder.
    """
    path = _pose_path(word)
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No pose file for '{word}'. "
                   f"Run: python generate_asl_poses.py {word.lower()}"
        )
    return Response(
        content=path.read_bytes(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{path.name}"',
            "Cache-Control": "no-cache",
        },
    )


@app.head("/api/poses/{word}")
def head_pose(word: str):
    """Lightweight existence check used by the frontend."""
    path = _pose_path(word)
    if not path.exists():
        raise HTTPException(status_code=404)
    return Response(headers={"Content-Length": str(path.stat().st_size)})


@app.get("/api/poses")
def list_poses():
    """List which words have pre-generated .pose files ready."""
    available = sorted(
        p.stem.replace("_", " ") for p in POSES_DIR.glob("*.pose")
    )
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
