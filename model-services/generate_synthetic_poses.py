#!/usr/bin/env python3
"""
Generate .pose files from ASL word keyframe animations.
Fully offline, no YouTube needed. Uses the same IK + hand shapes as the canvas stickman.

Improvements over v1:
  - 60 fps  → pose-viewer renders one discrete frame per RAF tick, so higher fps = smoother
  - Hand landmark interpolation → hands morph smoothly between shapes instead of snapping
  - Clamped easing overshoot  → prevents skeleton from flying out of frame

Usage:
    python generate_synthetic_poses.py            # all 17 words
    python generate_synthetic_poses.py hello yes  # specific words
"""

import io, math, sys
from pathlib import Path

import numpy as np
from pose_format import Pose
from pose_format.numpy import NumPyPoseBody
from pose_format.pose_header import PoseHeader, PoseHeaderDimensions
from pose_format.utils.holistic import holistic_components

POSES_DIR = Path(__file__).parent / "poses"
POSES_DIR.mkdir(exist_ok=True)

W, H = 320, 500   # canvas pixels (must match ASLWordStickman.jsx)
FPS  = 60         # higher fps → smoother in pose-viewer (discrete frame renderer)

RS = (215, 108);  LS = (105, 108)
UPPER = FORE = 65
R_HINT = (278, 165);  L_HINT = (42, 165)
RN = (235, 242);  LN = (85, 242)
L_HIP = (135,232); R_HIP = (185,232)
L_KNEE=(115,315);  R_KNEE=(205,315)
L_FOOT=(108,395);  R_FOOT=(212,395)
HAND_SCALE = 112

# ── IK ────────────────────────────────────────────────────────────────────────
def _ik(sx, sy, wx, wy, hx, hy):
    dx, dy = wx-sx, wy-sy
    d = max(abs(UPPER-FORE)+.5, min(math.hypot(dx,dy), UPPER+FORE-.5))
    a = math.acos(max(-1., min(1., (UPPER**2+d**2-FORE**2)/(2*UPPER*d))))
    b = math.atan2(dy, dx)
    e1 = (sx+math.cos(b+a)*UPPER, sy+math.sin(b+a)*UPPER)
    e2 = (sx+math.cos(b-a)*UPPER, sy+math.sin(b-a)*UPPER)
    return e1 if math.hypot(e1[0]-hx,e1[1]-hy) < math.hypot(e2[0]-hx,e2[1]-hy) else e2

# ── Hand shapes (translated from aslHandPoses.js) ─────────────────────────────
D=math.pi/180
WR=(0.50,0.92); TC=(0.34,0.84)
IM=(0.35,0.70); MM=(0.46,0.68); RM=(0.57,0.70); PM=(0.65,0.75)
SI=[0.092,0.082,0.073]; SM=[0.099,0.089,0.077]
SR=[0.092,0.082,0.073]; SP=[0.074,0.064,0.056]

def s4(sx,sy,base,segs,fx):
    f0,f1,f2=fx; pts=[(sx,sy)]; x,y=sx,sy
    for ang,seg in zip([base+f0,base+f0+f1,base+f0+f1+f2],segs):
        x+=math.cos(ang*D)*seg; y-=math.sin(ang*D)*seg; pts.append((x,y))
    return pts

def th(mx,my,ix,iy,tx,ty): return [TC,(mx,my),(ix,iy),(tx,ty)]
def hd(t,i,m,r,p): return [WR]+list(t)+list(i)+list(m)+list(r)+list(p)

S=[0,0,0]; CU=[-72,-55,-33]; HK=[-45,-78,0]; MI=[-18,-15,-10]

