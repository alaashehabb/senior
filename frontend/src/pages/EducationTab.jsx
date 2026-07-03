import { useState } from "react";
import ASLWordStickman from "../components/ASLWordStickman";
import SentenceBuilder from "../components/education/SentenceBuilder";
import PracticePanel from "../components/education/PracticePanel";

// The "Learn to Sign" panel shown under the App Home Page's Educational tab.
// Extracted out of AppHomePage.jsx so upgrades to this panel (categories,
// practice mode, ArSL parity, progress tracking) stay additive here instead
// of growing AppHomePage.jsx further.
//
// `lang` switches the whole education section between ASL (English, sign.mt
// "ase" dictionary) and ArSL (Arabic, sign.mt "jos" — Jordanian Sign
// Language, the only open Arabic-lookup sign dictionary).
function EducationTab() {
  const [eduView, setEduView] = useState("learn"); // "learn" | "practice"
  const [wordView, setWordView] = useState("single"); // "single" | "sentence"
  const [lang, setLang] = useState("en"); // "en" (ASL) | "ar" (ArSL)

  const isAr = lang === "ar";

  return (
    <section className="tab-panel">
      <div className="edu-intro">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Learn to Sign</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <div className="edu-subnav">
              <button
                type="button"
                className={!isAr ? "active" : ""}
                onClick={() => setLang("en")}
              >
                ASL · English
              </button>
              <button
                type="button"
                className={isAr ? "active" : ""}
                onClick={() => setLang("ar")}
              >
                ArSL · العربية
              </button>
            </div>
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
              {isAr ? "ArSL Signs · Full Body" : "ASL Signs · Full Body"}
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
          {wordView === "single" ? <ASLWordStickman key={lang} lang={lang} /> : <SentenceBuilder key={lang} lang={lang} />}
        </div>
      ) : (
        <div className="edu-col" style={{ maxWidth: "560px" }}>
          <PracticePanel key={lang} lang={lang} />
        </div>
      )}
    </section>
  );
}

export default EducationTab;
