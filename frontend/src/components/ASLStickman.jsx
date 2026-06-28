import { useEffect, useRef, useState, useCallback } from "react";
import { ASL_POSES, HAND_CONNECTIONS } from "../utils/aslHandPoses";
import { defineCustomElements } from "pose-viewer/loader";

const W = 320;
const H = 460;

// ── Body drawing ────────────────────────────────────────────────────────────

function drawBody(ctx, highlightHand = true) {
  ctx.strokeStyle = "#A78BFA";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const cx = W / 2;

  // head
  ctx.beginPath();
  ctx.arc(cx, 52, 26, 0, Math.PI * 2);
  ctx.strokeStyle = "#A78BFA";
  ctx.stroke();

  // torso
  line(ctx, cx, 78, cx, 200);

  // left arm
  line(ctx, cx, 100, cx - 55, 165);
  line(ctx, cx - 55, 165, cx - 65, 210);

  // right arm (hand side — slightly raised)
  ctx.strokeStyle = highlightHand ? "#F472B6" : "#A78BFA";
  line(ctx, cx, 100, cx + 55, 152);
  line(ctx, cx + 55, 152, cx + 52, 192);
  ctx.strokeStyle = "#A78BFA";

  // legs
  line(ctx, cx, 200, cx - 35, 290);
  line(ctx, cx, 200, cx + 35, 290);
  line(ctx, cx - 35, 290, cx - 30, 370);
  line(ctx, cx + 35, 290, cx + 30, 370);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// ── Hand drawing (ported from pose-viewer canvas renderer) ──────────────────

// Map normalized [0,1] hand coords into the canvas hand region.
// Hand floats near the right shoulder/wrist area.
const HAND_REGION = { x: 135, y: 168, w: 168, h: 268 };

function mapPt([nx, ny]) {
  return [
    HAND_REGION.x + nx * HAND_REGION.w,
    HAND_REGION.y + ny * HAND_REGION.h,
  ];
}

function drawHand(ctx, landmarks, alpha = 1) {
  if (!landmarks) return;

  // limbs — same approach as pose-viewer renderLimb
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // All bones in one stroke call
  ctx.strokeStyle = `rgba(248, 113, 113, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const [x1, y1] = mapPt(landmarks[a]);
    const [x2, y2] = mapPt(landmarks[b]);
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // All joints in one fill call
  ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
  ctx.beginPath();
  for (const pt of landmarks) {
    const [x, y] = mapPt(pt);
    ctx.moveTo(x + 3.5, y);
    ctx.arc(x, y, 3.5, 0, 6.283);
  }
  ctx.fill();
}

// ── Letter label ─────────────────────────────────────────────────────────────

function drawLabel(ctx, letter, frameIdx, total) {
  ctx.fillStyle = "rgba(167, 139, 250, 0.9)";
  ctx.font = "bold 38px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(letter === " " ? "SPACE" : letter, W / 2, H - 18);

  // progress dots
  const dotR = 4, gap = 12;
  const startX = W / 2 - ((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, H - 52, dotR, 0, Math.PI * 2);
    ctx.fillStyle = i === frameIdx ? "#F472B6" : "rgba(255,255,255,0.25)";
    ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ASLStickman() {
  const canvasRef = useRef(null);
  const [inputText, setInputText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [letters, setLetters] = useState([]);
  const intervalRef = useRef(null);

  const getLetters = (text) =>
    text
      .toUpperCase()
      .split("")
      .filter((c) => c === " " || ASL_POSES[c]);

  // Draw the current frame
  const drawFrame = useCallback((lts, idx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const letter = lts[idx];
    drawBody(ctx, true);
    drawHand(ctx, letter ? ASL_POSES[letter] : null);
    if (letter) drawLabel(ctx, letter, idx, lts.length);
  }, []);

  // Idle animation: show open hand
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || playing) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    drawBody(ctx, false);
    drawHand(ctx, ASL_POSES[" "]);

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Type a word and press Play", W / 2, H - 18);
  }, [playing, drawFrame]);

  // Play through letters
  const handlePlay = () => {
    const lts = getLetters(inputText);
    if (lts.length === 0) return;
    clearInterval(intervalRef.current);
    setLetters(lts);
    setFrameIdx(0);
    drawFrame(lts, 0);
    setPlaying(true);

    let i = 0;
    intervalRef.current = setInterval(() => {
      i += 1;
      if (i >= lts.length) {
        clearInterval(intervalRef.current);
        setPlaying(false);
        return;
      }
      setFrameIdx(i);
      drawFrame(lts, i);
    }, 850);
  };

  const handleStop = () => {
    clearInterval(intervalRef.current);
    setPlaying(false);
    setLetters([]);
    setFrameIdx(0);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  // Register pose-viewer Stencil web component (from sign/translate ecosystem)
  useEffect(() => { defineCustomElements(); }, []);

  const [poseUrl, setPoseUrl] = useState("");
  const [activePoseUrl, setActivePoseUrl] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
      <p style={{ color: "var(--stickman-label-color)", margin: 0, fontSize: "0.85rem" }}>
        Stickman renderer adapted from{" "}
        <a
          href="https://github.com/sign/translate"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--primary)" }}
        >
          sign/translate
        </a>{" "}
        pose-viewer canvas renderer
      </p>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(167, 139, 250, 0.3)",
        }}
      />

      <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: `${W}px` }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !playing && handlePlay()}
          placeholder="Type a word (e.g. HELLO)"
          disabled={playing}
          style={{ flex: 1 }}
          maxLength={40}
        />
        <button
          type="button"
          onClick={playing ? handleStop : handlePlay}
          disabled={!playing && !inputText.trim()}
          style={{
            width: "auto",
            padding: "10px 18px",
            background: playing ? "var(--danger)" : "var(--primary)",
            color: "#ffffff"
          }}
        >
          {playing ? "Stop" : "Play"}
        </button>
      </div>

      {letters.length > 0 && (
        <p style={{ color: "var(--stickman-label-color)", margin: 0, fontSize: "0.85rem" }}>
          Signing:{" "}
          {letters.map((l, i) => (
            <span
              key={i}
              style={{
                color: i === frameIdx ? "var(--secondary)" : "var(--stickman-btn-inactive-color)",
                fontWeight: i === frameIdx ? "bold" : "normal",
                marginRight: "3px",
              }}
            >
              {l === " " ? "·" : l}
            </span>
          ))}
        </p>
      )}

      {/* ── pose-viewer section (sign/translate web component) ── */}
      <div
        style={{
          width: "100%",
          maxWidth: `${W}px`,
          borderTop: "1px solid rgba(167,139,250,0.2)",
          paddingTop: "16px",
        }}
      >
        <p style={{ color: "var(--stickman-label-color)", fontSize: "0.8rem", margin: "0 0 10px 0" }}>
          Load a <code>.pose</code> file from the{" "}
          <a href="https://github.com/sign/translate" target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
            sign/translate
          </a>{" "}
          ecosystem for full-body animations:
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={poseUrl}
            onChange={(e) => setPoseUrl(e.target.value)}
            placeholder="Paste a .pose file URL…"
            style={{ flex: 1, fontSize: "0.8rem" }}
          />
          <button
            type="button"
            onClick={() => setActivePoseUrl(poseUrl.trim())}
            disabled={!poseUrl.trim()}
            style={{ width: "auto", padding: "8px 14px", fontSize: "0.8rem" }}
          >
            Load
          </button>
        </div>

        {activePoseUrl && (
          <pose-viewer
            src={activePoseUrl}
            autoplay
            loop
            background="#0F172A"
            style={{
              display: "block",
              width: "100%",
              height: "280px",
              marginTop: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          />
        )}
      </div>
    </div>
  );
}
