// Pure comparison helpers for Practice Mode, kept separate from the UI so
// they're independently testable and reusable by Quiz Mode later.
//
// Both the ASL letter model and the ArSL letter model already return their
// prediction in the exact form the education UI needs — uppercase English
// letters ("A") or a real Arabic Unicode glyph ("ع") — so matching is a
// simple normalized string comparison, not a lookup/translation step.

export function isLetterMatch(predictedText, targetLetter, language = "en") {
  if (!predictedText) return false;
  if (language === "ar") return predictedText === targetLetter;
  return predictedText.trim().toUpperCase() === String(targetLetter).trim().toUpperCase();
}

// Mirrors the pose-lookup fold in poseViewer.js: the ArSL word model's
// labels use bare spellings (انا, اسف) while the education vocabulary keeps
// proper orthography (أنا, آسف) — fold both sides before comparing.
const AR_FOLD_RE = /[أإآٱىئؤةء]/g;
const AR_FOLD = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
                  "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه", "ء": "" };
const foldAr = (s) => String(s).replace(AR_FOLD_RE, (c) => AR_FOLD[c]);

export function isWordMatch(predictedText, targetWord, language = "en") {
  if (!predictedText) return false;
  if (language === "ar") return foldAr(predictedText.trim()) === foldAr(String(targetWord).trim());
  return predictedText.trim().toUpperCase() === String(targetWord).trim().toUpperCase();
}

// When the model saw a sign but stayed below its confidence threshold, it
// reports its best guess as `raw_label`. Turning that into feedback ("it
// looked like X") teaches far more than a generic "couldn't detect" — and
// distinguishes "almost had it" from "wrong sign entirely".
export function lowConfidenceMessage(prediction, target) {
  const guess = prediction?.raw_label;
  if (!guess || guess === "nothing") return null;
  const pct = prediction.confidence != null ? `${Math.round(prediction.confidence * 100)}%` : null;
  if (String(guess).trim().toUpperCase() === String(target).trim().toUpperCase()) {
    return `So close — it looked like ${target}${pct ? ` (${pct})` : ""}, just not clearly enough to count. Hold steady in good lighting and try again.`;
  }
  return `The model's best guess was ${guess}${pct ? ` (${pct})` : ""}, but it wasn't confident enough to count. Check the handshape and try again.`;
}

// Only these WORD_ANIMS entries fall inside the deployed 100-class WLASL
// checkpoint (model-services/models/wlasl/wlasl_class_list.txt, indices
// 0-99) and can get a real word-sign check today. Every other education
// word is watch-only: the model would never recognize it correctly, so
// Practice Mode must not offer a check it can't actually pass.
export const PRACTICE_READY_WORDS = [
  "DRINK", "EAT", "FINISH", "GO", "HELP", "HOW", "MOTHER",
  "NO", "NOW", "WANT", "WHAT", "YES",
];
