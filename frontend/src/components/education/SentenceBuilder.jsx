import { useCallback, useEffect, useRef, useState } from "react";
import { ASL_POSES } from "../../utils/aslHandPoses";
import { WORD_ANIMS, WORD_CATEGORIES, RN, LN } from "../../utils/aslWordPoses";
import { COLORS, EASE, drawHand, lerpXY, lerp, solveArm } from "../../utils/aslRenderer";
import { usePoseWords, hasPose, poseUrl, poseSeqUrl, fetchPoseSeqMeta } from "../../utils/poseViewer";

// Chain several ASLWordStickman signs into one sentence playback.
//
// This intentionally keeps its own copy of the scene-drawing and keyframe
// tick-loop logic (instead of importing it from ASLWordStickman.jsx) so a
// bug here can't regress the single-word panel, and vice versa. The two
// copies should stay in sync if the rendering math changes, but duplicating
// ~100 lines here is a deliberate, lower-risk tradeoff versus extracting a
// shared hook out of the most-used existing component.

const W = 320;
const H = 500;
const HAND_SCALE = 118;
const TAU = Math.PI * 2;

const RS = [215, 108];
const LS = [105, 108];
const UPPER = 65;
const FORE = 65;
const R_HINT = [278, 165];
const L_HINT = [42, 165];

const RELAXED = ASL_POSES[" "];
const SPEED_MULT = { slow: 1.0, normal: 0.55 };
const WORD_GAP_MS = 350; // pause between signs so word boundaries read clearly

function drawScene(ctx, rWrist, lWrist, rHand, lHand, s = {}, hint = {}) {
  const headY = 55 + (s.headDY ?? 0);
  const rSY = RS[1] + (s.rShoulderDY ?? 0);
  const lSY = LS[1] + (s.lShoulderDY ?? 0);
  const rS = [RS[0], rSY];
  const lS = [LS[0], lSY];
  const lE = solveArm(lS, lWrist, UPPER, FORE, hint.lElbow ?? L_HINT);
  const rE = solveArm(rS, rWrist, UPPER, FORE, hint.rElbow ?? R_HINT);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(160, headY, 28, 0, TAU);
  ctx.moveTo(160, headY + 28); ctx.lineTo(160, Math.min(rSY, lSY));
  ctx.moveTo(lS[0], lS[1]);    ctx.lineTo(rS[0], rS[1]);
  ctx.moveTo(160, 108);        ctx.lineTo(160, 232);
  ctx.moveTo(135, 232);        ctx.lineTo(185, 232);
  ctx.moveTo(135, 232);        ctx.lineTo(115, 315);
  ctx.moveTo(185, 232);        ctx.lineTo(205, 315);
  ctx.moveTo(115, 315);        ctx.lineTo(108, 395);
  ctx.moveTo(205, 315);        ctx.lineTo(212, 395);
  ctx.moveTo(lS[0], lS[1]);    ctx.lineTo(lE[0], lE[1]);
  ctx.lineTo(lWrist[0], lWrist[1]);
  ctx.stroke();

  ctx.strokeStyle = COLORS.activeArm;
  ctx.beginPath();
  ctx.moveTo(rS[0], rS[1]); ctx.lineTo(rE[0], rE[1]);
  ctx.lineTo(rWrist[0], rWrist[1]);
  ctx.stroke();

  drawHand(ctx, rHand ? ASL_POSES[rHand] : RELAXED, { ox: rWrist[0], oy: rWrist[1], scale: HAND_SCALE });
  drawHand(ctx, lHand ? ASL_POSES[lHand] : RELAXED, { ox: lWrist[0], oy: lWrist[1], scale: HAND_SCALE });

  return { rElbow: rE, lElbow: lE };
}

