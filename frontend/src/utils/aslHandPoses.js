// ASL fingerspelling hand poses — MediaPipe 21-landmark format.
//
// Landmark order: 0=WRIST, 1-4=THUMB(CMC,MCP,IP,TIP),
// 5-8=INDEX(MCP,PIP,DIP,TIP), 9-12=MIDDLE, 13-16=RING, 17-20=PINKY.
// Coordinates are normalized; the renderer anchors the wrist and scales the
// rest, so fingers point "up" (smaller y) when extended.
//
// Convention: a right hand shown palm-toward-viewer, thumb on the left side.
// Handshapes were reviewed against ASL references (see ASL_HINTS for the single
// distinguishing cue per letter).

const R = Math.PI / 180; // degrees → radians

// ── Fixed palm anchor positions ───────────────────────────────────────────────
const W  = [0.50, 0.94]; // wrist
const TC = [0.34, 0.85]; // thumb CMC (base)
const IM = [0.36, 0.70]; // index  MCP
const MM = [0.46, 0.68]; // middle MCP
const RM = [0.56, 0.70]; // ring   MCP
const PM = [0.64, 0.74]; // pinky  MCP

// Segment lengths  [proximal, middle, distal] per finger
const SL = {
  idx: [0.095, 0.083, 0.072],
  mid: [0.101, 0.090, 0.078],
  rng: [0.093, 0.083, 0.072],
  pnk: [0.075, 0.065, 0.056],
};

// Build [MCP, PIP, DIP, TIP] from a start point, base direction and joint bends.
// base: degrees where 90=up, 0=right, -90=down.
// flex: [f0,f1,f2] added cumulatively at each joint (negative = curl to palm).
function seg4([sx, sy], base, segs, [f0, f1, f2]) {
  let x = sx, y = sy;
  const pts = [[x, y]];
  const dirs = [base + f0, base + f0 + f1, base + f0 + f1 + f2];
  for (let i = 0; i < 3; i++) {
    x += Math.cos(dirs[i] * R) * segs[i];
    y -= Math.sin(dirs[i] * R) * segs[i];
    pts.push([x, y]);
  }
  return pts; // [MCP, PIP, DIP, TIP]
}

// Thumb: 4 explicit points [CMC, MCP, IP, TIP].
function thumb(mx, my, ix, iy, tx, ty) {
  return [TC, [mx, my], [ix, iy], [tx, ty]];
}

// Assemble the full 21-landmark array.
function pose(th, i, m, rg, p) {
  return [W, ...th, ...i, ...m, ...rg, ...p];
}

// ── Common curl patterns ──────────────────────────────────────────────────────
const STR  = [0, 0, 0];           // straight
const MILD = [-20, -17, -12];     // gentle curve (C-shape)
const HALF = [-44, -38, -28];     // half-curl (meets thumb)
const CURL = [-74, -58, -36];     // tight fist
const TIGHT = [-80, -64, -40];    // tightest fist (pinky)
const HOOK = [-46, -80, -6];      // X-hook (bent mainly at PIP)
const DRAPE = [-58, -52, -32];    // finger folded over thumb (M/N)

const POSES = {};

