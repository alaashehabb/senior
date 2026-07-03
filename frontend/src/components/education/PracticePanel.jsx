import { useEffect, useRef, useState } from "react";
import { ASL_HINTS } from "../../utils/aslHandPoses";
import { AR_ALPHABET, AR_PRACTICE_READY_WORDS } from "../../utils/arslWords";
import { useCamera } from "../../utils/useCamera";
import { isLetterMatch, isWordMatch, lowConfidenceMessage, PRACTICE_READY_WORDS } from "../../utils/practiceMatch";
import { poseUrl, poseSeqUrl } from "../../utils/poseViewer";
import api from "../../services/api";

// Practice Mode reuses the exact same webcam + /predict pipeline as the
// Chatting tab's live translation (see useCamera.js and AppHomePage.jsx's
// handlePredict), just pointed at a single target sign instead of a running
// chat transcript. It intentionally keeps its own camera instance rather
// than sharing state with the Chatting tab, so starting/stopping the camera
// here never affects (or is affected by) the Chatting tab's session.

const WORD_RECORD_MS = 3200; // longer than Chatting's 2.5s: cued performance needs reaction time
const COUNTDOWN_STEPS = [3, 2, 1];

// Letter targets and recognizable words per language. Both letter models
// return exactly what we compare against: uppercase English letters ("A")
// or real Arabic glyphs ("ع") — see practiceMatch.isLetterMatch.
const LANG_CONFIG = {
  en: {
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    practiceWords: PRACTICE_READY_WORDS,
    dir: "ltr",
  },
  ar: {
    alphabet: AR_ALPHABET,
    practiceWords: AR_PRACTICE_READY_WORDS,
    dir: "rtl",
  },
};

