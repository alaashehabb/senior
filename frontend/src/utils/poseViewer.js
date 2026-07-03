// sign.mt-style skeleton rendering for word signs.
//
// The <pose-viewer> web component (npm `pose-viewer`, from the
// sign-language-processing project — the same renderer sign.mt uses) plays
// `.pose` files produced by MediaPipe Holistic. model-services generates and
// serves those files (see model-services/fetch_signmt_pose.py and the
// /api/poses* endpoints in app.py).
//
// Every helper takes a `lang` ("en" = ASL, "ar" = ArSL / Jordanian Sign
// Language) which maps to a per-language pose directory on the server.
// Words WITHOUT a .pose file fall back to the legacy hand-authored canvas
// animation (English only), so adding a new word's file later upgrades it
// automatically.

import { useEffect, useState } from "react";
import { defineCustomElements } from "pose-viewer/loader";

// Registers the <pose-viewer> custom element once for the whole app.
defineCustomElements();

// Pose files are served straight from model-services (FastAPI), not the Node
// backend — same host convention as the rest of the app's service URLs.
export const POSES_BASE = "http://localhost:8000";

export function poseUrl(word, lang = "en") {
  return `${POSES_BASE}/api/poses/${encodeURIComponent(word.toLowerCase())}?lang=${lang}`;
}

// One smooth .pose stitched server-side from several signs (sign.mt's own
// trim/connect/interpolate pipeline) — the difference between choppy
// clip-after-clip playback and natural continuous signing. mode "spell"
// holds each letter's peak at a uniform rhythm for fingerspelling.
export function poseSeqUrl(items, mode = "words", lang = "en") {
  const joined = items.map((i) => String(i).toLowerCase()).join(",");
  return `${POSES_BASE}/api/pose-seq?items=${encodeURIComponent(joined)}&mode=${mode}&lang=${lang}`;
}

// Per-segment durations on the stitched timeline, so the UI can highlight
// the letter/word currently playing with plain timers.
export async function fetchPoseSeqMeta(items, mode = "words", lang = "en") {
  const joined = items.map((i) => String(i).toLowerCase()).join(",");
  const res = await fetch(
    `${POSES_BASE}/api/pose-seq/meta?items=${encodeURIComponent(joined)}&mode=${mode}&lang=${lang}`
  );
  if (!res.ok) throw new Error(`pose-seq meta failed: ${res.status}`);
  return res.json();
}

// Which words have a .pose file right now for the given language. `null`
// while loading; on any failure resolves to an empty set so every word just
// uses the canvas fallback instead of a broken viewer.
export function usePoseWords(lang = "en") {
  const [poseWords, setPoseWords] = useState(null);
  // Consumers remount on language switch (key={lang}), so each hook instance
  // fetches exactly one language's list — no cross-language reset needed.
  useEffect(() => {
    let alive = true;
    fetch(`${POSES_BASE}/api/poses?lang=${lang}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setPoseWords(new Set(d.available || [])); })
      .catch(() => { if (alive) setPoseWords(new Set()); });
    return () => { alive = false; };
  }, [lang]);
  return poseWords;
}

// Arabic orthography folding, mirroring the server's AR_FOLD in
// pose_concat.py: dictionary files keep proper spellings (أم, آسف) while
// users type bare ones (ام, اسف) just as often — both sides fold before
// comparing so lookup works in either direction.
const AR_FOLD = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
                  "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ء": "" };
const AR_FOLD_RE = /[أإآٱىئؤةء]/g;

export function foldWord(word, lang = "en") {
  return lang === "ar" ? String(word).replace(AR_FOLD_RE, (c) => AR_FOLD[c]) : String(word);
}

export function hasPose(poseWords, word, lang = "en") {
  if (!poseWords) return false;
  const w = String(word).toLowerCase();
  if (poseWords.has(w)) return true;
  if (lang !== "ar") return false;
  const folded = foldWord(w, lang);
  for (const p of poseWords) {
    const pf = foldWord(p, lang);
    if (pf === folded) return true;
    // ال-stripped alias, mirroring the server's fold index: dictionary
    // files often carry the definite form (القلب) of a bare query (قلب).
    if (pf.startsWith("ال") && pf.length > 4 && pf.slice(2) === folded) return true;
  }
  return false;
}
