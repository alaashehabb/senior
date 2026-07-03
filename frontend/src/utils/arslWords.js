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
// July 2026 sessions, and the notes in fetch_signmt_pose.py. A word that
// just fingerspells must never be presented as a word sign.
//
// The jos dictionary keys many entries under proper Arabic orthography
// (أم real / ام spelled) and many nouns under their DEFINITE form
// (القلب real / قلب spelled). Keys below therefore keep hamza/madda and
// ال forms and MUST match the .pose filenames; lookups fold both sides
// and also try an ال-stripped alias (server pose_concat._fold_index,
// client poseViewer.hasPose) so users can type bare spellings.
//
// `description` is the ENGLISH gloss (the app's UI language), shown under
// the Arabic word label.

export const AR_WORD_CATEGORIES = [
  { id: "core", label: "كلمات يومية" },
  { id: "people", label: "الناس" },
  { id: "feelings", label: "مشاعر وصفات" },
  { id: "body", label: "الجسم" },
  { id: "animals", label: "حيوانات" },
  { id: "places", label: "أماكن وطبيعة" },
  { id: "school", label: "مدرسة وعمل" },
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
  "جلس": { category: "core", description: "Sit" },
  "اليسار": { category: "core", description: "Left (direction)" },

  "أنا": { category: "people", description: "I / me" },
  "أم": { category: "people", description: "Mother" },
  "جد": { category: "people", description: "Grandfather" },
  "امرأة": { category: "people", description: "Woman" },
  "أسرة": { category: "people", description: "Family" },
  "الطبيب": { category: "people", description: "Doctor" },

  "حب": { category: "feelings", description: "Love" },
  "خائف": { category: "feelings", description: "Afraid" },
  "جميل": { category: "feelings", description: "Beautiful" },
  "حلو": { category: "feelings", description: "Sweet / nice" },
  "جديد": { category: "feelings", description: "New" },
  "أزرق": { category: "feelings", description: "Blue" },

  "الرأس": { category: "body", description: "Head" },
  "القلب": { category: "body", description: "Heart" },
  "أذن": { category: "body", description: "Ear" },

  "حصان": { category: "animals", description: "Horse" },
  "أسد": { category: "animals", description: "Lion" },

  "جبل": { category: "places", description: "Mountain" },
  "ثلج": { category: "places", description: "Snow / ice" },
  "السوق": { category: "places", description: "Market" },
  "الباب": { category: "places", description: "Door" },
  "حمام": { category: "places", description: "Bathroom" },

  "امتحان": { category: "school", description: "Exam" },
  "العمل": { category: "school", description: "Work" },

  "اليوم": { category: "time", description: "Today" },
  "أمس": { category: "time", description: "Yesterday" },
  "الآن": { category: "time", description: "Now" },
  "دقيقة": { category: "time", description: "Minute" },

  "خبز": { category: "food", description: "Bread" },
  "حليب": { category: "food", description: "Milk" },
  "جبن": { category: "food", description: "Cheese" },
  "أرز": { category: "food", description: "Rice" },
  "السكر": { category: "food", description: "Sugar" },
};

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
