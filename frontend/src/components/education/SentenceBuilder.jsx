import { useCallback, useEffect, useRef, useState } from "react";
import { usePoseWords, hasPose, POSES_BASE } from "../../utils/poseViewer";

// Free-text sentence signing (sign.mt style): the user types any sentence,
// the server stitches it into ONE continuous pose sequence — words with a
// dictionary .pose are signed, unknown words are fingerspelled letter by
// letter — and the skeleton plays it back. Token chips preview how the
// sentence will be signed and light up in sync with playback.

const W = 320;
const MAX_TOKENS = 12; // mirrors the server-side limit

// Per-language input handling; the server does the authoritative version of
// this (pose_concat._tokenize) — the client copy only powers the live chip
// preview before Play is pressed.
const LANG_CONFIG = {
  en: {
    digits: { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" },
    stripRe: /[^a-z0-9' ]+/g,
    dir: "ltr",
    placeholder: "Type a sentence… e.g. hello my name is sam",
  },
  ar: {
    digits: { 1: "واحد", 2: "اثنان", 3: "ثلاثة", 4: "اربعة", 5: "خمسة",
              "١": "واحد", "٢": "اثنان", "٣": "ثلاثة", "٤": "اربعة", "٥": "خمسة" },
    stripRe: /[^\u0621-\u064A0-9\u0660-\u0669' ]+/g,
    dir: "rtl",
    placeholder: "اكتب جملة… مثال: انا اريد شاي",
  },
};

function tokenize(text, cfg) {
  return text
    .toLowerCase()
    .replace(cfg.stripRe, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

// Greedy longest-phrase chunking, mirroring the server's plan builder:
// multi-word dictionary entries ("thank you", "السلام عليكم") are ONE pose
// file, so they must render as one solid chip instead of two spelled ones.
function chunkTokens(tokens, poseWords, cfg, lang) {
  const chips = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = null;
    for (const n of [3, 2]) {
      if (i + n <= tokens.length) {
        const phrase = tokens.slice(i, i + n).join(" ");
        if (hasPose(poseWords, phrase, lang)) { matched = { text: phrase, mode: "sign", n }; break; }
      }
    }
    if (!matched) {
      const t = tokens[i];
      matched = { text: t, mode: hasPose(poseWords, cfg.digits[t] ?? t, lang) ? "sign" : "spell", n: 1 };
    }
    chips.push(matched);
    i += matched.n;
  }
  return chips;
}

export default function SentenceBuilder({ lang = "en" }) {
  const poseElRef = useRef(null);
  const cancelledRef = useRef(false);
  const timersRef = useRef([]);

  const [text, setText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState("normal");
  const [playingIdx, setPlayingIdx] = useState(-1); // token index during playback
  const [spellingCh, setSpellingCh] = useState(null); // current fingerspelled letter
  const [error, setError] = useState(null);

  const cfg = LANG_CONFIG[lang];
  const poseWords = usePoseWords(lang);
  const tokens = tokenize(text, cfg).slice(0, MAX_TOKENS);
  const chips = chunkTokens(tokens, poseWords, cfg, lang);

  useEffect(() => {
    const el = poseElRef.current;
    if (!el) return;
    // autoplay={false} can't reach a lazily-upgraded custom element through
    // JSX (a false attribute is removed and the component defaults to true).
    el.autoplay = false;
    el.loop = false;
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Plays one .pose URL to completion; resolves on ended$, cancellation
  // (polled — the web component has no abort API), or a hard timeout.
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
      capId = setTimeout(finish, 120000);
    });
  }, []);

  // Plain function (not useCallback): it closes over per-render derived
  // arrays (tokens/chips), and it's only used as an onClick handler.
  const playSentence = async () => {
    const query = tokens.join(" ");
    if (!query) return;
    setError(null);
    cancelledRef.current = false;
    setIsPlaying(true);
    try {
      const metaRes = await fetch(
        `${POSES_BASE}/api/pose-text/meta?text=${encodeURIComponent(query)}&lang=${lang}`
      );
      if (!metaRes.ok) {
        const detail = (await metaRes.json().catch(() => null))?.detail;
        throw new Error(detail || `Sign service error (${metaRes.status})`);
      }
      const meta = await metaRes.json();
      const rate = speed === "slow" ? 0.5 : 1;

      // Schedule chip + letter highlights on the stitched timeline.
      clearTimers();
      meta.tokens.forEach((tok, i) => {
        timersRef.current.push(setTimeout(() => {
          setPlayingIdx(i);
          setSpellingCh(null);
        }, tok.start_ms / rate));
        tok.letters.forEach((l) => {
          timersRef.current.push(setTimeout(
            () => setSpellingCh(l.ch.toUpperCase()),
            l.start_ms / rate
          ));
        });
      });

      await playPoseSrc(
        `${POSES_BASE}/api/pose-text?text=${encodeURIComponent(query)}&lang=${lang}`,
        rate
      );
    } catch (err) {
      setError(err.message || "Couldn't reach the sign service — try again.");
    } finally {
      clearTimers();
      setPlayingIdx(-1);
      setSpellingCh(null);
      setIsPlaying(false);
    }
  };

  const stopSentence = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    poseElRef.current?.pause();
    setPlayingIdx(-1);
    setSpellingCh(null);
    setIsPlaying(false);
  }, [clearTimers]);

  useEffect(() => () => { cancelledRef.current = true; clearTimers(); }, [clearTimers]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
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
            display: "block",
            width: "100%",
            height: "420px",
          }}
        />
        {!isPlaying && (
          <span
            style={{
              position: "absolute", bottom: "12px", left: 0, right: 0,
              textAlign: "center", fontSize: "13px", pointerEvents: "none",
              color: "rgba(255,255,255,0.30)",
            }}
          >
            {tokens.length ? "▶ Press Play to sign the sentence" : "Type a sentence below to sign it"}
          </span>
        )}
        {isPlaying && spellingCh && (
          <span
            style={{
              position: "absolute", top: "12px", left: 0, right: 0,
              textAlign: "center", fontSize: "1.4rem", fontWeight: 700,
              pointerEvents: "none", color: "var(--secondary)",
            }}
          >
            🔤 <span dir={cfg.dir}>{spellingCh}</span>
          </span>
        )}
      </div>

      {/* Sentence input */}
      <input
        type="text"
        value={text}
        disabled={isPlaying}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !isPlaying) playSentence(); }}
        placeholder={cfg.placeholder}
        dir={cfg.dir}
        style={{
          width: "100%", maxWidth: `${W}px`, padding: "10px 14px", fontSize: "0.9rem",
          borderRadius: "10px", border: "1px solid var(--btn-secondary-border)",
          background: "var(--stickman-btn-inactive-bg)",
          color: "var(--stickman-btn-inactive-color)",
        }}
      />

      {/* Parsed-token chips: solid = signed from the dictionary, dashed 🔤 =
          will be fingerspelled. Highlighted live during playback. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxWidth: `${W}px`, justifyContent: "center", minHeight: "28px" }}>
        {tokens.length === 0 && (
          <span style={{ color: "var(--stickman-label-color)", fontSize: "0.78rem" }}>
            Known words are signed; unknown words are fingerspelled.
          </span>
        )}
        {chips.map((c, i) => {
          const spelled = c.mode === "spell";
          const active = playingIdx === i;
          return (
            <span
              key={`${c.text}-${i}`}
              title={spelled ? "Not in the sign dictionary — will be fingerspelled" : "Signed from the dictionary"}
              style={{
                padding: "5px 10px", fontSize: "0.76rem", borderRadius: "8px",
                background: active ? "var(--secondary)" : "var(--stickman-btn-inactive-bg)",
                border: `1px ${spelled ? "dashed" : "solid"} ${active ? "var(--secondary)" : spelled ? "var(--stickman-label-color)" : "var(--primary)"}`,
                color: active ? "#ffffff" : "var(--stickman-btn-inactive-color)",
              }}
            >
              {spelled && "🔤 "}<span dir={cfg.dir}>{lang === "ar" ? c.text : c.text.toUpperCase()}</span>
            </span>
          );
        })}
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
          disabled={!isPlaying && tokens.length === 0}
          onClick={isPlaying ? stopSentence : playSentence}
          style={{
            width: "auto", padding: "9px 28px", fontSize: "0.92rem", borderRadius: "9px", cursor: "pointer",
            background: isPlaying ? "var(--danger)" : "var(--primary)",
            color: "#ffffff",
          }}
        >
          {isPlaying ? "◼ Stop" : "▶ Play Sentence"}
        </button>
        <button
          type="button"
          disabled={isPlaying || text === ""}
          onClick={() => setText("")}
          style={{ width: "auto", padding: "9px 18px", fontSize: "0.92rem", borderRadius: "9px", cursor: "pointer" }}
        >
          Clear
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--danger, #F87171)", margin: 0, fontSize: "0.8rem", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
