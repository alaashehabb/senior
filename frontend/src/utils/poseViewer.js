// sign.mt-style skeleton rendering for word signs.
//
// The <pose-viewer> web component (npm `pose-viewer`, from the
// sign-language-processing project — the same renderer sign.mt uses) plays
// `.pose` files produced by MediaPipe Holistic. model-services generates and
// serves those files (see model-services/asl_pipeline.py and the /api/poses
// endpoints in app.py).
//
// Words WITHOUT a .pose file fall back to the legacy hand-authored canvas
// animation, so adding a new word's video later upgrades it automatically.

import { useEffect, useState } from "react";
import { defineCustomElements } from "pose-viewer/loader";

// Registers the <pose-viewer> custom element once for the whole app.
defineCustomElements();

// Pose files are served straight from model-services (FastAPI), not the Node
// backend — same host convention as the rest of the app's service URLs.
export const POSES_BASE = "http://localhost:8000";

export function poseUrl(word) {
  return `${POSES_BASE}/api/poses/${encodeURIComponent(word.toLowerCase())}`;
}

// One smooth .pose stitched server-side from several signs (sign.mt's own
// trim/connect/interpolate pipeline) — the difference between choppy
// clip-after-clip playback and natural continuous signing. mode "spell"
// holds each letter's peak at a uniform rhythm for fingerspelling.
export function poseSeqUrl(items, mode = "words") {
  const joined = items.map((i) => String(i).toLowerCase()).join(",");
  return `${POSES_BASE}/api/pose-seq?items=${encodeURIComponent(joined)}&mode=${mode}`;
}

// Per-segment durations on the stitched timeline, so the UI can highlight
// the letter/word currently playing with plain timers.
export async function fetchPoseSeqMeta(items, mode = "words") {
  const joined = items.map((i) => String(i).toLowerCase()).join(",");
  const res = await fetch(`${POSES_BASE}/api/pose-seq/meta?items=${encodeURIComponent(joined)}&mode=${mode}`);
  if (!res.ok) throw new Error(`pose-seq meta failed: ${res.status}`);
  return res.json();
}

// Which words have a .pose file right now. `null` while loading; on any
// failure resolves to an empty set so every word just uses the canvas
// fallback instead of a broken viewer.
export function usePoseWords() {
  const [poseWords, setPoseWords] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${POSES_BASE}/api/poses`)
      .then((r) => r.json())
      .then((d) => { if (alive) setPoseWords(new Set(d.available || [])); })
      .catch(() => { if (alive) setPoseWords(new Set()); });
    return () => { alive = false; };
  }, []);
  return poseWords;
}

export function hasPose(poseWords, word) {
  return Boolean(poseWords && poseWords.has(String(word).toLowerCase()));
}
