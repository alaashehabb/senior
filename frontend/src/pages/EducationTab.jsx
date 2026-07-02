import { useState } from "react";
import ASLStickman from "../components/ASLStickman";
import ASLWordStickman from "../components/ASLWordStickman";
import SentenceBuilder from "../components/education/SentenceBuilder";
import PracticePanel from "../components/education/PracticePanel";

// The "Learn to Sign" panel shown under the App Home Page's Educational tab.
// Extracted out of AppHomePage.jsx so upgrades to this panel (categories,
// practice mode, ArSL parity, progress tracking) stay additive here instead
// of growing AppHomePage.jsx further.
function EducationTab() {
  const [eduView, setEduView] = useState("learn"); // "learn" | "practice"
  const [wordView, setWordView] = useState("single"); // "single" | "sentence"

  return (
    <section className="tab-panel">
      <div className="edu-intro">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Learn to Sign</h3>
          <div className="edu-subnav">
            <button
              type="button"
              className={eduView === "learn" ? "active" : ""}
              onClick={() => setEduView("learn")}
            >
              📖 Learn
            </button>
            <button
              type="button"
              className={eduView === "practice" ? "active" : ""}
              onClick={() => setEduView("practice")}
            >
              🎥 Practice
            </button>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
          {eduView === "learn"
            ? "Practice ASL two ways: fingerspell any word letter-by-letter, or watch the stickman sign common everyday words. Each sign shows a plain-language cue — tap a letter to freeze on its handshape."
            : "Show the target sign to your webcam and get instant feedback from the same recognition model used in live translation."}
        </p>
      </div>

      {eduView === "learn" ? (
        <div className="edu-grid">
          {/* Left: letter fingerspelling */}
          <div className="edu-col">
            <h4 className="edu-col-title" style={{ color: "var(--primary)" }}>
              Fingerspelling · A–Z
            </h4>
            <p className="edu-col-sub">
              Type a word and press Play to spell it out. The hand morphs smoothly between
              letters; J and Z are traced in the air.
            </p>
            <ASLStickman />
          </div>

          {/* Right: full-body word signing, with a Single Word / Sentence Builder toggle */}
          <div className="edu-col">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
              <h4 className="edu-col-title" style={{ color: "var(--secondary)", margin: 0 }}>
                Word Signs · Full Body
              </h4>
              <div className="edu-subnav">
                <button
                  type="button"
                  className={wordView === "single" ? "active" : ""}
                  onClick={() => setWordView("single")}
                >
                  Single Word
                </button>
                <button
                  type="button"
                  className={wordView === "sentence" ? "active" : ""}
                  onClick={() => setWordView("sentence")}
                >
                  Sentence Builder
                </button>
              </div>
            </div>
            <p className="edu-col-sub">
              {wordView === "single"
                ? "Pick a word and watch the full-body sign. Use 🐢 Slow to study the motion, then ⚡ Normal for natural speed."
                : "Add several words to a sentence, then play them back-to-back — great for practicing short phrases."}
            </p>
            {wordView === "single" ? <ASLWordStickman /> : <SentenceBuilder />}
          </div>
        </div>
      ) : (
        <div className="edu-col" style={{ maxWidth: "560px" }}>
          <PracticePanel />
        </div>
      )}
    </section>
  );
}

export default EducationTab;
