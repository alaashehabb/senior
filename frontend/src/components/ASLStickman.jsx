import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASL_POSES, ASL_HINTS, MOTION_LETTERS } from "../utils/aslHandPoses";
import { COLORS, EASE, drawHand, lerpPose } from "../utils/aslRenderer";

const W = 340;
const H = 430;

// Where the signing hand's wrist sits, and how big the hand is drawn.
const WRIST = [232, 250];
const HAND_SCALE = 156;

// Timing (ms)
const MORPH = 260; // transition between two letters
const HOLD = 620;  // freeze on each letter so it can be read

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ── Static body: a stick figure with the right arm raised to present the hand ──
function drawBody(ctx) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = 3.5;

  // head + torso + left arm + legs — one purple pass
  ctx.beginPath();
  ctx.arc(150, 66, 26, 0, Math.PI * 2);          // head
  ctx.moveTo(150, 92);  ctx.lineTo(150, 250);    // torso
  ctx.moveTo(150, 120); ctx.lineTo(104, 178);    // left upper arm
  ctx.lineTo(96, 232);                            // left forearm (hanging)
  ctx.moveTo(150, 250); ctx.lineTo(120, 340);    // left thigh
  ctx.lineTo(116, 414);                           // left shin
  ctx.moveTo(150, 250); ctx.lineTo(184, 340);    // right thigh
  ctx.lineTo(190, 414);                           // right shin
  ctx.stroke();

  // right arm raised toward the hand — accent colour
  ctx.strokeStyle = COLORS.activeArm;
  ctx.beginPath();
  ctx.moveTo(150, 120);
  ctx.lineTo(210, 176);          // elbow
  ctx.lineTo(WRIST[0], WRIST[1]); // wrist
  ctx.stroke();
}

// J and Z are traced in the air. Return a small wrist offset over hold progress.
function motionOffset(letter, p) {
  if (letter === "J") {
    // hook down-and-curl to the left
    return [Math.sin(p * Math.PI) * 4, p < 0.6 ? p * 26 : (1 - p) * 26 * 1.5];
  }
  if (letter === "Z") {
    // trace a Z: right, diagonal, right
    if (p < 0.33) return [p / 0.33 * 34 - 17, -12];
    if (p < 0.66) return [17 - (p - 0.33) / 0.33 * 34, (p - 0.33) / 0.33 * 24 - 12];
    return [(p - 0.66) / 0.34 * 34 - 17, 12];
  }
  return [0, 0];
}

