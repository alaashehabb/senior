// Full-body ASL word keyframes (educational pacing).
//
// Canvas: 320 × 500 px  |  Right shoulder [215,108]  Left shoulder [105,108]
// The elbow is solved with 2-joint IK — only wrist targets are stored here.
//
// Keyframe fields
// ──────────────────────────────────────────────────────────────────
//  rWrist / lWrist : [x,y] absolute canvas-px wrist target
//  rHand  / lHand  : key into ASL_POSES (A-Z / ILY / ONE-FIVE / ' '), null = relaxed hand
//  hold            : ms to FREEZE after arriving (lets learners read the shape)
//  headDY          : head y-offset px (+down / -up)
//  rShoulderDY     : right-shoulder y-offset      lShoulderDY: left-shoulder
//  dur             : transition duration ms (scaled by the speed multiplier)
//  ease            : 'linear'|'easeIn'|'easeOut'|'easeInOut'|'easeOutBack'
//  category        : groups entries in the word picker (see WORD_CATEGORIES)
//
// Handshapes/movements were reviewed against ASL references; the `description`
// is the plain-language cue shown to the learner.

export const RN = [235, 250]; // right wrist neutral (relaxed at side)
export const LN = [85,  250]; // left  wrist neutral

export const WORD_CATEGORIES = [
  { id: "core", label: "Everyday Words" },
  { id: "grammar", label: "Connecting Words" },
  { id: "people", label: "People" },
  { id: "feelings", label: "Feelings" },
  { id: "questions", label: "Questions" },
  { id: "time", label: "Time" },
  { id: "numbers", label: "Numbers" },
];

