// Full-body ASL word keyframes (educational pacing).
//
// Canvas: 320 × 500 px  |  Right shoulder [215,108]  Left shoulder [105,108]
// The elbow is solved with 2-joint IK — only wrist targets are stored here.
//
// Keyframe fields
// ──────────────────────────────────────────────────────────────────
//  rWrist / lWrist : [x,y] absolute canvas-px wrist target
//  rHand  / lHand  : key into ASL_POSES (A-Z / ILY / ' '), null = relaxed hand
//  hold            : ms to FREEZE after arriving (lets learners read the shape)
//  headDY          : head y-offset px (+down / -up)
//  rShoulderDY     : right-shoulder y-offset      lShoulderDY: left-shoulder
//  dur             : transition duration ms (scaled by the speed multiplier)
//  ease            : 'linear'|'easeIn'|'easeOut'|'easeInOut'|'easeOutBack'
//
// Handshapes/movements were reviewed against ASL references; the `description`
// is the plain-language cue shown to the learner.

export const RN = [235, 250]; // right wrist neutral (relaxed at side)
export const LN = [85,  250]; // left  wrist neutral

export const WORD_ANIMS = {

  HELLO: {
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
    description: "Flat hand chops down sharply onto the other flat palm — one strike, no bounce",
    frames: [
      { rWrist: [252, 128], lWrist: [148, 176], rHand: "B", lHand: "B",
        dur: 620, hold: 650, ease: "easeOut" },
      // single sharp strike — accelerates INTO contact and stops dead, no rebound
      { rWrist: [196, 176], lWrist: [148, 176], rHand: "B", lHand: "B",
        dur: 380, hold: 900, ease: "easeIn" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

  GO: {
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
    description: "Relaxed hand plucks info off the palm, rising as a flat-O to the forehead",
    frames: [
      // relaxed, half-open hand hovers above the flat base palm (not flat-B yet)
      { rWrist: [166, 182], lWrist: [140, 188], rHand: null, lHand: "B",
        dur: 640, hold: 700, ease: "easeOut" },
      // pinch to a flat-O and rise to the forehead
      { rWrist: [204, 78], lWrist: LN, rHand: "O", lHand: null,
        rShoulderDY: -7,
        dur: 820, hold: 1000, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        rShoulderDY: 0,
        dur: 720, ease: "easeIn" },
    ],
  },

  NAME: {
    description: "Two H-hands cross and tap twice",
    frames: [
      { rWrist: [182, 168], lWrist: [138, 168], rHand: "H", lHand: "H",
        dur: 640, hold: 650, ease: "easeOut" },
      { rWrist: [180, 162], lWrist: [140, 168], rHand: "H", lHand: "H",   // tap
        dur: 380, hold: 420, ease: "easeInOut" },
      { rWrist: [182, 170], lWrist: [138, 168], rHand: "H", lHand: "H",
        dur: 360, hold: 240, ease: "easeInOut" },
      { rWrist: [180, 162], lWrist: [140, 168], rHand: "H", lHand: "H",   // tap
        dur: 380, hold: 420, ease: "easeInOut" },
      { rWrist: RN, lWrist: LN, rHand: null, lHand: null,
        dur: 660, ease: "easeIn" },
    ],
  },

};

export const WORD_LIST = Object.keys(WORD_ANIMS);
