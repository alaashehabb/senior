import { useCallback, useEffect, useRef, useState } from "react";
import { ASL_POSES, ASL_HINTS } from "../utils/aslHandPoses";
import { WORD_ANIMS, WORD_CATEGORIES, RN, LN } from "../utils/aslWordPoses";
import { AR_WORDS, AR_WORD_CATEGORIES, AR_ALPHABET } from "../utils/arslWords";
import { COLORS, EASE, drawHand, lerpXY, lerp, solveArm } from "../utils/aslRenderer";
import { usePoseWords, hasPose, poseUrl, poseSeqUrl, fetchPoseSeqMeta } from "../utils/poseViewer";

const W = 320;
const H = 500;
const HAND_SCALE = 118;
const TAU = Math.PI * 2;

// ── Body constants ────────────────────────────────────────────────────────────
const RS = [215, 108]; // right shoulder
const LS = [105, 108]; // left  shoulder
const UPPER = 65;
const FORE = 65;
const R_HINT = [278, 165]; // elbow bend hint (keeps elbows natural)
const L_HINT = [42, 165];

const RELAXED = ASL_POSES[" "];
const SPEED_MULT = { slow: 1.0, normal: 0.55 };
const LETTER_GAP_MS = 150; // pause between fingerspelled letters

// The Fingerspelling tab lives alongside the word categories but plays
// per-letter .pose clips fetched from sign.mt instead of picking words.
const FINGERSPELL_ID = "fingerspell";

// Everything language-specific in one lookup: word data (ArSL entries are
// pose-only — no canvas keyframes), category tabs, the fingerspelling
// alphabet, and how to filter typed spell input down to spellable letters.
const LANG_CONFIG = {
  en: {
    words: WORD_ANIMS,
    categories: WORD_CATEGORIES,
    fingerspellLabel: "🔤 Fingerspelling",
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    spellFilter: (s) => s.toLowerCase().replace(/[^a-z]/g, "").split(""),
    defaultWord: "HELLO",
    attribution: "🎥 Motion captured from a real signer · skeleton data via sign.mt",
    dir: "ltr",
    spellPlaceholder: "Type a word to fingerspell…",
    spellHelp: "Type a word and press Play to spell it letter by letter, or tap a letter to watch its handshape.",
  },
  ar: {
    words: AR_WORDS,
    categories: AR_WORD_CATEGORIES,
    fingerspellLabel: "🔤 تهجئة بالأصابع",
    alphabet: AR_ALPHABET,
    spellFilter: (s) => s.split("").filter((c) => AR_ALPHABET.includes(c)),
    defaultWord: "اسم",
    attribution: "🎥 Motion captured from a real signer · Jordanian Sign Language via sign.mt",
    dir: "rtl",
    spellPlaceholder: "اكتب كلمة لتهجئتها…",
    spellHelp: "Type a word and press Play to spell it letter by letter, or tap a letter to watch its handshape.",
  },
};