export default function ASLStickman() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const frameIdxRef = useRef(-1);

  const [inputText, setInputText] = useState("");
  const [letters, setLetters] = useState([]);
  const [frameIdx, setFrameIdx] = useState(-1); // which letter is showing (-1 = idle)
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(null); // single letter previewed from the grid

  const getLetters = (text) =>
    text.toUpperCase().split("").filter((c) => c === " " || ASL_POSES[c]);

  // ── One frame of the scene ──────────────────────────────────────────────────
  const drawScene = useCallback((pose, { letter, idx, total, label, offset = [0, 0] } = {}) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawBody(ctx);
    drawHand(ctx, pose, { ox: WRIST[0] + offset[0], oy: WRIST[1] + offset[1], scale: HAND_SCALE });

    // Big letter
    if (letter) {
      ctx.fillStyle = COLORS.body;
      ctx.font = "bold 40px Outfit, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(letter === " " ? "␣" : letter, 66, 92);
    }

    // Caption
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "13px Outfit, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, W / 2, H - 16);
    }

    // Progress dots
    if (total > 1) {
      const gap = Math.min(14, (W - 80) / total);
      const startX = W / 2 - ((total - 1) * gap) / 2;
      for (let i = 0; i < total; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * gap, H - 40, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = i === idx ? COLORS.activeArm : "rgba(255,255,255,0.22)";
        ctx.fill();
      }
    }
  }, []);

  // ── Idle / preview frame (no animation loop) ───────────────────────────────
  const drawIdle = useCallback(() => {
    if (preview && ASL_POSES[preview]) {
      drawScene(ASL_POSES[preview], {
        letter: preview,
        label: ASL_HINTS[preview] || "",
      });
      return;
    }
    drawScene(ASL_POSES[" "], { label: "Type a word, or tap a letter below" });
  }, [preview, drawScene]);

  // ── Playback ────────────────────────────────────────────────────────────────
  const play = useCallback((lts) => {
    cancelAnimationFrame(rafRef.current);
    setPreview(null);
    setLetters(lts);
    setPlaying(true);

    let i = 0;
    let start = null;
    const total = lts.length;

    const step = (now) => {
      if (start === null) start = now;
      const t = now - start;
      const letter = lts[i];
      const prev = i === 0 ? ASL_POSES[" "] : ASL_POSES[lts[i - 1]] || ASL_POSES[" "];
      const target = ASL_POSES[letter] || ASL_POSES[" "];

      if (t < MORPH) {
        // morph from previous letter to this one
        const k = EASE.easeInOut(t / MORPH);
        drawScene(lerpPose(prev, target, k), {
          letter, idx: i, total, label: ASL_HINTS[letter] || "",
        });
      } else {
        // hold — with J/Z air-tracing motion if applicable
        const hp = Math.min(1, (t - MORPH) / HOLD);
        const offset = MOTION_LETTERS.includes(letter) ? motionOffset(letter, hp) : [0, 0];
        drawScene(target, {
          letter, idx: i, total, label: ASL_HINTS[letter] || "", offset,
        });
      }

      if (frameIdxRef.current !== i) {
        frameIdxRef.current = i;
        setFrameIdx(i);
      }

      if (t >= MORPH + HOLD) {
        i += 1;
        start = now;
        if (i >= total) {
          setPlaying(false);
          setFrameIdx(-1);
          frameIdxRef.current = -1;
          return; // stop the loop; idle effect repaints
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [drawScene]);

  const handlePlay = () => {
    const lts = getLetters(inputText);
    if (lts.length) play(lts);
  };

  const handleStop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setLetters([]);
    setFrameIdx(-1);
    frameIdxRef.current = -1;
  }, []);

  // Cache context once
  useEffect(() => {
    ctxRef.current = canvasRef.current?.getContext("2d");
  }, []);

  // Repaint idle whenever we're not playing (also on preview change)
  useEffect(() => {
    if (!playing) drawIdle();
  }, [playing, drawIdle]);

  // Cleanup
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const signing = useMemo(() => letters.length > 0, [letters]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(167, 139, 250, 0.3)",
          maxWidth: "100%",
        }}
      />

      <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: `${W}px` }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !playing && handlePlay()}
          placeholder="Type a word (e.g. HELLO)"
          disabled={playing}
          maxLength={40}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={playing ? handleStop : handlePlay}
          disabled={!playing && !inputText.trim()}
          style={{
            width: "auto",
            padding: "10px 20px",
            background: playing ? "var(--danger)" : "var(--primary)",
            color: "#fff",
          }}
        >
          {playing ? "◼ Stop" : "▶ Play"}
        </button>
      </div>

      {signing && (
        <p style={{ color: "var(--stickman-label-color)", margin: 0, fontSize: "0.85rem", textAlign: "center" }}>
          {letters.map((l, i) => (
            <span
              key={i}
              style={{
                color: i === frameIdx ? "var(--secondary)" : "var(--stickman-btn-inactive-color)",
                fontWeight: i === frameIdx ? 700 : 400,
                marginRight: "3px",
              }}
            >
              {l === " " ? "·" : l}
            </span>
          ))}
        </p>
      )}

      {/* Alphabet reference — tap to preview a handshape */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(9, 1fr)",
          gap: "5px",
          width: "100%",
          maxWidth: `${W}px`,
        }}
      >
        {ALPHABET.map((c) => (
          <button
            key={c}
            type="button"
            disabled={playing}
            onClick={() => setPreview((p) => (p === c ? null : c))}
            title={ASL_HINTS[c]}
            style={{
              width: "auto",
              padding: "6px 0",
              fontSize: "0.8rem",
              borderRadius: "7px",
              cursor: playing ? "not-allowed" : "pointer",
              background: preview === c ? "var(--stickman-btn-active-bg)" : "var(--stickman-btn-inactive-bg)",
              border: `1px solid ${preview === c ? "var(--primary)" : "var(--stickman-btn-inactive-border)"}`,
              color: preview === c ? "var(--stickman-btn-active-color)" : "var(--stickman-btn-inactive-color)",
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