// ─ A: fist, thumb straight up along the LEFT side (against the index) ─────────
POSES.A = pose(
  thumb(0.30, 0.78, 0.27, 0.71, 0.25, 0.64),
  seg4(IM, 88, SL.idx, CURL),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ S: fist, thumb wrapped ACROSS the FRONT of the fingers ────────────────────
POSES.S = [
  W,
  TC, [0.30, 0.78], [0.40, 0.75], [0.52, 0.74],  // thumb crosses front → right
  IM, [0.41, 0.73], [0.46, 0.79], [0.42, 0.82],  // index curled in
  MM, [0.52, 0.72], [0.55, 0.78], [0.50, 0.81],  // middle
  RM, [0.61, 0.74], [0.62, 0.80], [0.57, 0.83],  // ring
  PM, [0.66, 0.80], [0.64, 0.84], [0.60, 0.86],  // pinky
];

// ─ T: fist, thumb tip pokes UP between index and middle ──────────────────────
POSES.T = pose(
  thumb(0.34, 0.78, 0.39, 0.72, 0.42, 0.65),   // tip peeks between index & middle
  seg4(IM, 88, SL.idx, [-64, -58, -30]),        // index folds over thumb
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ E: all four fingers curl down together, tips resting on tucked thumb ───────
POSES.E = pose(
  thumb(0.30, 0.80, 0.40, 0.79, 0.48, 0.78),   // thumb tucked horizontally under
  seg4(IM, 88, SL.idx, [-34, -56, -30]),
  seg4(MM, 90, SL.mid, [-34, -56, -30]),
  seg4(RM, 88, SL.rng, [-32, -54, -28]),
  seg4(PM, 82, SL.pnk, [-30, -52, -26]),
);

// ─ M: three fingers drape OVER the thumb (thumb under index+middle+ring) ──────
POSES.M = pose(
  thumb(0.42, 0.80, 0.50, 0.80, 0.58, 0.80),   // thumb hidden across, peeks by pinky
  seg4(IM, 88, SL.idx, DRAPE),
  seg4(MM, 90, SL.mid, DRAPE),
  seg4(RM, 88, SL.rng, DRAPE),
  seg4(PM, 82, SL.pnk, CURL),
);

// ─ N: two fingers drape OVER the thumb (thumb under index+middle) ────────────
POSES.N = pose(
  thumb(0.38, 0.80, 0.46, 0.80, 0.53, 0.80),
  seg4(IM, 88, SL.idx, DRAPE),
  seg4(MM, 90, SL.mid, DRAPE),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, CURL),
);

// ─ O: all fingers curve to meet the thumb in a round hole ────────────────────
POSES.O = [
  W,
  TC, [0.28, 0.80], [0.31, 0.72], [0.38, 0.67],  // thumb curves inward/up
  IM, [0.40, 0.62], [0.42, 0.66], [0.40, 0.70],  // index arcs to thumb
  MM, [0.49, 0.61], [0.50, 0.65], [0.46, 0.69],  // middle
  RM, [0.57, 0.63], [0.56, 0.67], [0.51, 0.71],  // ring
  PM, [0.63, 0.70], [0.60, 0.73], [0.54, 0.74],  // pinky
];

// ─ B: four fingers straight up together, thumb folded ACROSS the palm ─────────
POSES.B = pose(
  thumb(0.32, 0.80, 0.40, 0.78, 0.47, 0.76),   // thumb lies across palm
  seg4([0.40, 0.70], 89, SL.idx, STR),
  seg4([0.47, 0.69], 90, SL.mid, STR),
  seg4([0.54, 0.70], 90, SL.rng, STR),
  seg4([0.61, 0.72], 90, SL.pnk, STR),
);

// ─ C: whole hand forms a curved C (opening to the right) ─────────────────────
POSES.C = pose(
  thumb(0.24, 0.78, 0.22, 0.69, 0.26, 0.60),   // thumb = bottom of the C
  seg4(IM, 70, SL.idx, MILD),
  seg4(MM, 72, SL.mid, MILD),
  seg4(RM, 74, SL.rng, MILD),
  seg4(PM, 76, SL.pnk, MILD),
);

// ─ D: index straight up; middle/ring/pinky meet thumb in a circle ────────────
POSES.D = pose(
  thumb(0.30, 0.79, 0.37, 0.72, 0.43, 0.67),   // thumb meets curled middle
  seg4(IM, 89, SL.idx, STR),
  seg4(MM, 90, SL.mid, HALF),
  seg4(RM, 88, SL.rng, HALF),
  seg4(PM, 82, SL.pnk, HALF),
);

// ─ F: thumb + index pinch a circle; other three straight up ──────────────────
POSES.F = pose(
  thumb(0.32, 0.77, 0.38, 0.70, 0.41, 0.65),
  seg4(IM, 85, SL.idx, HALF),
  seg4(MM, 90, SL.mid, STR),
  seg4(RM, 88, SL.rng, STR),
  seg4(PM, 82, SL.pnk, STR),
);

// ─ G: index points SIDEWAYS (right), thumb parallel below it ─────────────────
POSES.G = pose(
  thumb(0.36, 0.82, 0.48, 0.82, 0.60, 0.82),   // thumb parallel, points right
  seg4([0.38, 0.74], 0, SL.idx, STR),           // index horizontal →
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ H: index + middle point SIDEWAYS together, others curled ──────────────────
POSES.H = pose(
  thumb(0.32, 0.82, 0.40, 0.83, 0.46, 0.84),
  seg4([0.38, 0.72], 0, SL.idx, STR),
  seg4([0.38, 0.79], 0, SL.mid, STR),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ I: pinky straight up, all others curled ───────────────────────────────────
POSES.I = pose(
  thumb(0.30, 0.79, 0.27, 0.73, 0.28, 0.68),
  seg4(IM, 88, SL.idx, CURL),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 84, SL.pnk, STR),
);
POSES.J = POSES.I; // J = I plus a traced-hook motion (see MOTION_LETTERS)

// ─ K: index up + middle angled apart, thumb between them ─────────────────────
POSES.K = pose(
  thumb(0.34, 0.76, 0.40, 0.70, 0.44, 0.64),   // thumb rises between the two
  seg4(IM, 92, SL.idx, STR),
  seg4([0.48, 0.68], 66, SL.mid, STR),          // middle splays right
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ L: L-shape — index up, thumb straight OUT to the side ─────────────────────
POSES.L = pose(
  thumb(0.24, 0.82, 0.15, 0.82, 0.07, 0.82),   // thumb horizontal left
  seg4(IM, 90, SL.idx, STR),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ P: K rotated to point DOWN (index points down) ────────────────────────────
POSES.P = pose(
  thumb(0.34, 0.86, 0.42, 0.86, 0.48, 0.88),
  seg4([0.40, 0.72], -90, SL.idx, STR),         // index points down
  seg4([0.50, 0.72], -60, SL.mid, STR),         // middle splays down-right
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ Q: G rotated to point DOWN (index + thumb point down) ─────────────────────
POSES.Q = pose(
  thumb(0.34, 0.80, 0.34, 0.90, 0.34, 1.00),    // thumb points down
  seg4([0.44, 0.74], -90, SL.idx, STR),         // index points down
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ R: index + middle crossed ─────────────────────────────────────────────────
POSES.R = pose(
  thumb(0.30, 0.79, 0.27, 0.73, 0.27, 0.68),
  seg4([0.44, 0.70], 96, SL.idx, [0, 0, 0]),    // index leans right
  seg4([0.47, 0.70], 84, SL.mid, [0, 0, 0]),    // middle leans left → crossing
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ U: index + middle straight up TOGETHER ────────────────────────────────────
POSES.U = pose(
  thumb(0.30, 0.79, 0.27, 0.73, 0.28, 0.68),
  seg4([0.44, 0.70], 90, SL.idx, STR),
  seg4([0.50, 0.70], 90, SL.mid, STR),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ V: index + middle up, SPREAD apart ────────────────────────────────────────
POSES.V = pose(
  thumb(0.30, 0.79, 0.27, 0.73, 0.28, 0.68),
  seg4(IM, 80, SL.idx, STR),   // lean left
  seg4(MM, 100, SL.mid, STR),  // lean right
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ W: index + middle + ring straight up, thumb holds pinky ───────────────────
POSES.W = pose(
  thumb(0.32, 0.80, 0.40, 0.80, 0.50, 0.80),   // thumb pins the pinky
  seg4([0.38, 0.70], 84, SL.idx, STR),
  seg4([0.46, 0.68], 90, SL.mid, STR),
  seg4([0.55, 0.70], 96, SL.rng, STR),
  seg4(PM, 82, SL.pnk, CURL),
);

// ─ X: hooked index (bent mainly at the middle knuckle) ───────────────────────
POSES.X = pose(
  thumb(0.30, 0.79, 0.27, 0.73, 0.28, 0.68),
  seg4(IM, 90, SL.idx, HOOK),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ Y: thumb + pinky both extended, middle three curled ───────────────────────
POSES.Y = pose(
  thumb(0.24, 0.83, 0.15, 0.84, 0.07, 0.85),   // thumb spread out left
  seg4(IM, 88, SL.idx, CURL),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 84, SL.pnk, STR),
);

// ─ Z: index points ('1' shape); traces a Z in the air (see MOTION_LETTERS) ────
POSES.Z = pose(
  thumb(0.30, 0.79, 0.30, 0.74, 0.32, 0.70),
  seg4(IM, 89, SL.idx, STR),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ ILY: "I love you" — thumb out + index up + pinky up, middle/ring curled ────
POSES.ILY = pose(
  thumb(0.24, 0.83, 0.15, 0.84, 0.07, 0.85),   // thumb spread out left
  seg4(IM, 90, SL.idx, STR),                    // index up
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 84, SL.pnk, STR),                    // pinky up
);

// ── Numbers 1-5 (citation form, palm facing viewer) ───────────────────────────
// Distinct from the manual alphabet but built with the same helper vocabulary.

// ─ ONE: index straight up, thumb tucked at the side (like a fist with 1 finger) ─
POSES.ONE = pose(
  thumb(0.30, 0.78, 0.27, 0.71, 0.25, 0.64),
  seg4(IM, 89, SL.idx, STR),
  seg4(MM, 90, SL.mid, CURL),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ TWO: index + middle up, spread — same handshape as the letter V ───────────
POSES.TWO = POSES.V;

// ─ THREE: thumb + index + middle extended ─────────────────────────────────────
POSES.THREE = pose(
  thumb(0.26, 0.76, 0.20, 0.68, 0.16, 0.60),
  seg4(IM, 84, SL.idx, STR),
  seg4([0.49, 0.68], 96, SL.mid, STR),
  seg4(RM, 88, SL.rng, CURL),
  seg4(PM, 82, SL.pnk, TIGHT),
);

// ─ FOUR: index + middle + ring + pinky up, thumb folded across the palm ──────
POSES.FOUR = pose(
  thumb(0.32, 0.80, 0.40, 0.78, 0.47, 0.76),
  seg4([0.37, 0.71], 86, SL.idx, STR),
  seg4([0.46, 0.69], 90, SL.mid, STR),
  seg4([0.55, 0.70], 94, SL.rng, STR),
  seg4([0.63, 0.73], 98, SL.pnk, STR),
);

// ─ FIVE: all five fingers extended and spread, thumb out ─────────────────────
POSES.FIVE = pose(
  thumb(0.22, 0.76, 0.14, 0.68, 0.09, 0.60),
  seg4([0.37, 0.71], 82, SL.idx, STR),
  seg4([0.46, 0.69], 90, SL.mid, STR),
  seg4([0.55, 0.70], 98, SL.rng, STR),
  seg4([0.63, 0.73], 106, SL.pnk, STR),
);

// ─ Space: relaxed open hand ──────────────────────────────────────────────────
POSES[" "] = pose(
  thumb(0.24, 0.82, 0.16, 0.80, 0.11, 0.77),
  seg4(IM, 84, SL.idx, [-12, -9, -6]),
  seg4(MM, 90, SL.mid, [-12, -9, -6]),
  seg4(RM, 88, SL.rng, [-12, -9, -6]),
  seg4(PM, 80, SL.pnk, [-10, -8, -5]),
);

export const ASL_POSES = POSES;

// One-line "how it should look" cue per letter (drives the on-canvas caption).
export const ASL_HINTS = {
  A: "Fist — thumb up the side, against the index",
  B: "Flat hand, fingers together — thumb across the palm",
  C: "Curve the whole hand into a C",
  D: "Index up; other fingertips meet the thumb",
  E: "Fingers curl down onto the tucked thumb",
  F: "Thumb + index pinch a circle; three fingers up",
  G: "Index points sideways, thumb parallel",
  H: "Index + middle point sideways, together",
  I: "Pinky up, everything else in a fist",
  J: "Pinky up — draw a J in the air",
  K: "Index up, middle angled out, thumb between",
  L: "Index up + thumb out = an L",
  M: "Thumb under THREE fingers",
  N: "Thumb under TWO fingers",
  O: "Fingers + thumb form a round O",
  P: "Like K, but pointing down",
  Q: "Like G, but pointing down",
  R: "Cross index over middle",
  S: "Fist — thumb across the FRONT",
  T: "Fist — thumb between index & middle",
  U: "Index + middle up, together",
  V: "Index + middle up, spread apart",
  W: "Index + middle + ring up (thumb holds pinky)",
  X: "Hook the index finger",
  Y: "Thumb + pinky out (“hang loose”)",
  Z: "Index out — draw a Z in the air",
  " ": "Space",
  // Numbers 1-5 (not part of the fingerspelling alphabet, shared here for
  // consistency so any future feature — e.g. a quiz mode — can look up a
  // caption the same way it does for letters).
  ONE: "Index finger up, thumb tucked",
  TWO: "Index + middle up, spread apart",
  THREE: "Thumb + index + middle extended",
  FOUR: "Four fingers up, thumb folded in",
  FIVE: "All five fingers spread open",
};

// Letters whose meaning depends on movement (the hand traces the shape).
export const MOTION_LETTERS = ["J", "Z"];
