// Full-body ASL word keyframes  (educational pacing).
//
// Canvas: 320 × 500 px  |  Right shoulder [215,108]  Left shoulder [105,108]
// Elbow is computed via 2-joint IK — only wrist targets are stored here.
//
// Keyframe fields
// ──────────────────────────────────────────────────────────────────
//  rWrist / lWrist  : [x,y] absolute canvas px wrist target
//  rHand  / lHand   : key into ASL_POSES (A-Z / ' '), null = relaxed B
//  hold             : ms to FREEZE at this position after arriving
//                     (lets learners see the hand shape clearly)
//  headDY           : head y-offset px  (+down / -up)
//  rShoulderDY      : right shoulder y-offset
//  lShoulderDY      : left  shoulder y-offset
//  dur              : transition duration ms  (scaled by speed multiplier)
//  ease             : 'linear'|'easeIn'|'easeOut'|'easeInOut'|'easeOutBack'

export const RN = [235, 242]; // right wrist neutral
export const LN = [85,  242]; // left  wrist neutral

export const WORD_ANIMS = {

  HELLO: {
    description: "Open-hand wave from the right temple",
    frames: [
      // 1. raise hand to right temple
      { rWrist:[208,62],  rHand:'B', rShoulderDY:-5,
        dur:600, hold:700, ease:'easeOut' },
      // 2. wave outward — hold so learner sees full-B wave
      { rWrist:[268,72],  rHand:'B', rShoulderDY:-5,
        dur:700, hold:600, ease:'easeInOut' },
      // 3. back to temple
      { rWrist:[208,62],  rHand:'B', rShoulderDY:-5,
        dur:650, hold:500, ease:'easeInOut' },
      // 4. wave out again
      { rWrist:[268,72],  rHand:'B', rShoulderDY:-5,
        dur:700, hold:400, ease:'easeInOut' },
      // 5. return neutral
      { rWrist: RN,       rHand:null, rShoulderDY:0,
        dur:700, ease:'easeIn' },
    ],
  },

  "THANK YOU": {
    description: "Flat hand brushes outward from chin",
    frames: [
      // fingers touch chin
      { rWrist:[192,92],  rHand:'B', headDY:-3,
        dur:600, hold:900, ease:'easeOut' },
      // sweep forward — hold extended to show the gesture
      { rWrist:[268,98],  rHand:'B', headDY:0,
        dur:800, hold:900, ease:'easeOutBack' },
      // return
      { rWrist: RN,       rHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  YES: {
    description: "Fist nods down twice — head follows",
    frames: [
      { rWrist:[192,112], rHand:'S', headDY:0,
        dur:500, hold:500, ease:'easeOut' },
      // nod down
      { rWrist:[192,130], rHand:'S', headDY:9,
        dur:400, hold:350, ease:'easeInOut' },
      // up
      { rWrist:[192,112], rHand:'S', headDY:0,
        dur:380, hold:300, ease:'easeInOut' },
      // nod down again
      { rWrist:[192,130], rHand:'S', headDY:9,
        dur:400, hold:350, ease:'easeInOut' },
      // up
      { rWrist:[192,112], rHand:'S', headDY:0,
        dur:380, ease:'easeInOut' },
      { rWrist: RN,       rHand:null, headDY:0,
        dur:650, ease:'easeIn' },
    ],
  },

  NO: {
    description: "Index + middle snap closed twice",
    frames: [
      // show open H shape
      { rWrist:[258,100], rHand:'H',
        dur:550, hold:700, ease:'easeOut' },
      // snap closed
      { rWrist:[258,100], rHand:'N',
        dur:350, hold:500, ease:'easeInOut' },
      // open
      { rWrist:[258,100], rHand:'H',
        dur:350, hold:400, ease:'easeInOut' },
      // snap again
      { rWrist:[258,100], rHand:'N',
        dur:350, hold:500, ease:'easeInOut' },
      { rWrist: RN,       rHand:null,
        dur:650, ease:'easeIn' },
    ],
  },

  PLEASE: {
    description: "Flat hand traces a clockwise circle on the chest",
    frames: [
      { rWrist:[196,152], rHand:'B',
        dur:550, hold:600, ease:'easeOut' },
      { rWrist:[194,135], rHand:'B',
        dur:500, hold:200, ease:'easeInOut' }, // top
      { rWrist:[207,147], rHand:'B',
        dur:480, hold:200, ease:'easeInOut' }, // right
      { rWrist:[196,162], rHand:'B',
        dur:500, hold:200, ease:'easeInOut' }, // bottom
      { rWrist:[182,150], rHand:'B',
        dur:480, hold:200, ease:'easeInOut' }, // left
      { rWrist:[194,135], rHand:'B',
        dur:500, hold:400, ease:'easeInOut' }, // top — full circle, hold
      { rWrist: RN,       rHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  SORRY: {
    description: "Fist traces a clockwise circle on the chest",
    frames: [
      { rWrist:[196,152], rHand:'S',
        dur:550, hold:600, ease:'easeOut' },
      { rWrist:[194,135], rHand:'S',
        dur:500, hold:200, ease:'easeInOut' },
      { rWrist:[207,147], rHand:'S',
        dur:480, hold:200, ease:'easeInOut' },
      { rWrist:[196,162], rHand:'S',
        dur:500, hold:200, ease:'easeInOut' },
      { rWrist:[182,150], rHand:'S',
        dur:480, hold:200, ease:'easeInOut' },
      { rWrist:[194,135], rHand:'S',
        dur:500, hold:400, ease:'easeInOut' },
      { rWrist: RN,       rHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  "I LOVE YOU": {
    description: "Y-handshape raised (thumb + index + pinky extended)",
    frames: [
      { rWrist: RN,       rHand:null, rShoulderDY:0,
        dur:400, ease:'easeOut' },
      // raise with gentle overshoot — long hold so learner studies the Y shape
      { rWrist:[248,118], rHand:'Y',  rShoulderDY:-8,
        dur:750, hold:1400, ease:'easeOutBack' },
      { rWrist: RN,       rHand:null, rShoulderDY:0,
        dur:750, ease:'easeIn' },
    ],
  },

  EAT: {
    description: "Bunched fingertips tap the mouth twice",
    frames: [
      // show O shape at mouth
      { rWrist:[192,82],  rHand:'O',
        dur:600, hold:700, ease:'easeOut' },
      { rWrist:[192,76],  rHand:'O',
        dur:380, hold:400, ease:'easeInOut' }, // tap
      { rWrist:[192,83],  rHand:'O',
        dur:360, hold:200, ease:'easeInOut' }, // back
      { rWrist:[192,76],  rHand:'O',
        dur:380, hold:400, ease:'easeInOut' }, // tap again
      { rWrist:[192,83],  rHand:'O',
        dur:360, ease:'easeInOut' },
      { rWrist: RN,       rHand:null,
        dur:650, ease:'easeIn' },
    ],
  },

  DRINK: {
    description: "C-shape tilts up to mouth, then lowers",
    frames: [
      // show C shape at rest
      { rWrist:[218,134], rHand:'C',
        dur:600, hold:700, ease:'easeOut' },
      // tip to mouth — long hold at peak
      { rWrist:[198,88],  rHand:'C', rShoulderDY:-3,
        dur:800, hold:1000, ease:'easeInOut' },
      // lower back
      { rWrist:[218,134], rHand:'C', rShoulderDY:0,
        dur:700, ease:'easeIn' },
      { rWrist: RN,       rHand:null,
        dur:650, ease:'easeIn' },
    ],
  },

  WATER: {
    description: "W-handshape taps the chin twice",
    frames: [
      // show W shape at chin
      { rWrist:[196,91],  rHand:'W',
        dur:600, hold:800, ease:'easeOut' },
      { rWrist:[196,99],  rHand:'W',
        dur:380, hold:400, ease:'easeInOut' }, // tap
      { rWrist:[196,91],  rHand:'W',
        dur:360, hold:200, ease:'easeInOut' }, // back
      { rWrist:[196,99],  rHand:'W',
        dur:380, hold:400, ease:'easeInOut' }, // tap
      { rWrist:[196,91],  rHand:'W',
        dur:360, ease:'easeInOut' },
      { rWrist: RN,       rHand:null,
        dur:650, ease:'easeIn' },
    ],
  },

  MORE: {
    description: "Both O-hands tap fingertips together twice",
    frames: [
      // show both O shapes apart
      { rWrist:[204,165], lWrist:[116,165], rHand:'O', lHand:'O',
        dur:650, hold:700, ease:'easeOut' },
      // tap together — hold
      { rWrist:[188,162], lWrist:[132,162], rHand:'O', lHand:'O',
        dur:500, hold:550, ease:'easeInOut' },
      // apart
      { rWrist:[206,168], lWrist:[114,168], rHand:'O', lHand:'O',
        dur:460, hold:300, ease:'easeInOut' },
      // tap again
      { rWrist:[188,162], lWrist:[132,162], rHand:'O', lHand:'O',
        dur:500, hold:550, ease:'easeInOut' },
      { rWrist: RN,       lWrist: LN,       rHand:null, lHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  HELP: {
    description: "Fist sits on flat palm — both hands lift upward",
    frames: [
      // show starting position: fist on palm at waist
      { rWrist:[192,210], lWrist:[128,212], rHand:'S', lHand:'B',
        rShoulderDY:0, lShoulderDY:0,
        dur:650, hold:800, ease:'easeOut' },
      // lift together — overshoot slightly, long hold at peak
      { rWrist:[186,168], lWrist:[122,170], rHand:'S', lHand:'B',
        rShoulderDY:-10, lShoulderDY:-10,
        dur:800, hold:1000, ease:'easeOutBack' },
      // return
      { rWrist: RN,       lWrist: LN,       rHand:null, lHand:null,
        rShoulderDY:0,   lShoulderDY:0,
        dur:750, ease:'easeIn' },
    ],
  },

  STOP: {
    description: "Right hand chops down onto left flat palm",
    frames: [
      // show setup: left platform + right raised
      { rWrist:[250,125], lWrist:[145,170], rHand:'B', lHand:'B',
        dur:650, hold:700, ease:'easeOut' },
      // chop — spring bounce shows impact
      { rWrist:[192,170], lWrist:[145,170], rHand:'B', lHand:'B',
        dur:550, hold:900, ease:'easeOutBack' },
      // rebound
      { rWrist:[200,162], lWrist:[145,170], rHand:'B', lHand:'B',
        dur:220, ease:'easeOut' },
      // settle back to chop
      { rWrist:[192,170], lWrist:[145,170], rHand:'B', lHand:'B',
        dur:200, hold:400, ease:'easeInOut' },
      { rWrist: RN,       lWrist: LN,       rHand:null, lHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  GO: {
    description: "Index finger points and thrusts forward",
    frames: [
      // show D-shape at rest
      { rWrist:[245,135], rHand:'D',
        dur:600, hold:700, ease:'easeOut' },
      // thrust — spring overshoot, long hold
      { rWrist:[280,116], rHand:'D', rShoulderDY:-5,
        dur:700, hold:900, ease:'easeOutBack' },
      { rWrist: RN,       rHand:null, rShoulderDY:0,
        dur:700, ease:'easeIn' },
    ],
  },

  COME: {
    description: "Index extends then hooks inward twice",
    frames: [
      // show extended D
      { rWrist:[270,126], rHand:'D',
        dur:600, hold:700, ease:'easeOut' },
      // beckon hook — hold
      { rWrist:[248,140], rHand:'X',
        dur:550, hold:600, ease:'easeInOut' },
      // extend
      { rWrist:[270,126], rHand:'D',
        dur:500, hold:300, ease:'easeInOut' },
      // beckon again
      { rWrist:[248,140], rHand:'X',
        dur:550, hold:600, ease:'easeInOut' },
      { rWrist: RN,       rHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

  LEARN: {
    description: "Hand scoops from flat palm up to forehead",
    frames: [
      // show both hands: right above left palm
      { rWrist:[162,178], lWrist:[138,185], rHand:'B', lHand:'B',
        dur:650, hold:800, ease:'easeOut' },
      // scoop: right hand curls to O and rises to forehead — long hold
      { rWrist:[202,72],  lWrist: LN,       rHand:'O', lHand:null,
        rShoulderDY:-7,
        dur:850, hold:1100, ease:'easeInOut' },
      { rWrist: RN,       lWrist: LN,       rHand:null, lHand:null,
        rShoulderDY:0,
        dur:750, ease:'easeIn' },
    ],
  },

  NAME: {
    description: "H-handshapes tap on each other twice",
    frames: [
      // show both H hands
      { rWrist:[182,168], lWrist:[138,168], rHand:'H', lHand:'H',
        dur:650, hold:700, ease:'easeOut' },
      { rWrist:[180,162], lWrist:[140,168], rHand:'H', lHand:'H',
        dur:400, hold:450, ease:'easeInOut' }, // tap
      { rWrist:[182,170], lWrist:[138,168], rHand:'H', lHand:'H',
        dur:380, hold:250, ease:'easeInOut' },
      { rWrist:[180,162], lWrist:[140,168], rHand:'H', lHand:'H',
        dur:400, hold:450, ease:'easeInOut' }, // tap again
      { rWrist: RN,       lWrist: LN,       rHand:null, lHand:null,
        dur:700, ease:'easeIn' },
    ],
  },

};

export const WORD_LIST = Object.keys(WORD_ANIMS);