// ── Whole scene: stick body (IK arms) + two hands ─────────────────────────────
// `hint` biases which of the two elbow-bend solutions to use. Pass the
// PREVIOUS frame's own elbow position (not a fixed point) so the bend never
// discontinuously flips mid-animation — only the very first call of a
// playback should fall back to the static R_HINT/L_HINT default.
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

  // Purple: head, torso, hips, legs + left arm — one path
  ctx.strokeStyle = COLORS.body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(160, headY, 28, 0, TAU);
  ctx.moveTo(160, headY + 28); ctx.lineTo(160, Math.min(rSY, lSY));
  ctx.moveTo(lS[0], lS[1]);    ctx.lineTo(rS[0], rS[1]);   // shoulders
  ctx.moveTo(160, 108);        ctx.lineTo(160, 232);       // torso
  ctx.moveTo(135, 232);        ctx.lineTo(185, 232);       // hips
  ctx.moveTo(135, 232);        ctx.lineTo(115, 315);
  ctx.moveTo(185, 232);        ctx.lineTo(205, 315);
  ctx.moveTo(115, 315);        ctx.lineTo(108, 395);
  ctx.moveTo(205, 315);        ctx.lineTo(212, 395);
  ctx.moveTo(lS[0], lS[1]);    ctx.lineTo(lE[0], lE[1]);   // left upper arm
  ctx.lineTo(lWrist[0], lWrist[1]);                        // left forearm
  ctx.stroke();

  // Pink: right (signing) arm
  ctx.strokeStyle = COLORS.activeArm;
  ctx.beginPath();
  ctx.moveTo(rS[0], rS[1]); ctx.lineTo(rE[0], rE[1]);
  ctx.lineTo(rWrist[0], rWrist[1]);
  ctx.stroke();

  drawHand(ctx, rHand ? ASL_POSES[rHand] : RELAXED, { ox: rWrist[0], oy: rWrist[1], scale: HAND_SCALE });
  drawHand(ctx, lHand ? ASL_POSES[lHand] : RELAXED, { ox: lWrist[0], oy: lWrist[1], scale: HAND_SCALE });

  return { rElbow: rE, lElbow: lE }; // feed forward as next frame's continuity hint
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ASLWordStickman({ lang = "en" }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(null);
  const playedRef = useRef(false); // has a sign finished at least once?

  const cfg = LANG_CONFIG[lang];
  const TABS = [...cfg.categories, { id: FINGERSPELL_ID, label: cfg.fingerspellLabel }];

  // Guard against the word list shrinking out from under the configured
  // default (vocabulary is pruned whenever a clip turns out to be a
  // fingerspelling fallback) — fall back to the first word we actually have.
  const [selected, setSelected] = useState(
    cfg.words[cfg.defaultWord] ? cfg.defaultWord : Object.keys(cfg.words)[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("normal");
  const [category, setCategory] = useState(cfg.categories[0].id);
  const [spellInput, setSpellInput] = useState("");
  const [lastLetter, setLastLetter] = useState(null);

  // Words with a .pose file play as a sign.mt skeleton captured from a real
  // signer; the rest fall back to the hand-authored canvas animation
  // (English-only). Fingerspelling is always pose-based (per-letter clips).
  const poseWords = usePoseWords(lang);
  const isFingerspell = category === FINGERSPELL_ID;
  const poseMode = isFingerspell || hasPose(poseWords, selected, lang);
  const rate = speed === "slow" ? 0.5 : 1;

  const wordsInCategory = Object.keys(cfg.words).filter(
    (w) => cfg.words[w].category === category
  );

  // NOTE: the parent renders this component with key={lang}, so a language
  // switch remounts it — selection, spelling and playback state all reset
  // naturally without effect gymnastics.

  // ── sign.mt skeleton playback (imperative <pose-viewer>) ────────────────────
  const poseElRef = useRef(null);
  const cancelledPoseRef = useRef(false);

  useEffect(() => {
    const el = poseElRef.current;
    if (!el) return;
    // autoplay={false} can't reach a lazily-upgraded custom element through
    // JSX (a false attribute is removed and the component defaults to true).
    el.autoplay = false;
    el.loop = false;
  }, []);

  // While idle, preview the selected word's first frame.
  useEffect(() => {
    const el = poseElRef.current;
    if (!el || isPlaying || isFingerspell) return;
    if (hasPose(poseWords, selected, lang)) el.src = poseUrl(selected, lang);
  }, [selected, poseWords, isFingerspell, isPlaying, lang]);

  // Plays one .pose URL to completion; resolves on ended$, cancellation
  // (polled — the component has no abort API), or a hard timeout.
  const playPoseUrl = useCallback((url, playbackRate) => {
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
        el.playbackRate = playbackRate;
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
        if (cancelledPoseRef.current) { el.pause(); finish(); }
      }, 100);
      capId = setTimeout(finish, 30000);
    });
  }, []);

  const playPoseSequence = useCallback(async (urls, playbackRate) => {
    cancelledPoseRef.current = false;
    setIsPlaying(true);
    for (let i = 0; i < urls.length; i++) {
      if (cancelledPoseRef.current) break;
      await playPoseUrl(urls[i], playbackRate);
      if (cancelledPoseRef.current || i === urls.length - 1) break;
      await new Promise((r) => setTimeout(r, LETTER_GAP_MS));
    }
    setIsPlaying(false);
  }, [playPoseUrl]);

  const spellTimersRef = useRef([]);
  const clearSpellTimers = useCallback(() => {
    spellTimersRef.current.forEach(clearTimeout);
    spellTimersRef.current = [];
  }, []);

  const stopPose = useCallback(() => {
    cancelledPoseRef.current = true;
    clearSpellTimers();
    poseElRef.current?.pause();
    setIsPlaying(false);
  }, [clearSpellTimers]);

  // Fingerspell the typed word as ONE stitched pose sequence (smooth,
  // uniform letter rhythm), highlighting each letter as it plays. Falls back
  // to letter-by-letter clips if the stitch endpoint is unreachable.
  const spellCurrentInput = async () => {
    const letters = cfg.spellFilter(spellInput);
    if (letters.length === 0) return;
    setLastLetter(null);
    try {
      const meta = await fetchPoseSeqMeta(letters, "spell", lang);
      cancelledPoseRef.current = false;
      setIsPlaying(true);
      let atMs = 0;
      spellTimersRef.current = letters.map((l, i) => {
        const timer = setTimeout(() => setLastLetter(l.toUpperCase()), atMs / rate);
        atMs += meta.durations_ms[i];
        return timer;
      });
      await playPoseUrl(poseSeqUrl(letters, "spell", lang), rate);
      clearSpellTimers();
      setIsPlaying(false);
    } catch {
      playPoseSequence(letters.map((l) => poseUrl(l, lang)), rate);
    }
  };

  const playLetter = (letter) => {
    setLastLetter(letter);
    // Single-letter "spell" stitch = just the trimmed, held peak handshape.
    playPoseSequence([poseSeqUrl([letter], "spell", lang)], rate);
  };

  useEffect(() => () => { cancelledPoseRef.current = true; clearSpellTimers(); }, [clearSpellTimers]);

  // Cache context once
  useEffect(() => {
    ctxRef.current = canvasRef.current?.getContext("2d");
  }, []);

  // ── Static idle frame (no perpetual animation → no idle CPU cost) ───────────
  const drawIdle = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const label = playedRef.current ? "↻ Press Play again" : "▶ Press Play to sign";
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, RN, LN, null, null);
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.font = "13px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, W / 2, H - 16);
  }, []);

  // ── Playback (RAF only while playing) ───────────────────────────────────────
  const playWord = useCallback((wordKey, mult) => {
    cancelAnimationFrame(rafRef.current);
    const anim = WORD_ANIMS[wordKey];
    if (!anim?.frames) return; // pose-only entries have no canvas keyframes
    setIsPlaying(true);

    const frames = anim.frames;
    let fIdx = 0;
    let fStart = null;

    // "prev" = the position/handshape we're moving FROM this segment (starts
    // at rest). Each keyframe's own dur/ease describes the move INTO it, so
    // the move phase must lerp prev → frame (not frame → next) or the hold
    // phase — which always shows frame's own target — snaps on every entry.
    let prevR = RN, prevL = LN;
    let prevRHand = null, prevLHand = null;
    let prevState = { headDY: 0, rShoulderDY: 0, lShoulderDY: 0 };

    // Elbow continuity hints: seeded with the static defaults, then fed
    // forward each frame so the 2-joint IK never has to choose between its
    // two bend solutions by distance-to-a-fixed-point (which can flip
    // discontinuously); it just stays near wherever the elbow already was.
    let rHint = R_HINT, lHint = L_HINT;

    const tick = (now) => {
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
        headDY:      inHold ? (frame.headDY ?? 0)      : lerp(prevState.headDY, frame.headDY ?? 0, t),
        rShoulderDY: inHold ? (frame.rShoulderDY ?? 0) : lerp(prevState.rShoulderDY, frame.rShoulderDY ?? 0, t),
        lShoulderDY: inHold ? (frame.lShoulderDY ?? 0) : lerp(prevState.lShoulderDY, frame.lShoulderDY ?? 0, t),
      };

      // Snap the handshape at the midpoint of the move into this frame.
      const rHand = rawT < 0.5 ? prevRHand : frame.rHand;
      const lHand = rawT < 0.5 ? prevLHand : frame.lHand;

      const ctx = ctxRef.current;
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        const { rElbow, lElbow } = drawScene(ctx, rW, lW, rHand, lHand, state, { rElbow: rHint, lElbow: lHint });
        rHint = rElbow;
        lHint = lElbow;

        // Progress dots
        const total = frames.length - 1;
        const startX = W / 2 - (total * 11) / 2;
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.beginPath();
        for (let i = 0; i <= total; i++) {
          if (i !== fIdx) {
            ctx.moveTo(startX + i * 11 + 4, H - 16);
            ctx.arc(startX + i * 11, H - 16, 4, 0, TAU);
          }
        }
        ctx.fill();
        ctx.fillStyle = inHold ? COLORS.activeArm : COLORS.body;
        ctx.beginPath();
        ctx.arc(startX + fIdx * 11, H - 16, 4, 0, TAU);
        ctx.fill();
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
        if (fIdx >= frames.length) {
          playedRef.current = true;
          setIsPlaying(false); // idle effect repaints with the "play again" caption
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    drawIdle();
  }, [drawIdle]);

  // Draw the idle frame whenever we're not playing.
  useEffect(() => {
    if (!isPlaying) drawIdle();
  }, [isPlaying, selected, drawIdle]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
      {/* sign.mt skeleton viewer — always mounted so its loaded pose survives
          tab/word switches; hidden when a fallback word needs the canvas. */}
      <pose-viewer
        ref={poseElRef}
        thickness={6}
        style={{
          display: poseMode ? "block" : "none",
          width: "100%",
          maxWidth: `${W}px`,
          height: "420px",
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid var(--btn-secondary-border)",
        }}
      />
      {/* Canvas stays mounted (hidden in pose mode) so its 2D context and
          idle drawing survive switching between pose and fallback words. */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: "16px",
          background: "rgba(15, 23, 42, 0.7)",
          border: "1px solid var(--btn-secondary-border)",
          display: poseMode ? "none" : "block",
          maxWidth: "100%",
        }}
      />

      {/* Category tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: `${W + 60}px`, justifyContent: "center" }}>
        {TABS.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={isPlaying}
            onClick={() => {
              setCategory(c.id);
              const firstInCategory = Object.keys(cfg.words).find(
                (w) => cfg.words[w].category === c.id
              );
              if (firstInCategory) setSelected(firstInCategory);
            }}
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

      {/* Word picker — or, on the Fingerspelling tab, a word input + A–Z grid */}
      {isFingerspell ? (
        <>
          <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: `${W}px` }}>
            <input
              type="text"
              value={spellInput}
              disabled={isPlaying}
              onChange={(e) => setSpellInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isPlaying) spellCurrentInput(); }}
              placeholder={cfg.spellPlaceholder}
              dir={cfg.dir}
              style={{
                flex: 1, padding: "8px 12px", fontSize: "0.85rem",
                borderRadius: "8px", border: "1px solid var(--btn-secondary-border)",
                background: "var(--stickman-btn-inactive-bg)",
                color: "var(--stickman-btn-inactive-color)",
              }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: `${W}px`, justifyContent: "center" }}>
            {cfg.alphabet.map((L) => (
              <button
                key={L}
                type="button"
                disabled={isPlaying}
                onClick={() => playLetter(L)}
                style={{
                  width: "32px", padding: "5px 0", fontSize: "0.76rem",
                  cursor: isPlaying ? "not-allowed" : "pointer",
                  background: lastLetter === L ? "var(--stickman-btn-active-bg)" : "var(--stickman-btn-inactive-bg)",
                  border: `1px solid ${lastLetter === L ? "var(--primary)" : "var(--stickman-btn-inactive-border)"}`,
                  borderRadius: "8px",
                  color: lastLetter === L ? "var(--stickman-btn-active-color)" : "var(--stickman-btn-inactive-color)",
                }}
              >
                {L}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: `${W}px`, justifyContent: "center" }}>
          {wordsInCategory.map((w) => (
            <button
              key={w}
              type="button"
              disabled={isPlaying}
              onClick={() => setSelected(w)}
              style={{
                width: "auto", padding: "5px 11px", fontSize: "0.76rem",
                cursor: isPlaying ? "not-allowed" : "pointer",
                background: selected === w ? "var(--stickman-btn-active-bg)" : "var(--stickman-btn-inactive-bg)",
                border: `1px solid ${selected === w ? "var(--primary)" : "var(--stickman-btn-inactive-border)"}`,
                borderRadius: "8px",
                color: selected === w ? "var(--stickman-btn-active-color)" : "var(--stickman-btn-inactive-color)",
              }}
            >
              <span dir={cfg.dir}>{w}</span>
            </button>
          ))}
        </div>
      )}

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
          disabled={isFingerspell && !isPlaying && cfg.spellFilter(spellInput).length === 0}
          onClick={
            isPlaying
              ? (poseMode ? stopPose : stopAnim)
              : isFingerspell
                ? spellCurrentInput
                : poseMode
                  ? () => playPoseSequence([poseUrl(selected, lang)], rate)
                  : () => playWord(selected, SPEED_MULT[speed])
          }
          style={{
            width: "auto", padding: "9px 28px", fontSize: "0.92rem", borderRadius: "9px", cursor: "pointer",
            background: isPlaying ? "var(--danger)" : "var(--primary)",
            color: "#ffffff",
          }}
        >
          {isPlaying ? "◼ Stop" : "▶ Play"}
        </button>
      </div>

      {isFingerspell ? (
        <p style={{ color: "var(--stickman-label-color)", margin: 0, fontSize: "0.8rem", textAlign: "center" }}>
          {lastLetter && lang === "en" && ASL_HINTS[lastLetter] ? (
            <>
              <span style={{ color: "var(--secondary)", fontWeight: 600 }}>{lastLetter}</span>
              {" — "}{ASL_HINTS[lastLetter]}
            </>
          ) : lastLetter ? (
            <span dir={cfg.dir} style={{ color: "var(--secondary)", fontWeight: 600, fontSize: "1rem" }}>{lastLetter}</span>
          ) : (
            cfg.spellHelp
          )}
          <span style={{ display: "block", marginTop: "2px", fontSize: "0.72rem", opacity: 0.75 }}>
            {cfg.attribution}
          </span>
        </p>
      ) : cfg.words[selected] && (
        <p style={{ color: "var(--stickman-label-color)", margin: 0, fontSize: "0.8rem", textAlign: "center" }}>
          <span dir={cfg.dir} style={{ color: "var(--secondary)", fontWeight: 600 }}>{selected}</span>
          {" — "}{cfg.words[selected].description}
          {poseMode && (
            <span style={{ display: "block", marginTop: "2px", fontSize: "0.72rem", opacity: 0.75 }}>
              {cfg.attribution}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
