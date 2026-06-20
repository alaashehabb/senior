// ASL fingerspelling hand poses — MediaPipe 21-landmark format.
// Landmark order: 0=WRIST, 1-4=THUMB(CMC,MCP,IP,TIP),
// 5-8=INDEX(MCP,PIP,DIP,TIP), 9-12=MIDDLE, 13-16=RING, 17-20=PINKY
// Coordinates are normalized 0-1 within the hand canvas region.

const R = Math.PI / 180; // degrees → radians

// ── Fixed palm anchor positions ───────────────────────────────────────────────
const W  = [0.50, 0.92]; // wrist
const TC = [0.34, 0.84]; // thumb CMC (base)
const IM = [0.35, 0.70]; // index  MCP
const MM = [0.46, 0.68]; // middle MCP
const RM = [0.57, 0.70]; // ring   MCP
const PM = [0.65, 0.75]; // pinky  MCP

// Segment lengths  [proximal, middle, distal] per finger
const SL = {
  idx: [0.092, 0.082, 0.073],
  mid: [0.099, 0.089, 0.077],
  rng: [0.092, 0.082, 0.073],
  pnk: [0.074, 0.064, 0.056],
};

// Build [MCP, PIP, DIP, TIP] from starting point, base direction and joint flexions.
// base: degrees where 90=up, 0=right, -90=down.
// flex: [f0,f1,f2] added cumulatively at each joint (negative = curl toward palm).
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

// Thumb: always defined as 4 explicit points [CMC, MCP, IP, TIP].
function thumb(mx, my, ix, iy, tx, ty) {
  return [TC, [mx, my], [ix, iy], [tx, ty]];
}

// Assemble the full 21-landmark array.
function pose(th, i, m, rg, p) {
  return [W, ...th, ...i, ...m, ...rg, ...p];
}

// ── Common curl patterns ──────────────────────────────────────────────────────
const STR  = [0, 0, 0];           // straight
const MILD = [-18, -15, -10];     // gentle curve (C-shape)
const HALF = [-42, -36, -26];     // half-curl (O approach)
const CURL = [-72, -55, -33];     // tight fist
const HOOK = [-45, -78, 0];       // X-hook (bent mainly at PIP)

// ── Letter definitions ────────────────────────────────────────────────────────

const POSES = {};

// ─ B: all four fingers straight up, thumb tucked ─────────────────────────────
POSES.B = pose(
  thumb(0.24, 0.79, 0.18, 0.75, 0.21, 0.70),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, STR),
  seg4(RM, 85, SL.rng, STR),
  seg4(PM, 79, SL.pnk, STR),
);

// ─ S: closed fist — explicitly defined so every finger clearly curls in ───────
POSES.S = [
  W,
  TC, [0.27, 0.79], [0.35, 0.74], [0.43, 0.71],  // thumb over fingers
  IM, [0.43, 0.73], [0.48, 0.79], [0.44, 0.82],  // index curled in
  MM, [0.53, 0.72], [0.56, 0.78], [0.51, 0.81],  // middle
  RM, [0.62, 0.74], [0.63, 0.80], [0.58, 0.83],  // ring
  PM, [0.67, 0.80], [0.65, 0.84], [0.61, 0.86],  // pinky
];

// ─ O: explicitly defined — fingers curve to meet thumb in a clear oval ────────
POSES.O = [
  W,
  TC, [0.26, 0.80], [0.28, 0.72], [0.36, 0.67],  // thumb curves inward
  IM, [0.39, 0.63], [0.42, 0.65], [0.40, 0.70],  // index arcs back
  MM, [0.48, 0.61], [0.49, 0.64], [0.46, 0.69],  // middle
  RM, [0.56, 0.63], [0.55, 0.67], [0.51, 0.71],  // ring
  PM, [0.62, 0.70], [0.60, 0.74], [0.55, 0.75],  // pinky
];

