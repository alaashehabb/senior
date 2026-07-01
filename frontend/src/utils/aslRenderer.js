// Lightweight 2D canvas renderer for the ASL stickman.
//
// Pure functions only — no React, no web components, no external runtime.
// Replaces the old pose-viewer (20 MB Stencil/WebGL) dependency that made the
// education page lag.  Everything here is plain Canvas 2D drawing + a little
// math, so it stays smooth even on modest hardware.
//
// Hand landmarks use the MediaPipe 21-point layout:
//   0=WRIST
//   1-4  THUMB  (CMC, MCP, IP, TIP)
//   5-8  INDEX  (MCP, PIP, DIP, TIP)
//   9-12 MIDDLE
//   13-16 RING
//   17-20 PINKY
// Coordinates are normalized (roughly 0-1); the renderer anchors landmark 0 at
// a chosen canvas point and scales the rest around it, so a hand can follow a
// moving wrist.

// ── Palette ───────────────────────────────────────────────────────────────────
export const COLORS = {
  body:      "#A78BFA", // limbs / torso (violet)
  activeArm: "#F472B6", // the signing arm (pink)
  bone:      "#F472B6", // finger bones
  thumb:     "#FBBF24", // thumb highlighted so orientation reads clearly (amber)
  joint:     "#FDE68A", // knuckles
  tip:       "#FFFFFF", // extended fingertips
  palm:      "rgba(244, 114, 182, 0.12)",
};

// MediaPipe hand bone connections
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17], // knuckle bridge
];

const THUMB_BONES = [[0, 1], [1, 2], [2, 3], [3, 4]];
const FINGER_BONES = HAND_CONNECTIONS.filter(
  ([a]) => a !== 1 && a !== 2 && a !== 3, // everything except the thumb chain
);
const PALM_OUTLINE = [0, 5, 9, 13, 17];
const FINGERTIPS = [4, 8, 12, 16, 20];

// ── Easing ──────────────────────────────────────────────────────────────────
export const EASE = {
  linear:      (t) => t,
  easeIn:      (t) => t * t * t,
  easeOut:     (t) => 1 - (1 - t) ** 3,
  easeInOut:   (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

// ── Interpolation ─────────────────────────────────────────────────────────────
export const lerp = (a = 0, b = 0, t) => a + (b - a) * t;
export const lerpXY = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Smoothly morph one 21-landmark hand pose into another.
export function lerpPose(a, b, t) {
  if (!a) return b;
  if (!b) return a;
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = lerpXY(a[i], b[i], t);
  return out;
}

// ── 2-joint inverse kinematics for an arm ────────────────────────────────────
// Given a shoulder and a wrist target, find the elbow so the two equal-ish
// bones reach the wrist.  `hint` biases which of the two solutions is chosen
// (keeps the elbow bending in a natural direction).
export function solveArm([sx, sy], [wx, wy], upper, fore, [hx, hy]) {
  const dx = wx - sx;
  const dy = wy - sy;
  const d = Math.max(
    Math.abs(upper - fore) + 0.5,
    Math.min(Math.hypot(dx, dy), upper + fore - 0.5),
  );
  const a = Math.acos(
    Math.max(-1, Math.min(1, (upper * upper + d * d - fore * fore) / (2 * upper * d))),
  );
  const base = Math.atan2(dy, dx);
  const e1 = [sx + Math.cos(base + a) * upper, sy + Math.sin(base + a) * upper];
  const e2 = [sx + Math.cos(base - a) * upper, sy + Math.sin(base - a) * upper];
  return Math.hypot(e1[0] - hx, e1[1] - hy) < Math.hypot(e2[0] - hx, e2[1] - hy) ? e1 : e2;
}

// ── Hand drawing ──────────────────────────────────────────────────────────────
// Draws a hand so that landmark 0 (wrist) sits at (ox, oy), scaled by `scale`.
// Batched: one path per visual layer to keep it cheap.
export function drawHand(ctx, lms, { ox, oy, scale, alpha = 1 } = {}) {
  if (!lms) return;
  const [orx, ory] = lms[0];
  const px = (i) => ox + (lms[i][0] - orx) * scale;
  const py = (i) => oy + (lms[i][1] - ory) * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Palm fill — gives the hand a readable "body" instead of bare sticks.
  ctx.beginPath();
  PALM_OUTLINE.forEach((i, k) => (k ? ctx.lineTo(px(i), py(i)) : ctx.moveTo(px(i), py(i))));
  ctx.closePath();
  ctx.fillStyle = COLORS.palm;
  ctx.fill();

  // Finger bones (single stroke pass).
  ctx.strokeStyle = COLORS.bone;
  ctx.lineWidth = Math.max(2.5, scale * 0.028);
  ctx.beginPath();
  for (const [a, b] of FINGER_BONES) {
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
  }
  ctx.stroke();

  // Thumb — drawn in its own accent colour so palm orientation is legible.
  ctx.strokeStyle = COLORS.thumb;
  ctx.beginPath();
  for (const [a, b] of THUMB_BONES) {
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
  }
  ctx.stroke();

  // Knuckle joints.
  const jr = Math.max(2.2, scale * 0.026);
  ctx.fillStyle = COLORS.joint;
  ctx.beginPath();
  for (let i = 0; i < lms.length; i++) {
    if (FINGERTIPS.includes(i)) continue;
    ctx.moveTo(px(i) + jr, py(i));
    ctx.arc(px(i), py(i), jr, 0, Math.PI * 2);
  }
  ctx.fill();

  // Fingertips — emphasised so a learner instantly sees which fingers are out.
  const tr = Math.max(3, scale * 0.036);
  ctx.fillStyle = COLORS.tip;
  ctx.beginPath();
  for (const i of FINGERTIPS) {
    ctx.moveTo(px(i) + tr, py(i));
    ctx.arc(px(i), py(i), tr, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.restore();
}