_H = {
  'B': hd(th(0.24,0.79,0.18,0.75,0.21,0.70), s4(*IM,85,SI,S),  s4(*MM,89,SM,S),   s4(*RM,85,SR,S),  s4(*PM,79,SP,S)),
  'S': [WR,TC,(0.27,0.79),(0.35,0.74),(0.43,0.71),
        IM,(0.43,0.73),(0.48,0.79),(0.44,0.82),
        MM,(0.53,0.72),(0.56,0.78),(0.51,0.81),
        RM,(0.62,0.74),(0.63,0.80),(0.58,0.83),
        PM,(0.67,0.80),(0.65,0.84),(0.61,0.86)],
  'O': [WR,TC,(0.26,0.80),(0.28,0.72),(0.36,0.67),
        IM,(0.39,0.63),(0.42,0.65),(0.40,0.70),
        MM,(0.48,0.61),(0.49,0.64),(0.46,0.69),
        RM,(0.56,0.63),(0.55,0.67),(0.51,0.71),
        PM,(0.62,0.70),(0.60,0.74),(0.55,0.75)],
  'C': hd(th(0.22,0.80,0.17,0.76,0.16,0.72), s4(*IM,85,SI,MI),         s4(*MM,89,SM,[-20,-17,-12]),
          s4(*RM,85,SR,MI),         s4(*PM,79,SP,[-16,-13,-9])),
  'D': hd(th(0.27,0.79,0.34,0.72,0.41,0.67), s4(*IM,85,SI,S),   s4(*MM,89,SM,CU), s4(*RM,85,SR,CU), s4(*PM,79,SP,[-68,-52,-30])),
  'H': hd(th(0.26,0.78,0.21,0.75,0.18,0.73), s4(*IM, 0,SI,S),   s4(*MM, 0,SM,S),  s4(*RM,85,SR,CU), s4(*PM,79,SP,[-68,-52,-30])),
  'N': hd(th(0.30,0.77,0.37,0.73,0.43,0.72), s4(*IM,85,SI,[-56,-50,-30]), s4(*MM,89,SM,[-56,-50,-30]),
          s4(*RM,85,SR,CU), s4(*PM,79,SP,CU)),
  'W': hd(th(0.26,0.79,0.21,0.75,0.19,0.71), s4(*IM,85,SI,S),   s4(*MM,89,SM,S),  s4(*RM,85,SR,S),  s4(*PM,79,SP,CU)),
  'X': hd(th(0.26,0.79,0.21,0.74,0.20,0.70), s4(*IM,85,SI,HK),  s4(*MM,89,SM,CU), s4(*RM,85,SR,CU), s4(*PM,79,SP,[-68,-52,-30])),
  'Y': hd(th(0.23,0.81,0.17,0.79,0.13,0.76), s4(*IM,85,SI,CU),  s4(*MM,89,SM,CU), s4(*RM,85,SR,CU), s4(*PM,79,SP,S)),
}
_H[None] = hd(th(0.23,0.81,0.17,0.79,0.14,0.76),
              s4(*IM,85,SI,[-12,-9,-6]), s4(*MM,89,SM,[-12,-9,-6]),
              s4(*RM,85,SR,[-12,-9,-6]), s4(*PM,79,SP,[-10,-8,-5]))

def _lerp_hand_px(k1, k2, t, wx, wy):
    """
    Lerp hand landmarks between two shapes and map to canvas pixels.
    Gives smooth morphing instead of a hard snap at the transition midpoint.
    t is clamped to [0,1] so easeOutBack overshoot doesn't distort hands.
    """
    tc = max(0., min(1., t))          # clamp for hand interpolation
    l1 = _H.get(k1, _H[None])
    l2 = _H.get(k2, _H[None])
    wr = l1[0]                        # wrist reference from first shape
    merged = [(x1+(x2-x1)*tc, y1+(y2-y1)*tc) for (x1,y1),(x2,y2) in zip(l1,l2)]
    data = np.array([[wx+(nx-wr[0])*HAND_SCALE, wy+(ny-wr[1])*HAND_SCALE, 0.] for nx,ny in merged])
    return data, np.ones(21)

# ── Easing ─────────────────────────────────────────────────────────────────────
def eio(t): return 4*t**3 if t<.5 else 1-(-2*t+2)**3/2
def eo(t):  return 1-(1-t)**3
def ei(t):  return t**3
def eob(t): return 1+2.70158*(t-1)**3+1.70158*(t-1)**2   # may exceed 1 — fine for position, clamped for hands
EASE={'linear':lambda t:t,'easeIn':ei,'easeOut':eo,'easeInOut':eio,'easeOutBack':eob}