export default function SentenceBuilder() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const cancelledRef = useRef(false);
  const poseElRef = useRef(null); // the <pose-viewer> element, driven imperatively

  const [category, setCategory] = useState(WORD_CATEGORIES[0].id);
  const [sentence, setSentence] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const [speed, setSpeed] = useState("slow");
  // Which surface is showing: the sign.mt skeleton (default — also the idle
  // view) or the legacy canvas, which only appears while a word WITHOUT a
  // .pose file is actively playing.
  const [activeView, setActiveView] = useState("pose");

  const poseWords = usePoseWords();

  // While idle, preview the sentence's first word on the skeleton viewer.
  useEffect(() => {
    const el = poseElRef.current;
    if (!el || isPlaying) return;
    if (sentence.length > 0 && hasPose(poseWords, sentence[0])) {
      el.src = poseUrl(sentence[0]);
    }
  }, [sentence, poseWords, isPlaying]);

  const wordsInCategory = Object.keys(WORD_ANIMS).filter(
    (w) => WORD_ANIMS[w].category === category
  );

  useEffect(() => {
    ctxRef.current = canvasRef.current?.getContext("2d");
    // autoplay={false} can't reach a lazily-upgraded custom element through
    // JSX (false attributes are removed and the component defaults to true),
    // so force the properties here; playback is driven by playOnePoseWord.
    if (poseElRef.current) {
      poseElRef.current.autoplay = false;
      poseElRef.current.loop = false;
    }
  }, []);

  const drawIdle = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, RN, LN, null, null);
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.font = "13px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      sentence.length ? "▶ Press Play to sign the sentence" : "Add words below to build a sentence",
      W / 2,
      H - 16
    );
  }, [sentence.length]);

  // Plays one word's keyframes to completion. Resolves when done, or
  // immediately if cancelledRef flips true mid-playback (Stop button).
  const playOneWord = useCallback((wordKey, mult) => {
    return new Promise((resolve) => {
      const anim = WORD_ANIMS[wordKey];
      if (!anim?.frames) return resolve(); // pose-only entries have no canvas keyframes
      const frames = anim.frames;

      let fIdx = 0;
      let fStart = null;
      let prevR = RN, prevL = LN;
      let prevRHand = null, prevLHand = null;
      let prevState = { headDY: 0, rShoulderDY: 0, lShoulderDY: 0 };
      let rHint = R_HINT, lHint = L_HINT;

      const tick = (now) => {
        if (cancelledRef.current) return resolve();
        if (fStart === null) fStart = now;
        const elapsed = now - fStart;
        const frame = frames[fIdx];
        const moveDur = frame.dur * mult;
        const holdDur = (frame.hold ?? 0) * mult;
        const inHold = elapsed >= moveDur;
        const rawT = inHold ? 1 : elapsed / moveDur;
        const t = inHold ? 1 : (EASE[frame.ease] ?? EASE.easeInOut)(rawT);

        const rW = inHold ? (frame.rWrist ?? RN) : lerpXY(prevR, frame.rWrist ?? RN, t);
        const lW = inHold ? (frame.lWrist ?? LN) : lerpXY(prevL, frame.lWrist ?? LN, t);

        const state = {
          headDY: inHold ? (frame.headDY ?? 0) : lerp(prevState.headDY, frame.headDY ?? 0, t),
          rShoulderDY: inHold ? (frame.rShoulderDY ?? 0) : lerp(prevState.rShoulderDY, frame.rShoulderDY ?? 0, t),
          lShoulderDY: inHold ? (frame.lShoulderDY ?? 0) : lerp(prevState.lShoulderDY, frame.lShoulderDY ?? 0, t),
        };

        const rHand = rawT < 0.5 ? prevRHand : frame.rHand;
        const lHand = rawT < 0.5 ? prevLHand : frame.lHand;

        const ctx = ctxRef.current;
        if (ctx) {
          ctx.clearRect(0, 0, W, H);
          const { rElbow, lElbow } = drawScene(ctx, rW, lW, rHand, lHand, state, { rElbow: rHint, lElbow: lHint });
          rHint = rElbow;
          lHint = lElbow;
        }

        if (elapsed >= moveDur + holdDur) {
          prevR = frame.rWrist ?? RN;
          prevL = frame.lWrist ?? LN;
          prevRHand = frame.rHand;
          prevLHand = frame.lHand;
          prevState = {
            headDY: frame.headDY ?? 0,
            rShoulderDY: frame.rShoulderDY ?? 0,
            lShoulderDY: frame.lShoulderDY ?? 0,
          };
          fIdx++;
          fStart = now;
          if (fIdx >= frames.length) return resolve();
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  }, []);

  // Plays one .pose URL on the sign.mt skeleton viewer. Resolves on the
  // viewer's ended$ event, on cancellation (polled — the web component has
  // no abort API), or on a hard timeout so a bad file can never wedge the
  // sentence.
  const playPoseSrc = useCallback((url, rate) => {
    return new Promise((resolve) => {
      const el = poseElRef.current;
      if (!el) return resolve();

      let done = false;
      let pollId, capId;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(pollId);
        clearTimeout(capId);
        el.removeEventListener("ended$", finish);
        el.removeEventListener("loadeddata$", start);
        resolve();
      };
      const start = () => {
        el.playbackRate = rate;
        el.currentTime = 0;
        el.play();
      };

      el.addEventListener("ended$", finish);
      if (el.src === url) {
        start(); // already loaded — loadeddata$ won't re-fire
      } else {
        el.addEventListener("loadeddata$", start);
        el.src = url;
      }
      pollId = setInterval(() => {
        if (cancelledRef.current) { el.pause(); finish(); }
      }, 100);
      capId = setTimeout(finish, 60000);
    });
  }, []);

  const chipTimersRef = useRef([]);
  const clearChipTimers = useCallback(() => {
    chipTimersRef.current.forEach(clearTimeout);
    chipTimersRef.current = [];
  }, []);

  const playSentence = useCallback(async () => {
    if (sentence.length === 0) return;
    cancelledRef.current = false;
    setIsPlaying(true);
    const mult = SPEED_MULT[speed];
    const rate = speed === "slow" ? 0.5 : 1;

    // Preferred path: every word has a .pose file, so the server stitches the
    // whole sentence into ONE smooth continuous sequence (sign.mt's own
    // trim/connect/interpolate) — no reload hitch between words. Chips are
    // highlighted on timers from the stitch's per-word durations.
    if (sentence.every((w) => hasPose(poseWords, w))) {
      try {
        const meta = await fetchPoseSeqMeta(sentence, "words");
        if (!cancelledRef.current) {
          setActiveView("pose");
          let atMs = 0;
          chipTimersRef.current = sentence.map((w, i) => {
            const timer = setTimeout(() => setPlayingIdx(i), atMs / rate);
            atMs += meta.durations_ms[i];
            return timer;
          });
          await playPoseSrc(poseSeqUrl(sentence, "words"), rate);
        }
        clearChipTimers();
        setPlayingIdx(-1);
        setIsPlaying(false);
        setActiveView("pose");
        return;
      } catch {
        clearChipTimers(); // stitch endpoint unreachable — per-word fallback
      }
    }

    for (let i = 0; i < sentence.length; i++) {
      if (cancelledRef.current) break;
      setPlayingIdx(i);
      const usePose = hasPose(poseWords, sentence[i]);
      setActiveView(usePose ? "pose" : "canvas");
      await (usePose ? playPoseSrc(poseUrl(sentence[i]), rate) : playOneWord(sentence[i], mult));
      if (cancelledRef.current) break;
      await new Promise((r) => setTimeout(r, WORD_GAP_MS));
    }

    setPlayingIdx(-1);
    setIsPlaying(false);
    setActiveView("pose");
  }, [sentence, speed, playOneWord, playPoseSrc, poseWords, clearChipTimers]);

  const stopSentence = useCallback(() => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    clearChipTimers();
    poseElRef.current?.pause();
    setIsPlaying(false);
    setPlayingIdx(-1);
    setActiveView("pose");
  }, [clearChipTimers]);

  useEffect(() => {
    if (!isPlaying) drawIdle();
  }, [isPlaying, drawIdle]);

  useEffect(() => () => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const addWord = (w) => {
    if (isPlaying || sentence.length >= 8) return;
    setSentence((prev) => [...prev, w]);
  };

  const removeWordAt = (idx) => {
    if (isPlaying) return;
    setSentence((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearSentence = () => {
    if (isPlaying) return;
    setSentence([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
      {/* Both surfaces stay mounted; per-word playback toggles which shows so
          the pose viewer keeps its loaded file and the canvas keeps its 2D
          context across the sentence. */}
      <div style={{ position: "relative", width: "100%", maxWidth: `${W}px` }}>
        <pose-viewer
          ref={poseElRef}
          loop={false}
          autoplay={false}
          thickness={6}
          style={{
            borderRadius: "16px",
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid var(--btn-secondary-border)",
            display: activeView === "pose" ? "block" : "none",
            width: "100%",
            height: "420px",
          }}
        />
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            borderRadius: "16px",
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid var(--btn-secondary-border)",
            display: activeView === "pose" ? "none" : "block",
            maxWidth: "100%",
          }}
        />
        {activeView === "pose" && !isPlaying && (
          <span
            style={{
              position: "absolute", bottom: "12px", left: 0, right: 0,
              textAlign: "center", fontSize: "13px", pointerEvents: "none",
              color: "rgba(255,255,255,0.30)",
            }}
          >
            {sentence.length ? "▶ Press Play to sign the sentence" : "Add words below to build a sentence"}
          </span>
        )}
      </div>

      {/* Sentence chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: `${W}px`, justifyContent: "center", minHeight: "28px" }}>
        {sentence.length === 0 && (
          <span style={{ color: "var(--stickman-label-color)", fontSize: "0.78rem" }}>
            No words added yet.
          </span>
        )}
        {sentence.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            disabled={isPlaying}
            onClick={() => removeWordAt(i)}
            title="Click to remove"
            style={{
              width: "auto", padding: "5px 10px", fontSize: "0.76rem",
              cursor: isPlaying ? "not-allowed" : "pointer",
              background: playingIdx === i ? "var(--secondary)" : "var(--stickman-btn-active-bg)",
              border: `1px solid ${playingIdx === i ? "var(--secondary)" : "var(--primary)"}`,
              borderRadius: "8px",
              color: playingIdx === i ? "#ffffff" : "var(--stickman-btn-active-color)",
            }}
          >
            {w} ✕
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: "6px", maxWidth: `${W}px`, justifyContent: "center" }}>
        {WORD_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={isPlaying}
            onClick={() => setCategory(c.id)}
            style={{
              width: "auto", padding: "5px 13px", fontSize: "0.76rem", fontWeight: 600,
              cursor: isPlaying ? "not-allowed" : "pointer",
              background: category === c.id ? "var(--secondary)" : "transparent",
              border: `1px solid ${category === c.id ? "var(--secondary)" : "var(--stickman-btn-inactive-border)"}`,
              borderRadius: "8px",
              color: category === c.id ? "#ffffff" : "var(--stickman-label-color)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Word bank — click to append to the sentence */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: `${W}px`, justifyContent: "center" }}>
        {wordsInCategory.map((w) => (
          <button
            key={w}
            type="button"
            disabled={isPlaying || sentence.length >= 8}
            onClick={() => addWord(w)}
            style={{
              width: "auto", padding: "5px 11px", fontSize: "0.76rem",
              cursor: isPlaying ? "not-allowed" : "pointer",
              background: "var(--stickman-btn-inactive-bg)",
              border: "1px solid var(--stickman-btn-inactive-border)",
              borderRadius: "8px",
              color: "var(--stickman-btn-inactive-color)",
            }}
          >
            + {w}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--btn-secondary-border)" }}>
          {["slow", "normal"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                width: "auto", padding: "7px 16px", fontSize: "0.78rem", border: "none",
                background: speed === s ? "var(--stickman-btn-active-bg)" : "transparent",
                cursor: "pointer",
                color: speed === s ? "var(--stickman-btn-active-color)" : "var(--stickman-label-color)",
              }}
            >
              {s === "slow" ? "🐢 Slow" : "⚡ Normal"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={isPlaying ? stopSentence : playSentence}
          disabled={!isPlaying && sentence.length === 0}
          style={{
            width: "auto", padding: "9px 24px", fontSize: "0.92rem", borderRadius: "9px",
            cursor: !isPlaying && sentence.length === 0 ? "not-allowed" : "pointer",
            background: isPlaying ? "var(--danger)" : "var(--primary)",
            color: "#ffffff",
          }}
        >
          {isPlaying ? "◼ Stop" : "▶ Play Sentence"}
        </button>
        <button
          type="button"
          onClick={clearSentence}
          disabled={isPlaying || sentence.length === 0}
          style={{
            width: "auto", padding: "9px 16px", fontSize: "0.85rem", borderRadius: "9px",
            cursor: isPlaying || sentence.length === 0 ? "not-allowed" : "pointer",
            background: "transparent",
            border: "1px solid var(--stickman-btn-inactive-border)",
            color: "var(--stickman-label-color)",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
