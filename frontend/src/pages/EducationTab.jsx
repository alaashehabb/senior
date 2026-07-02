import { useState } from "react";
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
            ? "Watch real signing as a motion-capture skeleton: pick a word, build a sentence, or fingerspell anything letter by letter. Each sign shows a plain-language cue."
            : "Show the target sign to your webcam and get instant feedback from the same recognition model used in live translation."}
        </p>
      </div>

      {eduView === "learn" ? (
        <div className="edu-col" style={{ maxWidth: "560px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
            <h4 className="edu-col-title" style={{ color: "var(--secondary)", margin: 0 }}>
              ASL Signs · Full Body
            </h4>
            <div className="edu-subnav">
              <button
                type="button"
                className={wordView === "single" ? "active" : ""}
                onClick={() => setWordView("single")}
              >
                Sign Viewer
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
              ? "Pick a word — or open 🔤 Fingerspelling to spell anything — and watch the sign. Use 🐢 Slow to study the motion, then ⚡ Normal for natural speed."
              : "Type any sentence and watch it signed: dictionary words are signed naturally, unknown words are fingerspelled letter by letter."}
          </p>
          {wordView === "single" ? <ASLWordStickman /> : <SentenceBuilder />}
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