def l2(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
def ln(a,b,t): return (a or 0)+((b or 0)-(a or 0))*t

# ── Keyframe data (matches aslWordPoses.js exactly) ───────────────────────────
A = WORD_ANIMS = {
 'hello':[
  dict(rWrist=(208,62),rHand='B',rShoulderDY=-5,dur=600,hold=700,ease='easeOut'),
  dict(rWrist=(268,72),rHand='B',rShoulderDY=-5,dur=700,hold=600,ease='easeInOut'),
  dict(rWrist=(208,62),rHand='B',rShoulderDY=-5,dur=650,hold=500,ease='easeInOut'),
  dict(rWrist=(268,72),rHand='B',rShoulderDY=-5,dur=700,hold=400,ease='easeInOut'),
  dict(rWrist=RN,      rHand=None,rShoulderDY=0,dur=700,ease='easeIn'),
 ],
 'thank you':[
  dict(rWrist=(192,92), rHand='B',headDY=-3,dur=600,hold=900,ease='easeOut'),
  dict(rWrist=(268,98), rHand='B',headDY=0, dur=800,hold=900,ease='easeOutBack'),
  dict(rWrist=RN,       rHand=None,dur=700,ease='easeIn'),
 ],
 'yes':[
  dict(rWrist=(192,112),rHand='S',headDY=0,dur=500,hold=500,ease='easeOut'),
  dict(rWrist=(192,130),rHand='S',headDY=9,dur=400,hold=350,ease='easeInOut'),
  dict(rWrist=(192,112),rHand='S',headDY=0,dur=380,hold=300,ease='easeInOut'),
  dict(rWrist=(192,130),rHand='S',headDY=9,dur=400,hold=350,ease='easeInOut'),
  dict(rWrist=(192,112),rHand='S',headDY=0,dur=380,ease='easeInOut'),
  dict(rWrist=RN,       rHand=None,headDY=0,dur=650,ease='easeIn'),
 ],
 'no':[
  dict(rWrist=(258,100),rHand='H',dur=550,hold=700,ease='easeOut'),
  dict(rWrist=(258,100),rHand='N',dur=350,hold=500,ease='easeInOut'),
  dict(rWrist=(258,100),rHand='H',dur=350,hold=400,ease='easeInOut'),
  dict(rWrist=(258,100),rHand='N',dur=350,hold=500,ease='easeInOut'),
  dict(rWrist=RN,       rHand=None,dur=650,ease='easeIn'),
 ],
 'please':[
  dict(rWrist=(196,152),rHand='B',dur=550,hold=600,ease='easeOut'),
  dict(rWrist=(194,135),rHand='B',dur=500,hold=200,ease='easeInOut'),
  dict(rWrist=(207,147),rHand='B',dur=480,hold=200,ease='easeInOut'),
  dict(rWrist=(196,162),rHand='B',dur=500,hold=200,ease='easeInOut'),
  dict(rWrist=(182,150),rHand='B',dur=480,hold=200,ease='easeInOut'),
  dict(rWrist=(194,135),rHand='B',dur=500,hold=400,ease='easeInOut'),
  dict(rWrist=RN,       rHand=None,dur=700,ease='easeIn'),
 ],
 'sorry':[
  dict(rWrist=(196,152),rHand='S',dur=550,hold=600,ease='easeOut'),
  dict(rWrist=(194,135),rHand='S',dur=500,hold=200,ease='easeInOut'),
  dict(rWrist=(207,147),rHand='S',dur=480,hold=200,ease='easeInOut'),
  dict(rWrist=(196,162),rHand='S',dur=500,hold=200,ease='easeInOut'),
  dict(rWrist=(182,150),rHand='S',dur=480,hold=200,ease='easeInOut'),
  dict(rWrist=(194,135),rHand='S',dur=500,hold=400,ease='easeInOut'),
  dict(rWrist=RN,       rHand=None,dur=700,ease='easeIn'),
 ],
 'i love you':[
  dict(rWrist=RN,       rHand=None,rShoulderDY=0, dur=400,ease='easeOut'),
  dict(rWrist=(248,118),rHand='Y', rShoulderDY=-8,dur=750,hold=1400,ease='easeOutBack'),
  dict(rWrist=RN,       rHand=None,rShoulderDY=0, dur=750,ease='easeIn'),
 ],
 'eat':[
  dict(rWrist=(192,82),rHand='O',dur=600,hold=700,ease='easeOut'),
  dict(rWrist=(192,76),rHand='O',dur=380,hold=400,ease='easeInOut'),
  dict(rWrist=(192,83),rHand='O',dur=360,hold=200,ease='easeInOut'),
  dict(rWrist=(192,76),rHand='O',dur=380,hold=400,ease='easeInOut'),
  dict(rWrist=(192,83),rHand='O',dur=360,ease='easeInOut'),
  dict(rWrist=RN,      rHand=None,dur=650,ease='easeIn'),
 ],
 'drink':[
  dict(rWrist=(218,134),rHand='C',rShoulderDY=0, dur=600,hold=700, ease='easeOut'),
  dict(rWrist=(198,88), rHand='C',rShoulderDY=-3,dur=800,hold=1000,ease='easeInOut'),
  dict(rWrist=(218,134),rHand='C',rShoulderDY=0, dur=700,ease='easeIn'),
  dict(rWrist=RN,       rHand=None,dur=650,ease='easeIn'),
 ],
 'water':[
  dict(rWrist=(196,91),rHand='W',dur=600,hold=800,ease='easeOut'),
  dict(rWrist=(196,99),rHand='W',dur=380,hold=400,ease='easeInOut'),
  dict(rWrist=(196,91),rHand='W',dur=360,hold=200,ease='easeInOut'),
  dict(rWrist=(196,99),rHand='W',dur=380,hold=400,ease='easeInOut'),
  dict(rWrist=(196,91),rHand='W',dur=360,ease='easeInOut'),
  dict(rWrist=RN,      rHand=None,dur=650,ease='easeIn'),
 ],
 'more':[
  dict(rWrist=(204,165),lWrist=(116,165),rHand='O',lHand='O',dur=650,hold=700,ease='easeOut'),
  dict(rWrist=(188,162),lWrist=(132,162),rHand='O',lHand='O',dur=500,hold=550,ease='easeInOut'),
  dict(rWrist=(206,168),lWrist=(114,168),rHand='O',lHand='O',dur=460,hold=300,ease='easeInOut'),
  dict(rWrist=(188,162),lWrist=(132,162),rHand='O',lHand='O',dur=500,hold=550,ease='easeInOut'),
  dict(rWrist=RN,       lWrist=LN,       rHand=None,lHand=None,dur=700,ease='easeIn'),
 ],
 'help':[
  dict(rWrist=(192,210),lWrist=(128,212),rHand='S',lHand='B',rShoulderDY=0, lShoulderDY=0, dur=650,hold=800, ease='easeOut'),
  dict(rWrist=(186,168),lWrist=(122,170),rHand='S',lHand='B',rShoulderDY=-10,lShoulderDY=-10,dur=800,hold=1000,ease='easeOutBack'),
  dict(rWrist=RN,       lWrist=LN,       rHand=None,lHand=None,rShoulderDY=0,lShoulderDY=0,dur=750,ease='easeIn'),
 ],
 'stop':[
  dict(rWrist=(250,125),lWrist=(145,170),rHand='B',lHand='B',dur=650,hold=700,ease='easeOut'),
  dict(rWrist=(192,170),lWrist=(145,170),rHand='B',lHand='B',dur=550,hold=900,ease='easeOutBack'),
  dict(rWrist=(200,162),lWrist=(145,170),rHand='B',lHand='B',dur=220,ease='easeOut'),
  dict(rWrist=(192,170),lWrist=(145,170),rHand='B',lHand='B',dur=200,hold=400,ease='easeInOut'),
  dict(rWrist=RN,       lWrist=LN,       rHand=None,lHand=None,dur=700,ease='easeIn'),
 ],
 'go':[
  dict(rWrist=(245,135),rHand='D',rShoulderDY=0, dur=600,hold=700,ease='easeOut'),
  dict(rWrist=(280,116),rHand='D',rShoulderDY=-5,dur=700,hold=900,ease='easeOutBack'),
  dict(rWrist=RN,       rHand=None,rShoulderDY=0,dur=700,ease='easeIn'),
 ],
 'come':[
  dict(rWrist=(270,126),rHand='D',dur=600,hold=700,ease='easeOut'),
  dict(rWrist=(248,140),rHand='X',dur=550,hold=600,ease='easeInOut'),
  dict(rWrist=(270,126),rHand='D',dur=500,hold=300,ease='easeInOut'),
  dict(rWrist=(248,140),rHand='X',dur=550,hold=600,ease='easeInOut'),
  dict(rWrist=RN,       rHand=None,dur=700,ease='easeIn'),
 ],
 'learn':[
  dict(rWrist=(162,178),lWrist=(138,185),rHand='B',lHand='B',rShoulderDY=0, dur=650,hold=800, ease='easeOut'),
  dict(rWrist=(202,72), lWrist=LN,       rHand='O',lHand=None,rShoulderDY=-7,dur=850,hold=1100,ease='easeInOut'),
  dict(rWrist=RN,       lWrist=LN,       rHand=None,lHand=None,rShoulderDY=0,dur=750,ease='easeIn'),
 ],
 'name':[
  dict(rWrist=(182,168),lWrist=(138,168),rHand='H',lHand='H',dur=650,hold=700,ease='easeOut'),
  dict(rWrist=(180,162),lWrist=(140,168),rHand='H',lHand='H',dur=400,hold=450,ease='easeInOut'),
  dict(rWrist=(182,170),lWrist=(138,168),rHand='H',lHand='H',dur=380,hold=250,ease='easeInOut'),
  dict(rWrist=(180,162),lWrist=(140,168),rHand='H',lHand='H',dur=400,hold=450,ease='easeInOut'),
  dict(rWrist=RN,       lWrist=LN,       rHand=None,lHand=None,dur=700,ease='easeIn'),
 ],
}

# ── Frame expansion ───────────────────────────────────────────────────────────
def _expand(word):
    kfs = WORD_ANIMS.get(word.lower())
    if not kfs:
        raise ValueError(f"Unknown word '{word}'")
    out = []
    for i, kf in enumerate(kfs):
        nxt     = kfs[min(i+1, len(kfs)-1)]
        dur_ms  = kf['dur']
        hold_ms = kf.get('hold', 0)
        efn     = EASE.get(kf.get('ease','easeInOut'), eio)
        n       = max(1, round((dur_ms + hold_ms) / 1000 * FPS))
        for j in range(n):
            t_ms    = j / FPS * 1000
            in_hold = t_ms >= dur_ms
            raw_t   = 1. if dur_ms == 0 else min(1., t_ms / dur_ms)
            t       = 1. if in_hold else efn(raw_t)

            # Position lerp (eased, may overshoot for easeOutBack — that's intentional for arms)
            rW = l2(kf.get('rWrist',RN), kf.get('rWrist',RN) if in_hold else nxt.get('rWrist',RN), t)
            lW = l2(kf.get('lWrist',LN), kf.get('lWrist',LN) if in_hold else nxt.get('lWrist',LN), t)

            # Hand shape lerp factor: smooth morph using clamped t
            hT  = 1. if in_hold else max(0., min(1., t))

            out.append(dict(rW=rW, lW=lW,
                            rH1=kf.get('rHand'), rH2=kf.get('rHand') if in_hold else nxt.get('rHand'), rHt=hT,
                            lH1=kf.get('lHand'), lH2=kf.get('lHand') if in_hold else nxt.get('lHand'), lHt=hT,
                            hDY=ln(kf.get('headDY',0),     kf.get('headDY',0)      if in_hold else nxt.get('headDY',0),     t),
                            rS =ln(kf.get('rShoulderDY',0),kf.get('rShoulderDY',0) if in_hold else nxt.get('rShoulderDY',0),t),
                            lS =ln(kf.get('lShoulderDY',0),kf.get('lShoulderDY',0) if in_hold else nxt.get('lShoulderDY',0),t)))
    return out

# ── Body landmarks ─────────────────────────────────────────────────────────────
def _body(st):
    hx,hy  = 160, 55+st['hDY']
    rSx,rSy= RS[0], RS[1]+st['rS']
    lSx,lSy= LS[0], LS[1]+st['lS']
    rWx,rWy= st['rW']; lWx,lWy= st['lW']
    rEx,rEy= _ik(rSx,rSy,rWx,rWy,*R_HINT)
    lEx,lEy= _ik(lSx,lSy,lWx,lWy,*L_HINT)
    d=np.zeros((33,3)); c=np.zeros(33)
    def p(i,x,y,z=0.,v=1.): d[i]=[x,y,z]; c[i]=v
    p(0,hx,hy-5);  p(1,hx-5,hy-8); p(2,hx-10,hy-8); p(3,hx-14,hy-6)
    p(4,hx+5,hy-8);p(5,hx+10,hy-8);p(6,hx+14,hy-6)
    p(7,hx-22,hy); p(8,hx+22,hy); p(9,hx-7,hy+11); p(10,hx+7,hy+11)
    p(11,lSx,lSy); p(12,rSx,rSy)
    p(13,lEx,lEy); p(14,rEx,rEy)
    p(15,lWx,lWy); p(16,rWx,rWy)
    p(17,lWx-5,lWy-5,v=.5); p(18,rWx+5,rWy-5,v=.5)
    p(19,lWx,lWy-8,v=.5);   p(20,rWx,rWy-8,v=.5)
    p(21,lWx-5,lWy-10,v=.5);p(22,rWx+5,rWy-10,v=.5)
    p(23,*L_HIP); p(24,*R_HIP)
    p(25,*L_KNEE);p(26,*R_KNEE)
    p(27,*L_FOOT);p(28,*R_FOOT)
    p(29,L_FOOT[0]-5,L_FOOT[1]+8,v=.5); p(30,R_FOOT[0]+5,R_FOOT[1]+8,v=.5)
    p(31,L_FOOT[0],  L_FOOT[1]+15,v=.5);p(32,R_FOOT[0],  R_FOOT[1]+15,v=.5)
    return d, c

# ── Pose file ─────────────────────────────────────────────────────────────────
_PB,_PE = 0,33; _FB,_FE = 33,501; _LB,_LE = 501,522; _RB,_RE = 522,543

def generate(word):
    frames = _expand(word)
    n = len(frames)
    dims  = PoseHeaderDimensions(width=W, height=H, depth=1000)
    comps = holistic_components("XYZC")[:-1]   # POSE + FACE + L_HAND + R_HAND = 543 pts
    hdr   = PoseHeader(version=0.2, dimensions=dims, components=comps)
    data  = np.zeros((n,1,hdr.total_points(),3))
    conf  = np.zeros((n,1,hdr.total_points()))
    for i, st in enumerate(frames):
        bd,bc = _body(st)
        data[i,0,_PB:_PE]=bd; conf[i,0,_PB:_PE]=bc
        # face: leave zeros (invisible)
        ld,lc = _lerp_hand_px(st['lH1'],st['lH2'],st['lHt'],*st['lW'])
        data[i,0,_LB:_LE]=ld; conf[i,0,_LB:_LE]=lc
        rd,rc = _lerp_hand_px(st['rH1'],st['rH2'],st['rHt'],*st['rW'])
        data[i,0,_RB:_RE]=rd; conf[i,0,_RB:_RE]=rc
    body = NumPyPoseBody(fps=float(FPS), data=data, confidence=conf)
    buf  = io.BytesIO()
    Pose(hdr, body).write(buf)
    return buf.getvalue()

# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    targets = [a.lower() for a in sys.argv[1:]] or list(WORD_ANIMS)
    bad = [w for w in targets if w not in WORD_ANIMS]
    if bad:
        print(f"Unknown: {bad}\nAvailable: {list(WORD_ANIMS)}"); sys.exit(1)

    print(f"Generating {len(targets)} pose file(s) at {FPS} fps…\n")
    ok = []
    for word in targets:
        try:
            pb = generate(word)
            slug = word.replace(' ','_')
            out  = POSES_DIR / f"{slug}.pose"
            out.write_bytes(pb)
            n = len(_expand(word))
            print(f"  ✓ {word:14s}  {out.name}  ({len(pb)//1024} KB  {n} frames  {n/FPS:.1f}s)")
            ok.append(word)
        except Exception as e:
            print(f"  ✗ {word}: {e}")

    print(f"\nDone: {len(ok)}/{len(targets)}")

if __name__ == "__main__":
    main()
