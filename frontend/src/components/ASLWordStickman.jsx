import { useCallback, useEffect, useRef, useState } from "react";
import { defineCustomElements } from "pose-viewer/loader";
import { ASL_POSES, HAND_CONNECTIONS } from "../utils/aslHandPoses";
import { WORD_ANIMS, WORD_LIST, RN, LN } from "../utils/aslWordPoses";

const MODEL_SERVICE = "http://localhost:8000";

const W = 320;
const H = 500;
const HAND_SCALE = 112;

// ── Body constants ────────────────────────────────────────────────────────────
const RS = [215, 108]; // right shoulder
const LS = [105, 108]; // left  shoulder
const UPPER = 65;
const FORE  = 65;
const R_HINT = [278, 165];
const L_HINT = [42,  165];

const SPEED_MULT = { slow: 1.0, normal: 0.52 };

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE = {
  linear:      t => t,
  easeIn:      t => t ** 3,
  easeOut:     t => 1 - (1 - t) ** 3,
  easeInOut:   t => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  easeOutBack: t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

// ── 2-joint IK ────────────────────────────────────────────────────────────────
function solveArm([sx, sy], [wx, wy], upper, fore, [hx, hy]) {
  const dx = wx - sx, dy = wy - sy;
  const d  = Math.max(Math.abs(upper - fore) + 0.5,
                      Math.min(Math.hypot(dx, dy), upper + fore - 0.5));
  const a  = Math.acos(Math.max(-1, Math.min(1,
               (upper * upper + d * d - fore * fore) / (2 * upper * d))));
  const base = Math.atan2(dy, dx);
  const e1 = [sx + Math.cos(base + a) * upper, sy + Math.sin(base + a) * upper];
  const e2 = [sx + Math.cos(base - a) * upper, sy + Math.sin(base - a) * upper];
  return Math.hypot(e1[0]-hx, e1[1]-hy) < Math.hypot(e2[0]-hx, e2[1]-hy) ? e1 : e2;
}

// ── Drawing — fully batched, one stroke/fill per color ────────────────────────

// One hand: 1 stroke call for all bones + 1 fill call for all joints
function drawHand(ctx, key, wx, wy) {
  const lms = (key && ASL_POSES[key]) || ASL_POSES.B;
  if (!lms) return;
  const [orx, ory] = lms[0]; // wrist landmark origin
  const px = n => wx + (n - orx) * HAND_SCALE;
  const py = n => wy + (n - ory) * HAND_SCALE;

  ctx.strokeStyle = "rgba(248,113,113,0.90)";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.moveTo(px(lms[a][0]), py(lms[a][1]));
    ctx.lineTo(px(lms[b][0]), py(lms[b][1]));
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(251,191,36,0.92)";
  ctx.beginPath();
  for (const [lx, ly] of lms) {
    ctx.moveTo(px(lx) + 3, py(ly));       // moveTo needed before each arc
    ctx.arc(px(lx), py(ly), 3, 0, 6.283);
  }
  ctx.fill();
}

// Full scene: 2 stroke calls (purple body+left arm, pink right arm) + 4 hand calls
function drawScene(ctx, rWrist, lWrist, rHand, lHand, s = {}) {
  const headY = 55  + (s.headDY      ?? 0);
  const rSY   = RS[1] + (s.rShoulderDY ?? 0);
  const lSY   = LS[1] + (s.lShoulderDY ?? 0);
  const rS = [RS[0], rSY], lS = [LS[0], lSY];

  const lE = solveArm(lS, lWrist, UPPER, FORE, L_HINT);
  const rE = solveArm(rS, rWrist, UPPER, FORE, R_HINT);

  ctx.lineCap = "round";

  // Purple: body + left arm — everything in ONE beginPath→stroke
  ctx.strokeStyle = "#A78BFA";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(160, headY, 28, 0, 6.283);
  ctx.moveTo(160, headY + 28);  ctx.lineTo(160, Math.min(rSY, lSY));
  ctx.moveTo(lS[0], lS[1]);     ctx.lineTo(rS[0], rS[1]);
  ctx.moveTo(160, 108);         ctx.lineTo(160, 232);
  ctx.moveTo(135, 232);         ctx.lineTo(185, 232);
  ctx.moveTo(135, 232);         ctx.lineTo(115, 315);
  ctx.moveTo(185, 232);         ctx.lineTo(205, 315);
  ctx.moveTo(115, 315);         ctx.lineTo(108, 395);
  ctx.moveTo(205, 315);         ctx.lineTo(212, 395);
  ctx.moveTo(lS[0], lS[1]);     ctx.lineTo(lE[0], lE[1]);
  ctx.moveTo(lE[0], lE[1]);     ctx.lineTo(lWrist[0], lWrist[1]);
  ctx.stroke();

  // Pink: right arm — ONE beginPath→stroke
  ctx.strokeStyle = "#F472B6";
  ctx.beginPath();
  ctx.moveTo(rS[0], rS[1]);    ctx.lineTo(rE[0], rE[1]);
  ctx.moveTo(rE[0], rE[1]);    ctx.lineTo(rWrist[0], rWrist[1]);
  ctx.stroke();

  drawHand(ctx, rHand, rWrist[0], rWrist[1]);
  drawHand(ctx, lHand, lWrist[0], lWrist[1]);
}

// ── Lerp ──────────────────────────────────────────────────────────────────────
const lerpW = (a, b, t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
const lerpN = (a = 0, b = 0, t) => a + (b-a)*t;

// ── Component ─────────────────────────────────────────────────────────────────
export default function ASLWordStickman() {
  const canvasRef = useRef(null);
  const ctxRef    = useRef(null);   // cached 2D context — never re-fetched
  const rafRef    = useRef(null);
  const breathRef = useRef(null);

  const [selected,    setSelected]    = useState("HELLO");
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [speed,       setSpeed]       = useState("slow");
  const [poseUrl,     setPoseUrl]     = useState(null);   // set when real .pose exists
  const [viewMode,    setViewMode]    = useState("canvas"); // "canvas" | "pose-viewer"

  // Cache context once on mount + register pose-viewer web component
  useEffect(() => {
    ctxRef.current = canvasRef.current?.getContext("2d");
    defineCustomElements();
  }, []);

  // Check whether the model service has a real .pose file for the selected word
  useEffect(() => {
    const slug = selected.toLowerCase().replace(/ /g, "_");
    const url  = `${MODEL_SERVICE}/api/poses/${slug}`;
    fetch(url, { method: "HEAD" })
      .then(r => { setPoseUrl(r.ok ? url : null); })
      .catch(() => setPoseUrl(null));
  }, [selected]);

  // ── Idle breathing ──────────────────────────────────────────────────────
  const startBreathing = useCallback(() => {
    cancelAnimationFrame(breathRef.current);
    const t0 = performance.now();
    const breathe = (now) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const dy = Math.sin((now - t0) / 909) * 2.2;   // ~1.1 Hz
      ctx.clearRect(0, 0, W, H);
      drawScene(ctx, RN, LN, null, null, {
        headDY: dy * 0.4, rShoulderDY: dy * 0.6, lShoulderDY: dy * 0.6,
      });
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("▶ Press Play to sign", W / 2, H - 18);
      breathRef.current = requestAnimationFrame(breathe);
    };
    breathRef.current = requestAnimationFrame(breathe);
  }, []);

  const stopBreathing = useCallback(() => cancelAnimationFrame(breathRef.current), []);

  // ── Play animation ──────────────────────────────────────────────────────
  const playWord = useCallback((wordKey, mult) => {
    cancelAnimationFrame(rafRef.current);
    stopBreathing();
    const anim = WORD_ANIMS[wordKey];
    if (!anim) return;
    setIsPlaying(true);

    const frames = anim.frames;
    let fIdx = 0, fStart = null;

    const tick = (now) => {
      if (fStart === null) fStart = now;
      const elapsed = now - fStart;
      const frame   = frames[fIdx];
      const nextF   = frames[Math.min(fIdx + 1, frames.length - 1)];
      const moveDur = frame.dur * mult;
      const holdDur = (frame.hold ?? 0) * mult;
      const inHold  = elapsed >= moveDur;
      const rawT    = inHold ? 1 : elapsed / moveDur;
      const t       = inHold ? 1 : (EASE[frame.ease] ?? EASE.easeInOut)(rawT);

      // Wrist positions
      const rW = inHold ? (frame.rWrist ?? RN) : lerpW(frame.rWrist ?? RN, nextF.rWrist ?? RN, t);
      const lW = inHold ? (frame.lWrist ?? LN) : lerpW(frame.lWrist ?? LN, nextF.lWrist ?? LN, t);

      // State
      const state = {
        headDY:      inHold ? (frame.headDY      ?? 0) : lerpN(frame.headDY,      nextF.headDY,      t),
        rShoulderDY: inHold ? (frame.rShoulderDY ?? 0) : lerpN(frame.rShoulderDY, nextF.rShoulderDY, t),
        lShoulderDY: inHold ? (frame.lShoulderDY ?? 0) : lerpN(frame.lShoulderDY, nextF.lShoulderDY, t),
      };

      // Hand shape: snap at the midpoint of the transition
      const rHand = rawT < 0.5 ? frame.rHand : nextF.rHand;
      const lHand = rawT < 0.5 ? frame.lHand : nextF.lHand;

      // Draw
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        drawScene(ctx, rW, lW, rHand, lHand, state);

        // Progress dots — two batched fill passes
        const total  = frames.length - 1;
        const startX = W / 2 - (total * 11) / 2;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        for (let i = 0; i <= total; i++) {
          if (i !== fIdx) { ctx.moveTo(startX+i*11+4, H-18); ctx.arc(startX+i*11, H-18, 4, 0, 6.283); }
        }
        ctx.fill();
        ctx.fillStyle = inHold ? "#F472B6" : "#A78BFA";
        ctx.beginPath();
        ctx.arc(startX + fIdx * 11, H - 18, 4, 0, 6.283);
        ctx.fill();
      }

      // Advance
      if (elapsed >= moveDur + holdDur) {
        fIdx++; fStart = now;
        if (fIdx >= frames.length) {
          setIsPlaying(false);
          startBreathing();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopBreathing, startBreathing]);

  const stopAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    startBreathing();
  }, [startBreathing]);

  useEffect(() => {
    startBreathing();
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(breathRef.current);
    };
  }, [startBreathing]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>

      {/* Mode toggle — only show pose-viewer tab if a real pose exists */}
      <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(167,139,250,0.35)" }}>
        <button type="button" onClick={() => setViewMode("canvas")}
          style={{ width:"auto", padding:"6px 14px", fontSize:"0.76rem", border:"none", cursor:"pointer",
            background: viewMode==="canvas" ? "#7C3AED" : "transparent",
            color: viewMode==="canvas" ? "#fff" : "rgba(255,255,255,0.5)" }}>
          Canvas stickman
        </button>
        <button type="button" onClick={() => setViewMode("pose-viewer")}
          disabled={!poseUrl}
          title={poseUrl ? "sign.mt pose-viewer (real MediaPipe data)" : "Run: python generate_asl_poses.py to generate"}
          style={{ width:"auto", padding:"6px 14px", fontSize:"0.76rem", border:"none", cursor: poseUrl ? "pointer" : "not-allowed",
            background: viewMode==="pose-viewer" ? "#7C3AED" : "transparent",
            color: poseUrl ? (viewMode==="pose-viewer" ? "#fff" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.25)" }}>
          {poseUrl ? "sign.mt renderer ✓" : "sign.mt renderer (not ready)"}
        </button>
      </div>

      {/* sign.mt pose-viewer — exact same renderer as sign.mt */}
      {viewMode === "pose-viewer" && poseUrl ? (
        <pose-viewer
          src={poseUrl}
          autoplay
          loop
          background="#0F172A"
          style={{
            display: "block", width: `${W}px`, height: `${H}px`,
            borderRadius: "16px", border: "1px solid rgba(167,139,250,0.3)",
          }}
        />
      ) : (
        <canvas ref={canvasRef} width={W} height={H}
          style={{
            borderRadius: "16px",
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(167, 139, 250, 0.3)",
            display: "block",
          }}
        />
      )}

      {/* Word picker */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: `${W}px`, justifyContent: "center" }}>
        {WORD_LIST.map(w => (
          <button key={w} type="button" onClick={() => setSelected(w)}
            style={{
              width: "auto", padding: "5px 11px", fontSize: "0.76rem", cursor: "pointer",
              background: selected === w ? "#7C3AED" : "rgba(255,255,255,0.07)",
              border: `1px solid ${selected === w ? "#A78BFA" : "rgba(255,255,255,0.12)"}`,
              borderRadius: "8px",
              color: selected === w ? "#fff" : "rgba(255,255,255,0.65)",
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(167,139,250,0.35)" }}>
          {["slow", "normal"].map(s => (
            <button key={s} type="button" onClick={() => setSpeed(s)}
              style={{
                width: "auto", padding: "7px 16px", fontSize: "0.78rem", border: "none",
                background: speed === s ? "#7C3AED" : "transparent", cursor: "pointer",
                color: speed === s ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              {s === "slow" ? "🐢 Slow" : "⚡ Normal"}
            </button>
          ))}
        </div>
        <button type="button"
          onClick={isPlaying ? stopAnim : () => playWord(selected, SPEED_MULT[speed])}
          style={{
            width: "auto", padding: "9px 28px", fontSize: "0.92rem", borderRadius: "9px", cursor: "pointer",
            background: isPlaying ? "#EF4444" : "#7C3AED",
          }}
        >
          {isPlaying ? "◼ Stop" : "▶ Play"}
        </button>
      </div>

      {WORD_ANIMS[selected] && (
        <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "0.8rem", textAlign: "center" }}>
          <span style={{ color: "#F472B6", fontWeight: "600" }}>{selected}</span>
          {" — "}{WORD_ANIMS[selected].description}
        </p>
      )}
    </div>
  );
}