// ─ A: fist with thumb beside (not over) ──────────────────────────────────────
POSES.A = pose(
  thumb(0.25, 0.79, 0.20, 0.74, 0.19, 0.70),
  seg4(IM, 85, SL.idx, CURL),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ C: gentle outward curve ───────────────────────────────────────────────────
POSES.C = pose(
  thumb(0.22, 0.80, 0.17, 0.76, 0.16, 0.72),
  seg4(IM, 85, SL.idx, MILD),
  seg4(MM, 89, SL.mid, [-20, -17, -12]),
  seg4(RM, 85, SL.rng, MILD),
  seg4(PM, 79, SL.pnk, [-16, -13, -9]),
);

// ─ D: index straight up, others curled, thumb touches middle ─────────────────
POSES.D = pose(
  thumb(0.27, 0.79, 0.34, 0.72, 0.41, 0.67),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ E: all fingers bent at middle knuckle ─────────────────────────────────────
POSES.E = pose(
  thumb(0.28, 0.78, 0.35, 0.73, 0.41, 0.71),
  seg4(IM, 85, SL.idx, [-30, -52, -26]),
  seg4(MM, 89, SL.mid, [-30, -52, -26]),
  seg4(RM, 85, SL.rng, [-28, -50, -24]),
  seg4(PM, 79, SL.pnk, [-26, -48, -22]),
);

// ─ F: index + thumb touch, other three straight ───────────────────────────────
POSES.F = pose(
  thumb(0.30, 0.77, 0.36, 0.70, 0.39, 0.65),
  seg4(IM, 85, SL.idx, HALF),
  seg4(MM, 89, SL.mid, STR),
  seg4(RM, 85, SL.rng, STR),
  seg4(PM, 79, SL.pnk, STR),
);

// ─ G: index points sideways (right), thumb alongside ────────────────────────
POSES.G = pose(
  thumb(0.26, 0.78, 0.22, 0.75, 0.18, 0.73),
  seg4(IM, 0, SL.idx, STR),   // base=0° → points right
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ H: index + middle horizontal (pointing right), others curled ──────────────
POSES.H = pose(
  thumb(0.26, 0.78, 0.21, 0.75, 0.18, 0.73),
  seg4(IM, 0, SL.idx, STR),   // horizontal
  seg4(MM, 0, SL.mid, STR),   // horizontal
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ I: pinky straight up, others curled ───────────────────────────────────────
POSES.I = pose(
  thumb(0.26, 0.79, 0.21, 0.74, 0.20, 0.70),
  seg4(IM, 85, SL.idx, CURL),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, STR),
);
POSES.J = POSES.I; // J is I with a movement

// ─ K: index up, middle bent upward, thumb between ────────────────────────────
POSES.K = pose(
  thumb(0.28, 0.76, 0.34, 0.70, 0.38, 0.65),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, [-10, 0, 0]),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ L: L-shape — index up, thumb out ─────────────────────────────────────────
POSES.L = pose(
  thumb(0.23, 0.80, 0.17, 0.78, 0.14, 0.76),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ M: three fingers bent over thumb ──────────────────────────────────────────
POSES.M = pose(
  thumb(0.30, 0.77, 0.37, 0.73, 0.43, 0.72),
  seg4(IM, 85, SL.idx, [-56, -50, -30]),
  seg4(MM, 89, SL.mid, [-56, -50, -30]),
  seg4(RM, 85, SL.rng, [-56, -50, -30]),
  seg4(PM, 79, SL.pnk, CURL),
);

// ─ N: two fingers bent over thumb ────────────────────────────────────────────
POSES.N = pose(
  thumb(0.30, 0.77, 0.37, 0.73, 0.43, 0.72),
  seg4(IM, 85, SL.idx, [-56, -50, -30]),
  seg4(MM, 89, SL.mid, [-56, -50, -30]),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, CURL),
);

// ─ P: K pointing down (K orientation) ────────────────────────────────────────
POSES.P = POSES.K;

// ─ Q: G pointing down ────────────────────────────────────────────────────────
POSES.Q = pose(
  thumb(0.26, 0.78, 0.22, 0.75, 0.18, 0.73),
  seg4(IM, -20, SL.idx, STR),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ R: index + middle crossed ─────────────────────────────────────────────────
POSES.R = pose(
  thumb(0.26, 0.79, 0.21, 0.74, 0.20, 0.70),
  seg4(IM, 90, SL.idx, [10, 0, 0]),   // slight lean
  seg4(MM, 80, SL.mid, [-8, 0, 0]),   // opposite lean → crossing
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ T: thumb between index and middle ────────────────────────────────────────
POSES.T = pose(
  thumb(0.32, 0.76, 0.39, 0.72, 0.43, 0.70),
  seg4(IM, 85, SL.idx, CURL),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, CURL),
);

// ─ U: index + middle straight up together ────────────────────────────────────
POSES.U = pose(
  thumb(0.26, 0.79, 0.21, 0.74, 0.20, 0.70),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, STR),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ V: index + middle up in a V spread ────────────────────────────────────────
POSES.V = pose(
  thumb(0.26, 0.79, 0.21, 0.74, 0.20, 0.70),
  seg4(IM, 78, SL.idx, STR),   // lean left
  seg4(MM, 96, SL.mid, STR),   // lean right
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ W: index + middle + ring straight up ──────────────────────────────────────
POSES.W = pose(
  thumb(0.26, 0.79, 0.21, 0.75, 0.19, 0.71),
  seg4(IM, 85, SL.idx, STR),
  seg4(MM, 89, SL.mid, STR),
  seg4(RM, 85, SL.rng, STR),
  seg4(PM, 79, SL.pnk, CURL),
);

// ─ X: hooked index (bent mainly at PIP) ─────────────────────────────────────
POSES.X = pose(
  thumb(0.26, 0.79, 0.21, 0.74, 0.20, 0.70),
  seg4(IM, 85, SL.idx, HOOK),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, [-68, -52, -30]),
);

// ─ Y: thumb + pinky extended, others curled ──────────────────────────────────
POSES.Y = pose(
  thumb(0.23, 0.81, 0.17, 0.79, 0.13, 0.76),  // thumb spread out to left
  seg4(IM, 85, SL.idx, CURL),
  seg4(MM, 89, SL.mid, CURL),
  seg4(RM, 85, SL.rng, CURL),
  seg4(PM, 79, SL.pnk, STR),
);

// ─ Z: index traces a Z (static = index pointing) ────────────────────────────
POSES.Z = POSES.D;

// ─ Space: relaxed open hand ──────────────────────────────────────────────────
POSES[' '] = pose(
  thumb(0.23, 0.81, 0.17, 0.79, 0.14, 0.76),
  seg4(IM, 85, SL.idx, [-12, -9, -6]),
  seg4(MM, 89, SL.mid, [-12, -9, -6]),
  seg4(RM, 85, SL.rng, [-12, -9, -6]),
  seg4(PM, 79, SL.pnk, [-10, -8, -5]),
);

export const ASL_POSES = POSES;

// MediaPipe hand bone connections
export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];