function randomFrom(list, exclude) {
  const pool = exclude ? list.filter((x) => x !== exclude) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function PracticePanel({ lang = "en" }) {
  const {
    videoRef,
    cameraOn,
    status,
    startCamera,
    stopCamera,
    captureImageBase64,
    recordVideoBase64,
  } = useCamera();

  const cfg = LANG_CONFIG[lang];
  const [mode, setMode] = useState("letters"); // "letters" | "words"
  const [targetLetter, setTargetLetter] = useState(cfg.alphabet[0]);
  const [targetWord, setTargetWord] = useState(cfg.practiceWords[0]);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [result, setResult] = useState(null); // { ok, confidence, predicted, message }
  const [showTarget, setShowTarget] = useState(false); // mini skeleton demo of the target

  const countdownTimer = useRef(null);
  useEffect(() => () => clearTimeout(countdownTimer.current), []);

  const target = mode === "letters" ? targetLetter : targetWord;

  // Demo clip for the current target: letters use the held-peak "spell"
  // stitch (raw letter clips can be a few unreadable frames); words play
  // their dictionary sign directly. Works identically for both languages —
  // this is the ArSL equivalent of the English-only text hints, but with
  // verified motion-capture content instead of authored descriptions.
  const targetDemoUrl = mode === "letters"
    ? poseSeqUrl([target], "spell", lang)
    : poseUrl(target, lang);

  const nextTarget = () => {
    setResult(null);
    if (mode === "letters") {
      setTargetLetter((cur) => randomFrom(cfg.alphabet, cur));
    } else {
      setTargetWord((cur) => randomFrom(cfg.practiceWords, cur));
    }
  };

  const runLetterCheck = async () => {
    if (!cameraOn) {
      setResult({ ok: false, message: "Start the camera first." });
      return;
    }
    const imageBase64 = captureImageBase64();
    if (!imageBase64) {
      setResult({ ok: false, message: "Couldn't capture a frame — try again." });
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const res = await api.post("/predict", { language: lang, mode: "letters", imageBase64 });
      const prediction = res.data?.prediction;
      if (!prediction) {
        // The model service reports hard failures as a bare `message` with
        // no prediction — surface it instead of blaming the learner's hand.
        setResult({ ok: false, message: res.data?.message || "Check failed — try again." });
        return;
      }
      if (!prediction.text) {
        setResult({
          ok: false,
          message:
            lowConfidenceMessage(prediction, targetLetter) ||
            prediction.message ||
            "Couldn't detect a hand — make sure it's fully in frame and well lit, then try again.",
        });
        return;
      }
      setResult({
        ok: isLetterMatch(prediction.text, targetLetter, lang),
        confidence: prediction.confidence,
        predicted: prediction.text,
      });
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.message || "Check failed — try again." });
    } finally {
      setChecking(false);
    }
  };

  const runWordCheck = async () => {
    if (!cameraOn) {
      setResult({ ok: false, message: "Start the camera first." });
      return;
    }
    setResult(null);
    setChecking(true);

    for (const step of COUNTDOWN_STEPS) {
      setCountdown(step);
      await new Promise((r) => { countdownTimer.current = setTimeout(r, 700); });
    }
    setCountdown("Sign now!");

    try {
      const videoBase64 = await recordVideoBase64(WORD_RECORD_MS);
      setCountdown(null);
      if (!videoBase64) {
        setResult({ ok: false, message: "Couldn't record — try again." });
        return;
      }
      const res = await api.post("/predict", { language: lang, mode: "words", videoBase64 });
      const prediction = res.data?.prediction;
      if (!prediction) {
        setResult({ ok: false, message: res.data?.message || "Check failed — try again." });
        return;
      }
      if (!prediction.text) {
        setResult({
          ok: false,
          message:
            lowConfidenceMessage(prediction, targetWord) ||
            prediction.message ||
            "Couldn't recognize a clear sign — try again.",
        });
        return;
      }
      setResult({
        ok: isWordMatch(prediction.text, targetWord, lang),
        confidence: prediction.confidence,
        predicted: prediction.text,
      });
    } catch (err) {
      setCountdown(null);
      setResult({ ok: false, message: err.response?.data?.message || "Check failed — try again." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Letters / Words toggle */}
      <div className="edu-subnav" style={{ alignSelf: "flex-start" }}>
        <button
          type="button"
          className={mode === "letters" ? "active" : ""}
          onClick={() => { setMode("letters"); setResult(null); }}
        >
          Letters
        </button>
        <button
          type="button"
          className={mode === "words" ? "active" : ""}
          onClick={() => { setMode("words"); setResult(null); }}
        >
          Words
        </button>
      </div>

      {mode === "words" && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Word-sign checking currently supports {cfg.practiceWords.length} words
          (the ones the recognition model was trained on):{" "}
          <span dir={cfg.dir}>{cfg.practiceWords.join("، ")}</span>.
          More words will support practice-checking as the model's vocabulary grows.
        </p>
      )}

      {/* Target */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--chat-bg)", border: "1px solid var(--btn-secondary-border)",
          borderRadius: "12px", padding: "14px 18px",
        }}
      >
        <div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Sign this
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--secondary)", lineHeight: 1.1 }}>
            <span dir={cfg.dir}>{target}</span>
          </div>
          {mode === "letters" && lang === "en" && ASL_HINTS[target] && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{ASL_HINTS[target]}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setShowTarget((v) => !v)}
            disabled={checking}
            style={{ width: "auto", padding: "8px 14px" }}
          >
            {showTarget ? "🙈 Hide Sign" : "👁 Show Sign"}
          </button>
          <button type="button" onClick={nextTarget} disabled={checking} style={{ width: "auto", padding: "8px 14px" }}>
            🔀 New {mode === "letters" ? "Letter" : "Word"}
          </button>
        </div>
      </div>

      {/* Target demo — a looping skeleton clip of the sign being asked for.
          key forces a reload when the target changes so autoplay refires. */}
      {showTarget && (
        <pose-viewer
          key={`${mode}-${target}-${lang}`}
          src={targetDemoUrl}
          loop={true}
          autoplay={true}
          thickness={6}
          style={{
            display: "block", width: "100%", maxWidth: "240px", height: "220px",
            alignSelf: "center", borderRadius: "12px",
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid var(--btn-secondary-border)",
          }}
        />
      )}

      {/* Camera preview */}
      <div className="video-placeholder" style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
        <video ref={videoRef} autoPlay playsInline muted className="camera-view" style={{ transform: "scaleX(-1)" }} />
        {!cameraOn && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            Camera Off
          </div>
        )}
        {countdown !== null && (
          <div
            style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(15,23,42,0.55)", fontSize: "2.4rem", fontWeight: 700, color: "#fff",
            }}
          >
            {countdown}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls">
        <button type="button" onClick={startCamera}>Start Camera</button>
        <button type="button" onClick={stopCamera}>End Camera</button>
        <button
          type="button"
          onClick={mode === "letters" ? runLetterCheck : runWordCheck}
          disabled={checking}
        >
          {checking ? "Checking..." : "✓ Check My Sign"}
        </button>
      </div>

      <p className="status-text">{status}</p>

      {/* Result feedback */}
      {result && (
        <div
          style={{
            padding: "12px 16px", borderRadius: "10px",
            background: result.ok ? "rgba(74, 222, 128, 0.12)" : "rgba(248, 113, 113, 0.12)",
            border: `1px solid ${result.ok ? "rgba(74, 222, 128, 0.4)" : "rgba(248, 113, 113, 0.4)"}`,
          }}
        >
          {result.predicted !== undefined ? (
            <>
              <strong style={{ color: result.ok ? "#4ADE80" : "#F87171" }}>
                {result.ok ? "✓ Correct!" : "✗ Not quite"}
              </strong>
              {" — the model saw "}
              <strong>{result.predicted}</strong>
              {result.confidence != null && ` (${Math.round(result.confidence * 100)}% confidence)`}
            </>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>{result.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
