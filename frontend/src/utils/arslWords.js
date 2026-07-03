// ArSL education vocabulary — Jordanian Sign Language (jos) clips fetched
// from sign.mt's dictionary into model-services/poses/ar/ (see
// fetch_signmt_pose.py --lang ar). Unlike aslWordPoses.js these entries are
// pose-only: there are no hand-authored canvas keyframes for Arabic, the
// skeleton viewer is the only renderer.
//
// ⚠ EVERY word here was individually verified to be a GENUINE dictionary
// sign, not sign.mt's silent fingerspelling fallback (the API returns
// HTTP 200 spelled letter sequences for words it doesn't know). The
// verification compares the word's pose against the cloud's own spelling of
// it — fetch the doubled word (guaranteed out-of-vocabulary → spelled) and
// DTW-compare handshape sequences; see scratchpad classify2.py from the
// July 2026 session, and the notes in fetch_signmt_pose.py. A word that
// just fingerspells must never be presented as a word sign.
//
// The jos dictionary keys many entries under proper Arabic orthography:
// أم is a real sign while ام is spelled, آسف real while اسف spelled. Keys
// below therefore keep hamza/madda forms and MUST match the .pose
// filenames; lookups fold both sides (server pose_concat.AR_FOLD, client
// poseViewer.foldWord) so users can still type bare spellings.
//
// `description` is the ENGLISH gloss (the app's UI language), shown under
// the Arabic word label.

export const AR_WORD_CATEGORIES = [
  { id: "core", label: "كلمات يومية" },
  { id: "people", label: "الناس" },
  { id: "feelings", label: "مشاعر وصفات" },
  { id: "time", label: "الوقت" },
  { id: "food", label: "طعام وشراب" },
];

export const AR_WORDS = {
  "اسم": { category: "core", description: "Name" },
  "لا": { category: "core", description: "No" },
  "مع السلامة": { category: "core", description: "Goodbye" },
  "آسف": { category: "core", description: "Sorry" },
  "فهم": { category: "core", description: "Understand" },
  "خطأ": { category: "core", description: "Wrong / mistake" },
  "إشارة": { category: "core", description: "Sign / signal" },

  "أنا": { category: "people", description: "I / me" },
  "أم": { category: "people", description: "Mother" },
  "جد": { category: "people", description: "Grandfather" },
  "امرأة": { category: "people", description: "Woman" },
  "أسرة": { category: "people", description: "Family" },

  "حب": { category: "feelings", description: "Love" },
  "خائف": { category: "feelings", description: "Afraid" },
  "جميل": { category: "feelings", description: "Beautiful" },
  "حلو": { category: "feelings", description: "Sweet / nice" },
  "جديد": { category: "feelings", description: "New" },

  "اليوم": { category: "time", description: "Today" },
  "أمس": { category: "time", description: "Yesterday" },
  "الآن": { category: "time", description: "Now" },
  "دقيقة": { category: "time", description: "Minute" },

  "خبز": { category: "food", description: "Bread" },
  "حليب": { category: "food", description: "Milk" },
};

// No numbers category: the jos dictionary only has 2/3/4 (1 and 5 are
// absent — every spelling variant spells or 500s), too sparse for a tab.
// The اثنان/ثلاثة/اربعة pose files stay installed so the Sentence Builder
// still signs typed digits (٢ ٣ ٤) via the server's DIGIT_WORDS mapping.

// 28 base letters, in alphabetical order, for the Fingerspelling tab.
export const AR_ALPHABET = "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");

// Education words the deployed ArSL word-recognition model
// (arsl_word_inference.py, KArSL BiLSTM, 32 labels in bare spelling) can
// actually recognize — the fold-normalized intersection of AR_WORDS with
// its WORDS list (انا↔أنا, اسف↔آسف). Everything else is watch-only in
// Practice mode.
export const AR_PRACTICE_READY_WORDS = [
  "لا", "اسم", "مع السلامة", "أنا", "آسف", "دقيقة",
];