export const WORD_ANIMS = {

  HELLO: {
    category: "core",
    description: "Flat hand salutes outward from the temple",
    frames: [
      // hand up to the temple (fingers by the forehead)
      { rWrist: [206, 74], rHand: "B", rShoulderDY: -5,
        dur: 550, hold: 650, ease: "easeOut" },
      // swing outward like a casual salute — hold so the B-hand is clear
      { rWrist: [272, 92], rHand: "B", rShoulderDY: -4,
        dur: 650, hold: 700, ease: "easeInOut" },
      // return to side
      { rWrist: RN, rHand: null, rShoulderDY: 0,
        dur: 650, ease: "easeIn" },
    ],
  },

  "THANK YOU": {
    category: "core",
    description: "Flat fingertips touch the chin, then move out toward you",
    frames: [
      // fingertips at the chin
      { rWrist: [196, 96], rHand: "B", headDY: -2,
        dur: 600, hold: 800, ease: "easeOut" },
      // move forward/down toward the listener
      { rWrist: [250, 140], rHand: "B", headDY: 0,
        dur: 700, hold: 800, ease: "easeOut" },
      { rWrist: RN, rHand: null,
        dur: 650, ease: "easeIn" },
    ],
  },

  YES: {
    category: "core",
    description: "'S' fist bobs up and down like a nodding head",
    frames: [
      { rWrist: [200, 120], rHand: "S",
        dur: 500, hold: 450, ease: "easeOut" },
      { rWrist: [200, 138], rHand: "S", headDY: 6,   // nod down
        dur: 320, hold: 250, ease: "easeInOut" },
      { rWrist: [200, 120], rHand: "S", headDY: 0,   // up
        dur: 300, hold: 220, ease: "easeInOut" },
      { rWrist: [200, 138], rHand: "S", headDY: 6,   // nod again
        dur: 320, hold: 250, ease: "easeInOut" },
      { rWrist: [200, 120], rHand: "S", headDY: 0,
        dur: 300, ease: "easeInOut" },
      { rWrist: RN, rHand: null,
        dur: 600, ease: "easeIn" },
    ],
  },

  NO: {
    category: "core",
    description: "Index + middle snap down onto the thumb, twice",
    frames: [
      // open: two fingers up
      { rWrist: [252, 108], rHand: "U",
        dur: 520, hold: 550, ease: "easeOut" },
      // snap closed onto the thumb
      { rWrist: [252, 108], rHand: "N",
        dur: 300, hold: 380, ease: "easeInOut" },
      // open
      { rWrist: [252, 108], rHand: "U",
        dur: 300, hold: 300, ease: "easeInOut" },
      // snap again
      { rWrist: [252, 108], rHand: "N",
        dur: 300, hold: 400, ease: "easeInOut" },
      { rWrist: RN, rHand: null,
        dur: 620, ease: "easeIn" },
    ],
  },

  PLEASE: {
    category: "core",
    description: "Flat hand rubs a repeated circle on the chest",
    frames: [
      { rWrist: [196, 150], rHand: "B",
        dur: 550, hold: 350, ease: "easeOut" },
      { rWrist: [192, 134], rHand: "B", dur: 380, hold: 100, ease: "easeInOut" }, // top (loop 1)
      { rWrist: [208, 146], rHand: "B", dur: 360, hold: 100, ease: "easeInOut" }, // right
      { rWrist: [196, 162], rHand: "B", dur: 380, hold: 100, ease: "easeInOut" }, // bottom
      { rWrist: [182, 148], rHand: "B", dur: 360, hold: 100, ease: "easeInOut" }, // left
      { rWrist: [192, 134], rHand: "B", dur: 380, hold: 100, ease: "easeInOut" }, // top (loop 2)
      { rWrist: [208, 146], rHand: "B", dur: 360, hold: 100, ease: "easeInOut" }, // right
      { rWrist: [196, 162], rHand: "B", dur: 380, hold: 100, ease: "easeInOut" }, // bottom
      { rWrist: [182, 148], rHand: "B", dur: 360, hold: 100, ease: "easeInOut" }, // left
      { rWrist: [192, 134], rHand: "B", dur: 380, hold: 300, ease: "easeInOut" }, // top (end)
      { rWrist: RN, rHand: null, dur: 660, ease: "easeIn" },
    ],
  },

  SORRY: {
    category: "core",
    description: "Fist (thumb up) rubs a circle on the chest",
    frames: [
      { rWrist: [196, 150], rHand: "A",
        dur: 550, hold: 550, ease: "easeOut" },
      { rWrist: [192, 134], rHand: "A", dur: 460, hold: 160, ease: "easeInOut" },
      { rWrist: [208, 146], rHand: "A", dur: 440, hold: 160, ease: "easeInOut" },
      { rWrist: [196, 162], rHand: "A", dur: 460, hold: 160, ease: "easeInOut" },
      { rWrist: [182, 148], rHand: "A", dur: 440, hold: 160, ease: "easeInOut" },
      { rWrist: [192, 134], rHand: "A", dur: 460, hold: 360, ease: "easeInOut" },
      { rWrist: RN, rHand: null, dur: 660, ease: "easeIn" },
    ],
  },

  "I LOVE YOU": {
    category: "core",
    description: "Thumb, index and pinky all extended, held up",
    frames: [
      { rWrist: RN, rHand: null, dur: 380, ease: "easeOut" },
      // raise with a gentle overshoot; long hold to study the shape
      { rWrist: [250, 122], rHand: "ILY", rShoulderDY: -8,
        dur: 700, hold: 1300, ease: "easeOutBack" },
      { rWrist: RN, rHand: null, rShoulderDY: 0,
        dur: 700, ease: "easeIn" },
    ],
  },

  EAT: {
    category: "core",
    description: "Bunched fingertips tap the mouth twice",
    frames: [
      { rWrist: [196, 86], rHand: "O",
        dur: 600, hold: 650, ease: "easeOut" },
      { rWrist: [196, 80], rHand: "O", dur: 340, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: [196, 88], rHand: "O", dur: 320, hold: 200, ease: "easeInOut" },
      { rWrist: [196, 80], rHand: "O", dur: 340, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: RN, rHand: null, dur: 620, ease: "easeIn" },
    ],
  },

  DRINK: {
    category: "core",
    description: "C-hand rises to the mouth and tips back like sipping a cup",
    frames: [
      // rise straight to the mouth — no meaningful stop at chest height
      { rWrist: [200, 92], rHand: "C", rShoulderDY: -3,
        dur: 650, hold: 450, ease: "easeOut" },
      // tip back slightly at the mouth (the sip) — small motion, same spot
      { rWrist: [196, 84], rHand: "C", rShoulderDY: -3,
        dur: 340, hold: 450, ease: "easeInOut" },
      { rWrist: [200, 92], rHand: "C", rShoulderDY: -3,
        dur: 320, hold: 250, ease: "easeInOut" },
      { rWrist: RN, rHand: null, rShoulderDY: 0, dur: 650, ease: "easeIn" },
    ],
  },

  WATER: {
    category: "core",
    description: "W-hand taps the chin twice",
    frames: [
      { rWrist: [198, 94], rHand: "W",
        dur: 600, hold: 700, ease: "easeOut" },
      { rWrist: [198, 102], rHand: "W", dur: 340, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: [198, 94], rHand: "W", dur: 320, hold: 200, ease: "easeInOut" },
      { rWrist: [198, 102], rHand: "W", dur: 340, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: RN, rHand: null, dur: 620, ease: "easeIn" },
    ],
  },

  MORE: {
    category: "core",
    description: "Two bunched hands tap fingertips together twice",
    frames: [
      { rWrist: [206, 165], lWrist: [114, 165], rHand: "O", lHand: "O",
        dur: 620, hold: 650, ease: "easeOut" },
      { rWrist: [188, 162], lWrist: [132, 162], rHand: "O", lHand: "O",   // tap
        dur: 460, hold: 500, ease: "easeInOut" },
      { rWrist: [208, 168], lWrist: [112, 168], rHand: "O", lHand: "O",   // apart
        dur: 440, hold: 280, ease: "easeInOut" },
      { rWrist: [188, 162], lWrist: [132, 162], rHand: "O", lHand: "O",   // tap
        dur: 460, hold: 500, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  HELP: {
    category: "core",
    description: "A thumbs-up fist rests on a flat palm; both lift up",
    frames: [
      // thumbs-up fist sitting on the open base palm
      { rWrist: [188, 208], lWrist: [128, 214], rHand: "A", lHand: "B",
        dur: 640, hold: 750, ease: "easeOut" },
      // lift together, slight overshoot, long hold
      { rWrist: [182, 166], lWrist: [122, 172], rHand: "A", lHand: "B",
        rShoulderDY: -10, lShoulderDY: -10,
        dur: 780, hold: 950, ease: "easeOutBack" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        rShoulderDY: 0, lShoulderDY: 0,
        dur: 720, ease: "easeIn" },
    ],
  },

  STOP: {
    category: "core",
    description: "Flat hand chops down sharply onto the other flat upturned palm — one strike, no bounce",
    frames: [
      // left hand raised palm-up at chest height (stays fixed for the rest of the sign);
      // right hand raised up and to the side, poised to strike
      { rWrist: [240, 95], lWrist: [120, 168], rHand: "B", lHand: "B",
        dur: 600, hold: 500, ease: "easeOut" },
      // single sharp strike — accelerates INTO contact near the left palm and stops
      // dead, no rebound. Kept offset from the left wrist (not stacked on top of it)
      // so both flat hands stay visually distinct instead of merging into one blob.
      { rWrist: [186, 138], lWrist: [120, 168], rHand: "B", lHand: "B",
        dur: 300, hold: 900, ease: "easeIn" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  GO: {
    category: "core",
    description: "Index finger points and thrusts forward",
    frames: [
      { rWrist: [244, 140], rHand: "D",
        dur: 600, hold: 650, ease: "easeOut" },
      { rWrist: [282, 120], rHand: "D", rShoulderDY: -5,   // thrust out
        dur: 660, hold: 800, ease: "easeOutBack" },
      { rWrist: RN, rHand: null, rShoulderDY: 0,
        dur: 660, ease: "easeIn" },
    ],
  },

  COME: {
    category: "core",
    description: "Both index fingers hook and arc inward toward you — a single beckoning motion",
    frames: [
      // both hands extended out, index fingers pointing
      { rWrist: [266, 138], lWrist: [54, 138], rHand: "D", lHand: "D",
        dur: 600, hold: 550, ease: "easeOut" },
      // arc inward and slightly up toward the chest/chin, hooking as they pull in
      { rWrist: [204, 116], lWrist: [116, 116], rHand: "X", lHand: "X",
        dur: 640, hold: 800, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  LEARN: {
    category: "core",
    description: "Relaxed hand plucks info off the palm, rising as a flat-O to touch the forehead",
    frames: [
      // relaxed, half-open hand hovers above the flat base palm (not flat-B yet)
      { rWrist: [166, 182], lWrist: [140, 188], rHand: null, lHand: "B",
        dur: 640, hold: 700, ease: "easeOut" },
      // pinch to a flat-O and rise to the forehead — target sits INSIDE the head
      // circle (center [160,55], r 28) so the hand actually reaches/touches the
      // forehead instead of floating beside it
      { rWrist: [178, 46], lWrist: LN, rHand: "O", lHand: null,
        rShoulderDY: -7,
        dur: 820, hold: 1000, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        rShoulderDY: 0,
        dur: 720, ease: "easeIn" },
    ],
  },

  NAME: {
    category: "core",
    description: "Two H-hands cross and tap twice",
    frames: [
      // left H stays fixed at chest height for the rest of the sign;
      // right H raised up and to the side, ready to tap down onto it
      { rWrist: [206, 150], lWrist: [112, 176], rHand: "H", lHand: "H",
        dur: 600, hold: 500, ease: "easeOut" },
      // tap 1 — offset from the left wrist (not stacked on it) so both H-hands
      // stay visually distinct instead of merging into one blob
      { rWrist: [178, 163], lWrist: [112, 176], rHand: "H", lHand: "H",
        dur: 280, hold: 340, ease: "easeInOut" },
      // small lift clear of the left hand before the second tap
      { rWrist: [196, 142], lWrist: [112, 176], rHand: "H", lHand: "H",
        dur: 260, hold: 160, ease: "easeInOut" },
      // tap 2 — same contact point as tap 1
      { rWrist: [178, 163], lWrist: [112, 176], rHand: "H", lHand: "H",
        dur: 280, hold: 420, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  SEE: {
    category: "core",
    description: "V-fingers start at the eye, then move out toward what you see",
    frames: [
      // V-fingertips at the eye line (V tips render ≈57px above the wrist,
      // so the wrist sits at cheek/jaw height: tips ≈ [168,50] = right eye)
      { rWrist: [179, 107], rHand: "V",
        dur: 600, hold: 700, ease: "easeOut" },
      // move forward/out and down, keeping the V (path kept clear of the
      // shoulder joint, where the arm IK is unstable)
      { rWrist: [240, 158], rHand: "V",
        dur: 640, hold: 800, ease: "easeInOut" },
      { rWrist: RN, rHand: null, dur: 640, ease: "easeIn" },
    ],
  },

  WANT: {
    category: "core",
    description: "Both open hands reach out, then pull in toward the body",
    frames: [
      // both open hands reaching out
      { rWrist: [248, 158], lWrist: [72, 158], rHand: "FIVE", lHand: "FIVE",
        dur: 620, hold: 600, ease: "easeOut" },
      // draw them in toward the body (fingers curl slightly in real ASL)
      { rWrist: [206, 172], lWrist: [114, 172], rHand: "FIVE", lHand: "FIVE",
        dur: 620, hold: 850, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  KNOW: {
    category: "core",
    description: "Flat fingertips tap the side of the forehead",
    frames: [
      // flat-hand fingertips (≈61px above the wrist) at the forehead edge
      // [~178,37], so the wrist sits at chin height beside the head
      { rWrist: [182, 98], rHand: "B",
        dur: 600, hold: 650, ease: "easeOut" },
      { rWrist: [188, 104], rHand: "B", dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [182, 98], rHand: "B", dur: 300, hold: 350, ease: "easeInOut" },  // tap
      { rWrist: [188, 104], rHand: "B", dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [182, 98], rHand: "B", dur: 300, hold: 400, ease: "easeInOut" },  // tap
      { rWrist: RN, rHand: null, dur: 640, ease: "easeIn" },
    ],
  },

  FINISH: {
    category: "core",
    description: "Both open hands held up, then flicked outward — all done",
    frames: [
      // both open hands up at chest height, palms in
      { rWrist: [204, 132], lWrist: [116, 132], rHand: "FIVE", lHand: "FIVE",
        dur: 620, hold: 650, ease: "easeOut" },
      // quick flick outward to the sides
      { rWrist: [248, 146], lWrist: [72, 146], rHand: "FIVE", lHand: "FIVE",
        dur: 380, hold: 900, ease: "easeOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  // ── People & pronouns ────────────────────────────────────────────────────────
  ME: {
    category: "people",
    description: "Index finger points in and touches the middle of the chest",
    frames: [
      // index raised in front of the body
      { rWrist: [230, 190], rHand: "ONE",
        dur: 550, hold: 450, ease: "easeOut" },
      // draw in so the fingertip (≈58px above the wrist) touches the chest
      { rWrist: [194, 178], rHand: "ONE",
        dur: 480, hold: 950, ease: "easeInOut" },
      { rWrist: RN, rHand: null, dur: 620, ease: "easeIn" },
    ],
  },

  YOU: {
    category: "people",
    description: "Index finger points straight out at the person you mean",
    frames: [
      // hand comes up pointing
      { rWrist: [240, 146], rHand: "ONE",
        dur: 550, hold: 400, ease: "easeOut" },
      // one clear poke outward — shorter and flatter than GO's thrust
      { rWrist: [268, 142], rHand: "ONE",
        dur: 420, hold: 950, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 620, ease: "easeIn" },
    ],
  },

  MOTHER: {
    category: "people",
    description: "Open hand, thumb taps the chin twice",
    frames: [
      // open 5-hand held so the THUMB TIP (≈[-48,-40] from the wrist) rests
      // at the chin [~168,84]; the fingers fan up clear of the head's right side
      { rWrist: [215, 124], rHand: "FIVE",
        dur: 600, hold: 650, ease: "easeOut" },
      { rWrist: [223, 132], rHand: "FIVE", dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [215, 124], rHand: "FIVE", dur: 300, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: [223, 132], rHand: "FIVE", dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [215, 124], rHand: "FIVE", dur: 300, hold: 400, ease: "easeInOut" }, // tap
      { rWrist: RN, rHand: null, dur: 640, ease: "easeIn" },
    ],
  },

  FATHER: {
    category: "people",
    description: "Open hand, thumb taps the forehead twice",
    frames: [
      // same open hand as MOTHER — approach up the FRONT of the body (chest
      // waypoint) so the IK elbow settles outward; a straight rise from rest
      // walks the elbow over the top and leaves the forearm across the face
      { rWrist: [205, 140], rHand: "FIVE", rShoulderDY: -3,
        dur: 380, ease: "easeOut" },
      // then up so the thumb tip reaches the upper forehead [~156,32]. The
      // wrist must stay LEFT of the shoulder (like EAT/DRINK): a wrist above
      // or right of it puts the folded arm's IK on its unstable axis and the
      // forearm can render across the face.
      { rWrist: [204, 72], rHand: "FIVE", rShoulderDY: -8,
        dur: 420, hold: 650, ease: "easeOut" },
      { rWrist: [210, 80], rHand: "FIVE", rShoulderDY: -8, dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [204, 72], rHand: "FIVE", rShoulderDY: -8, dur: 300, hold: 350, ease: "easeInOut" }, // tap
      { rWrist: [210, 80], rHand: "FIVE", rShoulderDY: -8, dur: 320, hold: 200, ease: "easeInOut" }, // off
      { rWrist: [204, 72], rHand: "FIVE", rShoulderDY: -8, dur: 300, hold: 400, ease: "easeInOut" }, // tap
      { rWrist: RN, rHand: null, rShoulderDY: 0, dur: 640, ease: "easeIn" },
    ],
  },

  LOVE: {
    category: "people",
    description: "Both fists cross over the heart, like hugging something close",
    frames: [
      // fists rise toward the chest
      { rWrist: [212, 150], lWrist: [108, 150], rHand: "S", lHand: "S",
        dur: 600, hold: 300, ease: "easeOut" },
      // cross the forearms over the chest — right fist to the left side and
      // vice versa, kept a hand-width apart diagonally so the fists read as
      // two distinct hands instead of merging
      { rWrist: [132, 144], lWrist: [188, 174], rHand: "S", lHand: "S",
        dur: 620, hold: 1100, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 680, ease: "easeIn" },
    ],
  },

  // ── Feelings ─────────────────────────────────────────────────────────────────
  HAPPY: {
    category: "feelings",
    description: "Flat hand brushes upward on the chest, twice",
    frames: [
      // wrist low so the flat hand's fingertips (≈61px above it) sit on the
      // chest, not the chin
      { rWrist: [198, 186], rHand: "B",
        dur: 560, hold: 350, ease: "easeOut" },
      { rWrist: [193, 162], rHand: "B", dur: 380, hold: 250, ease: "easeOut" },   // brush up
      { rWrist: [198, 186], rHand: "B", dur: 340, hold: 150, ease: "easeIn" },    // reset
      { rWrist: [193, 162], rHand: "B", dur: 380, hold: 500, ease: "easeOut" },   // brush up
      { rWrist: RN, rHand: null, dur: 640, ease: "easeIn" },
    ],
  },

  SAD: {
    category: "feelings",
    description: "Both open hands slide down in front of the face as the head drops",
    frames: [
      // open hands raised IN FRONT of the face — fingertips (≈61px above the
      // wrist) start at eye level, so the wrists sit at shoulder height
      { rWrist: [192, 111], lWrist: [128, 111], rHand: "FIVE", lHand: "FIVE",
        rShoulderDY: -4, lShoulderDY: -4,
        dur: 640, hold: 500, ease: "easeOut" },
      // slide down past the chin as the head droops (hands kept a hand-width
      // apart so the right thumb doesn't overlap the left hand)
      { rWrist: [192, 152], lWrist: [128, 152], rHand: "FIVE", lHand: "FIVE",
        headDY: 6, rShoulderDY: 0, lShoulderDY: 0,
        dur: 780, hold: 900, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null, headDY: 0,
        dur: 680, ease: "easeIn" },
    ],
  },

  CRY: {
    category: "feelings",
    description: "Both index fingers trace tears down the cheeks, twice",
    frames: [
      // index fingertips (≈58px above the wrist) start at the cheeks [~184,74]
      // and [~136,74], so the wrists sit at chest height
      { rWrist: [200, 132], lWrist: [152, 132], rHand: "ONE", lHand: "ONE",
        dur: 620, hold: 450, ease: "easeOut" },
      { rWrist: [200, 158], lWrist: [152, 158], rHand: "ONE", lHand: "ONE",  // tears fall
        dur: 520, hold: 250, ease: "easeInOut" },
      { rWrist: [200, 132], lWrist: [152, 132], rHand: "ONE", lHand: "ONE",  // back up
        dur: 420, hold: 150, ease: "easeInOut" },
      { rWrist: [200, 158], lWrist: [152, 158], rHand: "ONE", lHand: "ONE",  // tears fall
        dur: 520, hold: 600, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  // ── Question words ───────────────────────────────────────────────────────────
  WHERE: {
    category: "questions",
    description: "Index finger held up wags side to side",
    frames: [
      { rWrist: [244, 140], rHand: "ONE",
        dur: 560, hold: 350, ease: "easeOut" },
      { rWrist: [232, 140], rHand: "ONE", dur: 260, ease: "easeInOut" }, // wag left
      { rWrist: [254, 140], rHand: "ONE", dur: 260, ease: "easeInOut" }, // wag right
      { rWrist: [232, 140], rHand: "ONE", dur: 260, ease: "easeInOut" },
      { rWrist: [254, 140], rHand: "ONE", dur: 260, hold: 550, ease: "easeInOut" },
      { rWrist: RN, rHand: null, dur: 620, ease: "easeIn" },
    ],
  },

  WHAT: {
    category: "questions",
    description: "Both open hands, palms up, shake outward — a questioning shrug",
    frames: [
      // both open hands out at waist height, palms up
      { rWrist: [204, 172], lWrist: [116, 172], rHand: "FIVE", lHand: "FIVE",
        dur: 620, hold: 400, ease: "easeOut" },
      { rWrist: [218, 176], lWrist: [102, 176], rHand: "FIVE", lHand: "FIVE",  // shake out
        dur: 340, hold: 200, ease: "easeInOut" },
      { rWrist: [204, 172], lWrist: [116, 172], rHand: "FIVE", lHand: "FIVE",  // in
        dur: 320, hold: 150, ease: "easeInOut" },
      { rWrist: [218, 176], lWrist: [102, 176], rHand: "FIVE", lHand: "FIVE",  // shake out
        dur: 340, hold: 650, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  // ── Time ─────────────────────────────────────────────────────────────────────
  NOW: {
    category: "time",
    description: "Both Y-hands drop down together in one firm motion — right here, right now",
    frames: [
      // Y-hands (thumb + pinky out) held up
      { rWrist: [206, 144], lWrist: [114, 144], rHand: "Y", lHand: "Y",
        dur: 620, hold: 550, ease: "easeOut" },
      // one decisive drop
      { rWrist: [206, 174], lWrist: [114, 174], rHand: "Y", lHand: "Y",
        dur: 340, hold: 950, ease: "easeIn" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  TOMORROW: {
    category: "time",
    description: "Thumb of an 'A' fist starts at the chin and arcs forward",
    frames: [
      // thumb-up fist with the thumb tip (≈[-29,-35] from the wrist) at the
      // side of the chin [~172,80]
      { rWrist: [201, 115], rHand: "A",
        dur: 600, hold: 650, ease: "easeOut" },
      // arc forward and down (into the future); path kept clear of the
      // shoulder joint, where the arm IK is unstable
      { rWrist: [242, 160], rHand: "A",
        dur: 620, hold: 850, ease: "easeInOut" },
      { rWrist: RN, rHand: null, dur: 640, ease: "easeIn" },
    ],
  },

  // ── Connecting words (pose-only: no canvas keyframes — these exist purely
  //    as sign.mt .pose files, so `frames` is omitted; the canvas fallback
  //    skips entries without frames) ─────────────────────────────────────────
  AND: {
    category: "grammar",
    description: "Open hand sweeps to the side, fingers closing together",
  },
  IS: {
    category: "grammar",
    description: "Pinky hand at the chin moves forward",
  },
  HAS: {
    category: "grammar",
    description: "Bent-hand fingertips draw in to the chest",
  },
  WAS: {
    category: "grammar",
    description: "Hand near the cheek rolls back toward the shoulder (past tense)",
  },
  WERE: {
    category: "grammar",
    description: "Like WAS — the hand rolls back toward the shoulder (past tense)",
  },
  HOW: {
    category: "grammar",
    description: "Curved hands, knuckles together, roll forward",
  },

  // ── Numbers (citation form: raise, hold, lower — no motion needed) ──────────
  ONE: {
    category: "numbers",
    description: "Index finger held up — the number 1",
    frames: [
      { rWrist: [244, 150], rHand: "ONE", dur: 550, hold: 900, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 600, ease: "easeIn" },
    ],
  },

  TWO: {
    category: "numbers",
    description: "Index + middle up, spread — the number 2",
    frames: [
      { rWrist: [244, 150], rHand: "TWO", dur: 550, hold: 900, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 600, ease: "easeIn" },
    ],
  },

  THREE: {
    category: "numbers",
    description: "Thumb + index + middle extended — the number 3",
    frames: [
      { rWrist: [244, 150], rHand: "THREE", dur: 550, hold: 900, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 600, ease: "easeIn" },
    ],
  },

  FOUR: {
    category: "numbers",
    description: "Four fingers up, thumb folded in — the number 4",
    frames: [
      { rWrist: [244, 150], rHand: "FOUR", dur: 550, hold: 900, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 600, ease: "easeIn" },
    ],
  },

  FIVE: {
    category: "numbers",
    description: "All five fingers spread open — the number 5",
    frames: [
      { rWrist: [244, 150], rHand: "FIVE", dur: 550, hold: 900, ease: "easeOut" },
      { rWrist: RN, rHand: null, dur: 600, ease: "easeIn" },
    ],
  },

};

export const WORD_LIST = Object.keys(WORD_ANIMS);
