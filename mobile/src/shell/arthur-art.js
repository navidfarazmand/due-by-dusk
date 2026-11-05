/*
 * Arthur Grumble, of Grumble & Sons Savings & Loan.
 * Animated canvas character for Due by Dusk. Plain JavaScript, no dependencies.
 *
 *   var st = DBD_ARTHUR.create();
 *   // every frame:
 *   DBD_ARTHUR.draw(ctx, st, x, y, h, mood, intensity, t, dt, reduced);
 *   // one-shots:
 *   st.react('stomp');    // a bill paid: jumps, lands with a squash and a dust puff
 *   st.react('shock');    // a crow chased off / boss knocked out: eyes pop, hat flies up
 *   st.react('faint');    // the farm won: swoons, topples over and stays down
 *   st.react('recover');  // gets back up after a faint
 *
 *   x, y       where his feet stand (px)
 *   h          his height in px, feet to top of hat (about 60-90 in game)
 *   mood       'neutral' | 'gloat' | 'sad' | 'angry'
 *   intensity  0..1. For gloat: how far behind the player is (bigger, faster glee)
 *   t          seconds, monotonic
 *   dt         frame time in seconds
 *   reduced    true = reduced motion: a calm, still pose per mood
 *
 * Mood changes blend over 0.3 s with a squash-and-pop "take". Hat follow-through
 * comes from small springs (frame-rate independent, sub-stepped).
 *
 * Optional: DBD_ARTHUR.palette.vest / .bow are read every frame (default red
 * waistcoat, charcoal bow tie) if the game ever wants a skin.
 *
 * Cost: no shadowBlur, no filters, no gradients, no per-frame allocations.
 * About 35-46 fills/strokes (22-29 paths) a frame, ~0.4 ms in software Chromium.
 * ctx state is saved and restored; nothing leaks out.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- palette
  var INK = '#2B1708';
  var SKIN = '#F9CCA6';
  var FLUSH = '#EF6A52';
  // swappable colours (read every frame)
  var PAL = { vest: '#CF4136', bow: '#3A3442' };
  var SUIT = '#3A3442';
  var SUIT_HI = '#5E566B';
  var GOLD = '#FFC63D';
  var WHITE = '#FFFFFF';
  var NOSE = '#F28D7A';
  var CHEEK = '#FF6B6B';
  var TONGUE = '#F07C7C';
  var TEAR = '#8BD3F5';
  var DUST = '#F4E6CC';
  var SHADE = 'rgba(43,23,8,0.13)';
  var SHADOW = 'rgba(43,23,8,0.16)';

  // ------------------------------------------------------------- geometry
  // Units: origin on the ground between the feet, y grows downwards.
  var HAT_Y = -117; // brim centre resting on the head
  var UNIT_H = 197; // feet to top of hat, incl. outline
  var OUT = 6; // main outline
  var LINE = 4.6; // inner lines
  var EYE_X = 22, EYE_Y = -82, EYE_RX = 15, EYE_RY = 16;
  var BROW_Y = -102;
  var NOSE_Y = -68;
  var MUS_Y = -58;
  var MOUTH_Y = -48;
  var TAU = Math.PI * 2;

  var MOOD_INDEX = { neutral: 0, gloat: 1, sad: 2, angry: 3 };
  var BLEND = 0.3;
  var RX_STOMP = 1, RX_SHOCK = 2, RX_FAINT = 3, RX_RECOVER = 4;
  var RX_CODES = { stomp: 1, shock: 2, faint: 3, recover: 4 };

  // --------------------------------------------------------------- maths
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(v) { v = clamp01(v); return v * v * (3 - 2 * v); }
  function easeOut(v) { v = clamp01(v); return 1 - (1 - v) * (1 - v); }
  function easeIn(v) { v = clamp01(v); return v * v; }
  function easeOutBack(v) { v = clamp01(v); var x = v - 1; return 1 + 2.7 * x * x * x + 1.7 * x * x; }
  function frac(v) { return v - Math.floor(v); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ----------------------------------------------------------------- pose
  // Every mood writes a full pose; poses are blended by weight each frame.
  function Pose() {
    // body (units)
    this.bx = 0; this.by = 0; this.rot = 0; this.sy = 1; this.wide = 0;
    this.fLy = 0; this.fRy = 0;
    // hands (body space) and elbow bend
    this.hLx = -12; this.hLy = -14; this.hRx = 12; this.hRy = -14; this.bend = 1;
    this.shX = 50; this.shY = -40;
    // hat offset from its resting place on the head
    this.hatX = 0; this.hatY = 0; this.hatRot = 0;
    // eyes
    this.lookX = 0; this.lookY = 0; this.open = 0.6; this.tilt = 0; this.happy = 0;
    this.eyeS = 1; this.pupil = 6.5;
    // brows
    this.browY = 0; this.browAng = 0; this.browArch = 0; this.browSkew = 0;
    // moustache
    this.curl = 0; this.twirl = 0; this.musY = 0;
    // mouth: width, corner / top-middle / bottom-middle heights (relative to MOUTH_Y)
    this.mW = 0; this.mCorner = 0; this.mTop = 0; this.mBot = 0;
    this.cheek = 0;
  }
  var KEYS = Object.keys(new Pose());
  var NK = KEYS.length;
  var PM = [new Pose(), new Pose(), new Pose(), new Pose()];
  var PX = new Pose();
  var R = new Pose();

  function zeroPose(p) { for (var i = 0; i < NK; i++) p[KEYS[i]] = 0; }
  function addPose(dst, src, w) { for (var i = 0; i < NK; i++) { var k = KEYS[i]; dst[k] += src[k] * w; } }
  function mixPose(dst, src, w) { for (var i = 0; i < NK; i++) { var k = KEYS[i]; dst[k] += (src[k] - dst[k]) * w; } }
  function copyPose(dst, src) { for (var i = 0; i < NK; i++) { var k = KEYS[i]; dst[k] = src[k]; } }

  // ---------------------------------------------------------------- state
  function create() {
    var st = {
      target: 0,
      w: [1, 0, 0, 0],
      from: [1, 0, 0, 0],
      t0: [0, 0, 0, 0],
      blendT0: -1e9,
      takeT0: -1e9,
      lastT: null,
      seed: Math.random() * 40,
      I: 0,
      flush: 0,
      gPhase: 0,
      rPhase: 0,
      // hat follow-through springs (world units)
      hx: 0, hy: 0, hvx: 0, hvy: 0, hr: 0, hvr: 0, ayPrev: 0, springOk: false,
      ox: 0, oy: 0, or: 0,
      // reactions
      queued: null,
      rx: 0,
      rxT0: 0,
      dustT0: -1e9, dustX: 0, dustS: 1,
      hatFree: false, hfT0: 0, hf0x: 0, hf0y: 0, hf0r: 0,
      hfx: 0, hfy: 0, hfr: 0,
      react: null
    };
    st.react = function (name) { st.queued = name; };
    return st;
  }

  function rebase(st, d) {
    st.blendT0 += d; st.takeT0 += d; st.rxT0 += d; st.dustT0 += d; st.hfT0 += d;
    for (var i = 0; i < 4; i++) st.t0[i] += d;
  }

  // ----------------------------------------------------------- idle cycles
  var LOOK = [0, -1, -1, 0, 1, 1, 0, 0.6, -0.8, 0, 1, 0];
  function lookCycle(tt) {
    var seg = 1.7, k = Math.floor(tt / seg), n = LOOK.length;
    var a = LOOK[(((k - 1) % n) + n) % n], b = LOOK[((k % n) + n) % n];
    return a + (b - a) * smooth((tt - k * seg) / 0.2);
  }
  function blinkMul(tt) {
    var per = 3.3, k = Math.floor(tt / per);
    var u = tt - (k * per + hash(k) * 1.5);
    if (u < 0 || u > 0.17) return 1;
    return u < 0.06 ? 1 - u / 0.06 : (u - 0.06) / 0.11;
  }
  // sad sigh: +1 full inhale, -1 deflated
  var SIGH_PER = 5.4;
  function sighCurve(ph) {
    var u = ph - 0.9;
    if (u < 0) return 0;
    u = u % SIGH_PER;
    if (u < 1.3) return smooth(u / 1.3);
    if (u < 2.1) return 1 - 2 * easeOut((u - 1.3) / 0.8);
    return -1 + smooth((u - 2.1) / 1.8);
  }

  // ------------------------------------------------------------ mood poses
  function poseNeutral(p, st, tt, ph, I, m) {
    var breath = Math.sin(tt * 2.1) * m;
    p.bx = 0; p.by = 0; p.rot = 0.01 * Math.sin(tt * 0.9) * m;
    p.sy = 1 + 0.016 * breath; p.wide = 0;
    p.fLy = 0; p.fRy = 0;
    // hands on hips; every ~8 s he gives his moustache a twirl
    p.hLx = -57; p.hLy = -21;
    p.hRx = 57; p.hRy = -21;
    p.bend = 1.25; p.shX = 50; p.shY = -40;
    var cyc = 8.3, u = frac((tt + 3) / cyc) * cyc;
    var g = 0;
    if (u < 2.2) g = smooth(u / 0.45) * (1 - smooth((u - 1.6) / 0.6));
    g *= m;
    var tw = u * 11;
    p.hRx = lerp(p.hRx, 38 + 2.5 * Math.cos(tw), g);
    p.hRy = lerp(p.hRy, -56 + 2.5 * Math.sin(tw), g);
    p.curl = 0; p.twirl = 0.9 * g; p.musY = 0;
    p.hatX = 0; p.hatY = 0; p.hatRot = 0.03 * Math.sin(tt * 1.25 + 0.5) * m;
    var look = lookCycle(tt) * m * (1 - g);
    p.lookX = 4.3 * look; p.lookY = 1;
    p.open = 0.64 - 0.12 * g; p.tilt = 0.05; p.happy = 0; p.eyeS = 1; p.pupil = 7;
    p.browY = 0; p.browAng = 0.06; p.browArch = 0; p.browSkew = 2.2 * look;
    p.mW = 0; p.mCorner = 0; p.mTop = 0; p.mBot = 0;
    p.cheek = 0;
  }

  function poseGloat(p, st, tt, ph, I, m) {
    var hp = st.gPhase, u = frac(hp);
    var hgt = Math.sin(Math.PI * u) * m;
    var near = Math.min(u, 1 - u);
    var contact = Math.exp(-(near * near) / 0.006) * m;
    var amp = 3.6 + 8 * I;
    var dance = I * I * m;
    var swing = Math.sin(Math.PI * hp);
    p.by = -amp * hgt;
    p.sy = 1 + (0.03 + 0.05 * I) * Math.abs(Math.cos(Math.PI * u)) * (1 - contact) * m - (0.05 + 0.09 * I) * contact;
    p.bx = (1.5 + 5.5 * dance) * swing * m;
    p.rot = (0.03 + 0.07 * dance) * swing * m;
    p.wide = 0;
    p.fLy = -10 * dance * Math.max(0, swing) * hgt;
    p.fRy = -10 * dance * Math.max(0, -swing) * hgt;
    // rubbing his hands
    var r = st.rPhase * TAU;
    var ra = (2.2 + 1.5 * I) * m;
    p.hLx = -9 + ra * Math.cos(r); p.hLy = -26 + 1.2 * ra * Math.sin(r) - 2 * I * hgt;
    p.hRx = 9 - ra * Math.cos(r); p.hRy = -26 - 1.2 * ra * Math.sin(r) - 2 * I * hgt;
    p.bend = 1.5; p.shX = 48; p.shY = -32;
    p.hatX = 0; p.hatY = -1.5; p.hatRot = -0.1 + 0.1 * dance * swing;
    p.lookX = 0; p.lookY = 0; p.open = 0; p.tilt = 0; p.happy = 1; p.eyeS = 1; p.pupil = 6.5;
    p.browY = 0.5 - 1 * I - 1.5 * hgt; p.browAng = -0.18; p.browArch = 4; p.browSkew = 0;
    p.curl = 1; p.twirl = 0; p.musY = -2;
    var laugh = 0.65 + 0.35 * (m ? hgt : 1);
    p.mW = 26 + 6 * I; p.mCorner = -3; p.mTop = 1; p.mBot = (9 + 6 * I) * laugh;
    p.cheek = 0.6 + 0.4 * I;
  }

  function poseSad(p, st, tt, ph, I, m) {
    var sw = Math.sin(tt * 1.3) * m;
    var sig = sighCurve(ph) * m;
    p.bx = 2.2 * sw; p.by = 0; p.rot = 0.045 * sw;
    p.sy = 0.9 + 0.03 * sig; p.wide = 0.035;
    p.fLy = 0; p.fRy = 0;
    var lag = Math.sin(tt * 1.3 - 0.8) * m;
    p.hLx = -60 - 2 * lag; p.hLy = -14; p.hRx = 60 - 2 * lag; p.hRy = -14;
    p.bend = 0.3; p.shX = 51; p.shY = -40;
    p.hatX = 7; p.hatY = 15 + 1.2 * Math.sin(tt * 0.8) * m; p.hatRot = 0.22 + 0.025 * sw;
    p.lookX = -2 + 1.2 * sw; p.lookY = 3.5; p.open = 0.5; p.tilt = 0.5; p.happy = 0; p.eyeS = 1; p.pupil = 7.6;
    p.browY = -3 - 1.5 * Math.max(0, sig); p.browAng = -0.55; p.browArch = 0; p.browSkew = 0;
    p.curl = -1; p.twirl = 0; p.musY = 1.5;
    var puff = Math.max(0, -sig);
    p.mW = 14 - 5 * puff; p.mCorner = 8 - 3 * puff; p.mTop = 4 - 1.5 * puff; p.mBot = 4 + 3 * puff;
    p.cheek = 0;
  }

  var ANGRY_BEAT = 0.8;
  function poseAngry(p, st, tt, ph, I, m) {
    var k = Math.floor(ph / ANGRY_BEAT), u = ph / ANGRY_BEAT - k;
    var side = (k & 1) ? 1 : -1;
    var lift = 0, impact = 0, hop = 0;
    if (m) {
      if (u < 0.5) lift = easeOut(u / 0.5);
      else if (u < 0.6) lift = 1 - easeIn((u - 0.5) / 0.1);
      if (u >= 0.6) impact = Math.exp(-(u - 0.6) * 7);
      if (u >= 0.6 && u < 0.95) { var v = (u - 0.6) / 0.35; hop = 4 * v * (1 - v); }
    }
    var shake = Math.sin(tt * 120) * 1.4 * m;
    p.bx = shake + side * 2.5 * lift;
    p.by = -3 * lift;
    p.rot = -side * 0.07 * lift + side * 0.025 * impact;
    p.sy = 1 + 0.035 * lift - 0.1 * impact;
    p.wide = 0;
    p.fLy = side < 0 ? -11 * lift : 0;
    p.fRy = side > 0 ? -11 * lift : 0;
    var pump = Math.sin(tt * 34) * m;
    p.hLx = -76; p.hLy = -80 + 3 * pump - 4 * impact;
    p.hRx = 76; p.hRy = -80 - 3 * pump - 4 * impact;
    p.bend = 0.8; p.shX = 50; p.shY = -44;
    p.hatX = 0; p.hatY = -11 * hop; p.hatRot = side * 0.14 * hop;
    p.lookX = 0; p.lookY = 1.5; p.open = 0.58; p.tilt = -0.6; p.happy = 0; p.eyeS = 1; p.pupil = 5.2;
    p.browY = 5; p.browAng = 0.65; p.browArch = -1; p.browSkew = 0;
    p.curl = 0.05 + 0.25 * impact; p.twirl = 0; p.musY = 0;
    var grr = Math.abs(Math.sin(tt * 21)) * m;
    p.mW = 15; p.mCorner = 3; p.mTop = -1.5 - 1.5 * grr; p.mBot = 6 + 1.5 * grr;
    p.cheek = 0;
  }

  var POSES = [poseNeutral, poseGloat, poseSad, poseAngry];

  // ------------------------------------------------------------ reactions
  function setFaintFace(p) {
    p.lookX = 0; p.lookY = 0; p.open = 0; p.happy = -0.6; p.tilt = 0; p.eyeS = 1; p.pupil = 6;
    p.browY = -4; p.browAng = -0.35; p.browArch = 1; p.browSkew = 0;
    p.curl = -0.5; p.twirl = 0; p.musY = 1;
    p.mW = 8; p.mCorner = 0; p.mTop = -3; p.mBot = 3;
    p.cheek = 0;
  }

  // lying-down transform for a body rotation th (0 upright, -PI/2 flat)
  var LIE_CY = -64, LIE_X = 12, HAT_REST_X = -86, HAT_REST_Y = -6.5;
  function lieInto(p, th, k) {
    p.rot = th;
    p.bx = LIE_CY * Math.sin(th) + LIE_X * k;
    p.by = LIE_CY * (1 - Math.cos(th)) + 4 * k;
  }

  function applyReaction(st, t, tt, reduced, m) {
    if (!st.rx) { st.hatFree = false; return 0; }
    var u = t - st.rxT0, W, v;
    if (st.rx === RX_STOMP) {
      if (u > 1.25) { st.rx = 0; return 0; }
      poseAngry(PX, st, tt, 0.3, 0, 0);
      W = easeOut(u / 0.08) * (1 - smooth((u - 0.95) / 0.3));
      if (m) {
        var sy = 1, by = 0;
        if (u < 0.14) sy = 1 - 0.16 * easeOut(u / 0.14);
        else if (u < 0.52) {
          v = (u - 0.14) / 0.38;
          by = -34 * 4 * v * (1 - v);
          sy = lerp(0.84, 1 + 0.12 * (1 - 2 * v) * (1 - 2 * v), easeOut((u - 0.14) / 0.05));
        } else {
          v = u - 0.52;
          sy = 1 - 0.24 * (1 - Math.exp(-v * 70)) * Math.exp(-v * 6.5) * Math.cos(v * 15);
          if (st.dustT0 < st.rxT0) { st.dustT0 = st.rxT0 + 0.52; st.dustX = 0; st.dustS = 1.25; }
        }
        PX.sy = sy; PX.by = by; PX.bx = 0; PX.rot = 0; PX.fLy = 0; PX.fRy = 0;
        var hv0 = (u - 0.54) / 0.34;
        if (hv0 > 0 && hv0 < 1) { PX.hatY = -18 * 4 * hv0 * (1 - hv0); PX.hatRot = 0.16 * Math.sin(hv0 * Math.PI); }
        else { PX.hatY = 0; PX.hatRot = 0; }
        var pump = u > 0.5 ? Math.exp(-(u - 0.52) * 6) : 0;
        PX.hLy = -82 + 12 * pump; PX.hRy = -82 + 12 * pump;
      }
      mixPose(R, PX, W);
      return W;
    }
    if (st.rx === RX_SHOCK) {
      if (u > 1.6) { st.rx = 0; return 0; }
      copyPose(PX, R);
      W = easeOut(u / 0.06) * (1 - smooth((u - 1.2) / 0.4));
      var pop = easeOutBack(u / 0.18);
      PX.eyeS = 1 + 0.34 * pop; PX.pupil = 3.2; PX.open = 1; PX.tilt = 0; PX.happy = 0;
      PX.lookX = 0; PX.lookY = 0;
      PX.browY = -7; PX.browAng = -0.2; PX.browArch = 3; PX.browSkew = 0;
      PX.curl = 0.7; PX.twirl = 0; PX.musY = -2;
      PX.mW = 9; PX.mCorner = 0; PX.mTop = -4.5; PX.mBot = 5.5;
      PX.cheek = 0;
      PX.hLx = -78; PX.hLy = -74; PX.hRx = 78; PX.hRy = -74; PX.bend = 0.9;
      PX.bx = 0; PX.rot = 0; PX.fLy = 0; PX.fRy = 0; PX.wide = 0;
      if (m) {
        // anticipation squash, stretch on the gasp, squash when the hat lands
        var land = 0.95;
        if (u < 0.07) PX.sy = 1 - 0.1 * easeOut(u / 0.07);
        else if (u < land) PX.sy = lerp(0.9, 1.12, easeOut((u - 0.07) / 0.1)) - 0.1 * smooth((u - 0.3) / 0.5);
        else PX.sy = 1.02 - 0.12 * Math.exp(-(u - land) * 7) * Math.cos((u - land) * 18);
        PX.by = u < land ? -5 * Math.sin(Math.PI * clamp01((u - 0.07) / 0.4)) : 0;
        // hat flies up and drops back on
        if (u > 0.07 && u < land) {
          v = (u - 0.07) / (land - 0.07);
          PX.hatY = -50 * 4 * v * (1 - v);
          PX.hatRot = 0.55 * Math.sin(v * TAU);
          PX.hatX = 6 * Math.sin(v * Math.PI);
        } else { PX.hatY = 0; PX.hatRot = 0; PX.hatX = 0; }
      } else {
        PX.sy = 1.03; PX.by = 0; PX.hatY = -16; PX.hatRot = 0; PX.hatX = 0;
      }
      mixPose(R, PX, W);
      return W;
    }
    if (st.rx === RX_FAINT) {
      copyPose(PX, R);
      setFaintFace(PX);
      PX.wide = 0; PX.fLy = 0; PX.fRy = 0; PX.sy = 1;
      PX.hatX = 0; PX.hatY = 0; PX.hatRot = 0;
      W = m ? easeOut(u / 0.12) : 1;
      var th = 0, k = 0;
      if (!m) { th = -Math.PI / 2; k = 1; }
      else if (u < 0.45) {
        // swoon: eyes roll shut, a woozy wobble, arms go limp
        v = smooth(u / 0.3);
        th = 0.06 * v + 0.05 * Math.sin(u * 22) * v * (1 - smooth((u - 0.15) / 0.3));
        PX.sy = 1 + 0.04 * v;
        PX.by = -2 * v;
        PX.open = lerp(R.open, 0, v);
        PX.happy = lerp(0, -0.6, v);
      } else if (u < 1.05) {
        v = easeIn((u - 0.45) / 0.6);
        th = lerp(0.06, -Math.PI / 2, v);
        k = v;
      } else {
        v = u - 1.05;
        th = -Math.PI / 2 + 0.16 * Math.exp(-v * 6) * Math.abs(Math.sin(v * 13));
        k = 1;
        if (st.dustT0 < st.rxT0) { st.dustT0 = st.rxT0 + 1.05; st.dustX = LIE_X - 10; st.dustS = 1.5; }
        PX.sy = 1 - 0.05 * Math.exp(-v * 5) * Math.cos(v * 16) + 0.008 * Math.sin(tt * 1.8);
      }
      if (u < 0.45 || !m) {
        PX.hLx = lerp(R.hLx, -58, smooth(u / 0.3)); PX.hLy = lerp(R.hLy, -15, smooth(u / 0.3));
        PX.hRx = lerp(R.hRx, 58, smooth(u / 0.3)); PX.hRy = lerp(R.hRy, -15, smooth(u / 0.3));
      } else {
        PX.hLx = -60; PX.hLy = -40; PX.hRx = 60; PX.hRy = -40;
      }
      PX.bend = 0.6;
      if (u >= 0.45 || !m) {
        var ry = PX.by;
        lieInto(PX, th, k);
        PX.by += ry * (1 - k);
      } else { PX.rot = th; }
      mixPose(R, PX, W);
      // hat: comes off as he goes over
      if (!m) {
        st.hatFree = true; st.hfx = HAT_REST_X; st.hfy = HAT_REST_Y; st.hfr = 0;
      } else if (u >= 0.86) {
        if (!st.hatFree) {
          var a = R.rot, Y = HAT_Y * R.sy;
          st.hf0x = R.bx - Y * Math.sin(a) + st.ox; st.hf0y = R.by + Y * Math.cos(a) + st.oy;
          st.hf0r = a + R.hatRot + st.or; st.hfT0 = t; st.hatFree = true;
        }
        var ht = t - st.hfT0, dur = 0.5;
        v = clamp01(ht / dur);
        st.hfx = lerp(st.hf0x, HAT_REST_X, easeOut(v));
        st.hfy = lerp(st.hf0y, HAT_REST_Y, v * v) - 30 * v * (1 - v);
        st.hfr = v < 1 ? lerp(st.hf0r, 0, easeOut(v)) - 0.5 * Math.sin(v * Math.PI) :
          -0.14 * Math.exp(-(ht - dur) * 5) * Math.sin((ht - dur) * 16);
      } else st.hatFree = false;
      return W;
    }
    if (st.rx === RX_RECOVER) {
      var dur2 = 0.75;
      if (u > dur2 + 0.35) { st.rx = 0; st.hatFree = false; return 0; }
      copyPose(PX, R);
      setFaintFace(PX);
      v = m ? clamp01(u / 0.5) : 1;
      var th2 = -Math.PI / 2 * (1 - easeOutBack(v));
      lieInto(PX, th2, 1 - smooth(v));
      PX.sy = 1; PX.wide = 0;
      PX.hLx = -60; PX.hLy = -40; PX.hRx = 60; PX.hRy = -40; PX.bend = 0.6;
      W = 1 - smooth((u - 0.35) / 0.4);
      mixPose(R, PX, W);
      // hat hops back on
      if (m && u < 0.6) {
        st.hatFree = true;
        var hv = clamp01(u / 0.6);
        var a2 = R.rot, Y2 = HAT_Y * R.sy;
        var tx = R.bx - Y2 * Math.sin(a2), ty = R.by + Y2 * Math.cos(a2);
        st.hfx = lerp(HAT_REST_X, tx, smooth(hv));
        st.hfy = lerp(HAT_REST_Y, ty, hv) - 150 * hv * (1 - hv);
        st.hfr = lerp(0, a2, hv) + 0.45 * Math.sin(hv * Math.PI);
      } else {
        st.hatFree = false;
        if (m && u < 0.95) {
          var lv = u - 0.6;
          R.sy -= 0.12 * Math.exp(-lv * 8) * Math.cos(lv * 18);
        }
      }
      return W;
    }
    return 0;
  }

  // ------------------------------------------------------------- springs
  function updateSprings(st, dt, reset) {
    var th = R.rot, Y = HAT_Y * R.sy;
    var ax = R.bx - Y * Math.sin(th), ay = R.by + Y * Math.cos(th);
    if (reset || !st.springOk || st.hatFree) {
      st.hx = ax; st.hy = ay; st.hvx = 0; st.hvy = 0; st.hr = th; st.hvr = 0;
      st.ayPrev = ay; st.springOk = true; st.ox = 0; st.oy = 0; st.or = 0;
      return;
    }
    var vay = dt > 0 ? (ay - st.ayPrev) / dt : 0;
    st.ayPrev = ay;
    var n = Math.ceil(dt / 0.004);
    if (n > 30) n = 30;
    var h = n > 0 ? dt / n : 0;
    for (var i = 0; i < n; i++) {
      st.hvx += (800 * (ax - st.hx) - 22 * st.hvx) * h; st.hx += st.hvx * h;
      st.hvy += (1100 * (ay - st.hy) - 18 * st.hvy) * h; st.hy += st.hvy * h;
      if (st.hy > ay + 1.5) { st.hy = ay + 1.5; if (st.hvy > vay) st.hvy = vay; }
      if (st.hy < ay - 30) { st.hy = ay - 30; if (st.hvy < 0) st.hvy = 0; }
      st.hvr += (500 * (th - st.hr) - 13 * st.hvr) * h; st.hr += st.hvr * h;
    }
    st.ox = st.hx - ax; st.oy = st.hy - ay; st.or = st.hr - th;
  }

  // ------------------------------------------------------- path helpers
  // Body squash is applied to coordinates (not ctx.scale) so outlines stay even.
  var C = null, KX = 1, KY = 1;
  function M(x, y) { C.moveTo(x * KX, y * KY); }
  function L(x, y) { C.lineTo(x * KX, y * KY); }
  function Q(a, b, x, y) { C.quadraticCurveTo(a * KX, b * KY, x * KX, y * KY); }
  function B(a, b, c, d, x, y) { C.bezierCurveTo(a * KX, b * KY, c * KX, d * KY, x * KX, y * KY); }
  function EF(x, y, rx, ry) { C.moveTo((x + rx) * KX, y * KY); C.ellipse(x * KX, y * KY, rx * KX, ry * KY, 0, 0, TAU); }
  function inkStroke(w) { C.lineWidth = w; C.strokeStyle = INK; C.stroke(); }

  // ---------------------------------------------------------------- body
  function traceBody(ox, oy) {
    M(ox, oy - 124);
    B(ox + 37, oy - 124, ox + 60, oy - 94, ox + 60, oy - 58);
    B(ox + 60, oy - 24, ox + 35, oy - 4, ox, oy - 4);
    B(ox - 35, oy - 4, ox - 60, oy - 24, ox - 60, oy - 58);
    B(ox - 60, oy - 94, ox - 37, oy - 124, ox, oy - 124);
    C.closePath();
  }

  function drawFeet() {
    C.beginPath();
    EF(-18, -6 + R.fLy, 14, 7.5);
    EF(18, -6 + R.fRy, 14, 7.5);
    C.fillStyle = SUIT; C.fill();
    inkStroke(5);
  }

  function drawBody(st, tt) {
    var c = C;
    c.save();
    c.beginPath(); traceBody(0, 0); c.clip();
    c.fillStyle = SKIN;
    c.fillRect(-70 * KX, -130 * KY, 140 * KX, 130 * KY);
    // anger: red rising from the bottom of his face
    if (st.flush > 0.01) {
      var fy = lerp(-30, -128, easeOut(st.flush));
      var wv = Math.sin(tt * 7) * 3;
      c.fillStyle = FLUSH;
      c.beginPath();
      M(-70, 0); L(-70, fy + 2);
      Q(-35, fy - 4 + wv, 0, fy); Q(35, fy + 4 - wv, 70, fy - 2);
      L(70, 0); c.closePath(); c.fill();
    }
    if (R.cheek > 0.01) {
      c.globalAlpha = R.cheek * 0.6;
      c.fillStyle = CHEEK;
      c.beginPath(); EF(-39, -63, 10, 6.5); EF(39, -63, 10, 6.5); c.fill();
      c.globalAlpha = 1;
    }
    // waistcoat
    c.fillStyle = PAL.vest;
    c.beginPath(); M(-70, -31); Q(0, -13, 70, -31); L(70, 2); L(-70, 2); c.closePath(); c.fill();
    c.beginPath(); M(-70, -31); Q(0, -13, 70, -31); inkStroke(LINE);
    // one shade tone, lower right
    c.fillStyle = SHADE;
    c.beginPath(); traceBody(0, 0); traceBody(-8, -9); c.fill('evenodd');
    c.restore();
    c.beginPath(); traceBody(0, 0); inkStroke(OUT);
    // bow tie
    c.beginPath();
    M(0, -21); L(-14, -28); Q(-17.5, -21, -14, -14); c.closePath();
    M(0, -21); L(14, -28); Q(17.5, -21, 14, -14); c.closePath();
    c.fillStyle = PAL.bow; c.fill(); inkStroke(LINE);
    c.beginPath(); EF(0, -21, 4.4, 4.4); c.fill(); inkStroke(3.6);
  }

  // ----------------------------------------------------------------- face
  function drawEye(side, openMul) {
    var c = C;
    var ex = side * EYE_X, ey = EYE_Y;
    var s = R.eyeS, rx = EYE_RX * s, ry = EYE_RY * s;
    var hap = R.happy;
    var open = R.open * openMul * (1 - clamp01(hap * 2));
    if (open > 0.07) {
      var b = -ry + (1 - open) * 1.6 * ry; // lid height at eye centre (eye-local)
      var mm = side * R.tilt * 0.62; // lid slope
      // lid line meets the ellipse at X1, X2
      var A = 1 / (rx * rx) + (mm * mm) / (ry * ry);
      var Bq = (2 * b * mm) / (ry * ry);
      var Cq = (b * b) / (ry * ry) - 1;
      var disc = Bq * Bq - 4 * A * Cq;
      c.beginPath();
      var cut = disc > 0;
      var x1 = 0, x2 = 0, y1 = 0, y2 = 0, mx = 0, my = 0;
      if (cut) {
        var sq = Math.sqrt(disc);
        x1 = (-Bq - sq) / (2 * A); x2 = (-Bq + sq) / (2 * A);
        y1 = b + mm * x1; y2 = b + mm * x2;
        var a1 = Math.atan2(y1 / ry, x1 / rx), a2 = Math.atan2(y2 / ry, x2 / rx);
        var bulge = (2.6 - 2 * Math.min(1, Math.abs(R.tilt) * 1.6)) * clamp01(open * 2.2);
        mx = ex + (x1 + x2) / 2; my = ey + (y1 + y2) / 2 + 2 * bulge;
        M(ex + x1, ey + y1); Q(mx, my, ex + x2, ey + y2);
        c.ellipse(ex * KX, ey * KY, rx * KX, ry * KY, 0, a2, a1, false);
        c.closePath();
      } else {
        EF(ex, ey, rx, ry);
      }
      c.fillStyle = WHITE; c.fill();
      inkStroke(LINE);
      c.save();
      c.clip();
      c.beginPath();
      var px = ex + R.lookX, py = ey + R.lookY + 1.5, pr = R.pupil * (0.85 + 0.15 * s);
      EF(px, py, pr, pr);
      c.fillStyle = INK; c.fill();
      c.beginPath(); EF(px - pr * 0.35, py - pr * 0.38, pr * 0.32, pr * 0.32);
      c.fillStyle = WHITE; c.fill();
      c.restore();
      if (cut && open < 0.97) {
        c.beginPath(); M(ex + x1, ey + y1); Q(mx, my, ex + x2, ey + y2); inkStroke(5.6);
      }
    } else {
      // closed: happy arc (hap>0) or a soft closed line
      var cv = hap > 0.5 ? (hap - 0.5) * 2 : 0;
      var yb = ey + ry * 0.45 - cv * ry * 0.1;
      var ctl = yb - cv * ry * 1.5 + (hap < 0 ? -hap * ry * 0.9 : 0) + (cv === 0 && hap >= 0 ? ry * 0.15 : 0);
      c.beginPath();
      M(ex - rx * 0.92, yb); Q(ex, ctl, ex + rx * 0.92, yb);
      inkStroke(5.6);
    }
  }

  function drawBrows() {
    var y0 = BROW_Y + R.browY, ang = R.browAng * 7, arch = R.browArch + 2;
    C.beginPath();
    var yl = y0 + R.browSkew, yr = y0 - R.browSkew;
    M(-7, yl + ang); Q(-20, yl - arch, -33, yl - ang);
    M(7, yr + ang); Q(20, yr - arch, 33, yr - ang);
    inkStroke(8.5);
  }

  function drawMouth(sadW, tt) {
    var w = R.mW;
    if (w < 1.5) return;
    var hw = w / 2, cy = MOUTH_Y;
    var yc = cy + R.mCorner, yt = cy + R.mTop, yb = cy + R.mBot;
    if (sadW > 0.01) { var q = Math.sin(tt * 13) * 0.9 * sadW; yt += q; yb += q; }
    C.beginPath();
    if (yb - yt < 1.6) {
      var ym = (yt + yb) / 2;
      M(-hw, yc); Q(0, 2 * ym - yc, hw, yc);
      inkStroke(LINE + 0.6);
      return;
    }
    M(-hw, yc); Q(0, 2 * yt - yc, hw, yc); Q(0, 2 * yb - yc, -hw, yc); C.closePath();
    C.fillStyle = INK; C.fill();
    inkStroke(LINE);
    if (yb - yt > 6 && R.mCorner < 0) {
      C.beginPath(); EF(0, yb - (yb - yt) * 0.28, hw * 0.42, (yb - yt) * 0.24);
      C.fillStyle = TONGUE; C.fill();
    }
  }

  function traceMoustache(curl, twirl) {
    // a single handlebar: two lobes meeting under the nose, tips that curl
    var y = MUS_Y + R.musY;
    var dR = curl + twirl, dL = curl;
    var tRx = 34 - 1.5 * Math.abs(dR), tRy = y + 2 - dR * 8;
    var tLx = 34 - 1.5 * Math.abs(dL), tLy = y + 2 - dL * 8;
    M(0, y - 2);
    B(7, y - 6, 19, y - 4, tRx, tRy);
    Q(tRx + 5.5, tRy + 2.5 - dR * 2.5, tRx - 3, tRy + 5.5 + dR * 0.5);
    B(22, y + 11 - dR * 2, 9, y + 11, 0, y + 6.5);
    B(-9, y + 11, -22, y + 11 - dL * 2, -tLx + 3, tLy + 5.5 + dL * 0.5);
    Q(-tLx - 5.5, tLy + 2.5 - dL * 2.5, -tLx, tLy);
    B(-19, y - 4, -7, y - 6, 0, y - 2);
    C.closePath();
  }

  function drawFace(st, tt, openMul, sadW) {
    drawEye(-1, openMul);
    drawEye(1, openMul);
    drawBrows();
    drawMouth(sadW, tt);
    C.beginPath(); traceMoustache(R.curl, R.twirl);
    C.fillStyle = WHITE; C.fill(); inkStroke(LINE + 0.3);
    C.beginPath(); EF(0, NOSE_Y + R.musY * 0.5, 7.8, 7.8);
    C.fillStyle = NOSE; C.fill(); inkStroke(LINE);
  }

  // ---------------------------------------------------------------- arms
  function armPath(sx, sy, hx, hy, side, bend) {
    var mx = (sx + hx) / 2, my = (sy + hy) / 2;
    var dx = hx - sx, dy = hy - sy, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    if (nx * side < 0) { nx = -nx; ny = -ny; }
    var k = 10 * bend;
    M(sx, sy); Q(mx + nx * k, my + ny * k, hx, hy);
  }
  function drawArms() {
    var c = C;
    c.beginPath();
    armPath(-R.shX, R.shY, R.hLx, R.hLy, -1, R.bend);
    armPath(R.shX, R.shY, R.hRx, R.hRy, 1, R.bend);
    inkStroke(17);
    c.strokeStyle = SUIT; c.lineWidth = 8.6; c.stroke();
    c.beginPath(); EF(R.hLx, R.hLy, 8.5, 8.5); EF(R.hRx, R.hRy, 8.5, 8.5);
    c.fillStyle = WHITE; c.fill(); inkStroke(LINE);
  }

  // ----------------------------------------------------------------- hat
  function drawHat() {
    var c = C;
    c.beginPath();
    M(-29, -4); L(-35, -72); Q(0, -81, 35, -72); L(29, -4); c.closePath();
    c.fillStyle = SUIT; c.fill(); inkStroke(OUT);
    c.beginPath(); M(-25, -62); L(-22.5, -34);
    c.strokeStyle = SUIT_HI; c.lineWidth = 6; c.stroke();
    c.beginPath(); M(-30.4, -25); L(30.4, -25); L(29.3, -11); L(-29.3, -11); c.closePath();
    c.fillStyle = GOLD; c.fill(); inkStroke(LINE);
    c.beginPath();
    M(-63, 0); B(-63, -9, -38, -6, 0, -6); B(38, -6, 63, -9, 63, 0);
    B(63, 8, 38, 6.5, 0, 6.5); B(-38, 6.5, -63, 8, -63, 0); c.closePath();
    c.fillStyle = SUIT; c.fill(); inkStroke(OUT);
  }

  // ------------------------------------------------------------- effects
  // cloud puffs are batched: wide ink stroke first, then white fill on top
  function puff(x, y, r) {
    if (r < 0.5) return;
    EF(x - r * 0.62, y + r * 0.12, r * 0.62, r * 0.62);
    EF(x + r * 0.62, y + r * 0.12, r * 0.62, r * 0.62);
    EF(x, y - r * 0.25, r * 0.78, r * 0.78);
  }
  function fillPuffs(col, w) {
    C.lineWidth = w; C.strokeStyle = INK; C.stroke();
    C.fillStyle = col; C.fill();
  }

  function drawSteam(st, t, aw, m) {
    if (aw < 0.02) return;
    C.beginPath();
    if (!m) {
      puff(-60, 0, 8 * aw); puff(60, -2, 8 * aw);
    } else {
      var ph = t - st.t0[3];
      for (var i = 0; i < 4; i++) {
        var side = (i & 1) ? 1 : -1;
        var v = frac(ph / 1.05 + i * 0.25 + 0.1);
        var r = 9.5 * Math.pow(Math.sin(Math.PI * v), 0.8) * (1 - 0.35 * v) * aw;
        puff(side * (44 + 34 * v), 2 - 26 * v - 6 * v * v, r);
      }
    }
    fillPuffs(WHITE, 7);
  }

  function star(x, y, r, rot) {
    if (r < 0.4) return;
    var c = Math.cos(rot), s = Math.sin(rot), k = 0.2;
    var ax = c * r, ay = s * r, bx = -s * r, by = c * r;
    C.moveTo(x - bx, y - by);
    C.quadraticCurveTo(x + (ax - bx) * k, y + (ay - by) * k, x + ax, y + ay);
    C.quadraticCurveTo(x + (ax + bx) * k, y + (ay + by) * k, x + bx, y + by);
    C.quadraticCurveTo(x + (bx - ax) * k, y + (by - ay) * k, x - ax, y - ay);
    C.quadraticCurveTo(x - (ax + bx) * k, y - (ay + by) * k, x - bx, y - by);
    C.closePath();
  }

  function drawSparkles(st, tt, gw, I, ox, oy, m) {
    if (gw < 0.02) return;
    C.beginPath();
    if (!m) {
      star(ox + 62, oy - 158, 10 * gw, 0);
    } else {
      var per = 1.25 - 0.45 * I;
      for (var j = 0; j < 3; j++) {
        var en = j === 0 ? 1 : clamp01((I - 0.15 - 0.25 * j) * 4);
        if (en <= 0) continue;
        var q = tt / per + j / 3, n = Math.floor(q), v = q - n;
        if (v > 0.6) continue;
        var e = Math.sin(Math.PI * v / 0.6);
        var ang = -2.7 + 2.2 * hash(n * 3 + j + 1), rad = 82 + 22 * hash(n * 7 + j);
        var r = (8 + 5 * I) * e * gw * en;
        star(ox + Math.cos(ang) * rad * 1.1, oy - 100 + Math.sin(ang) * rad, r, v * 1.4);
      }
    }
    C.fillStyle = GOLD; C.fill();
    C.lineWidth = 3; C.strokeStyle = INK; C.stroke();
  }

  function drawTear(st, t, sw, m) {
    if (sw < 0.02) return;
    var x = -EYE_X - 11, y = EYE_Y + 11, sc, stretch = 1;
    if (!m) { sc = 0.9 * sw; y += 10; }
    else {
      var u = t - st.t0[2] - 0.5;
      if (u < 0) return;
      u = u % 3.6;
      if (u < 1.0) sc = easeOutBack(u / 1.0);
      else if (u < 1.35) sc = 1 + 0.12 * smooth((u - 1.0) / 0.35);
      else if (u < 1.9) {
        var f = u - 1.35;
        y += 130 * f * f; x -= 6 * f;
        sc = 1.12 * (1 - smooth((f - 0.35) / 0.2));
        stretch = 1 + 0.5 * smooth(f / 0.2);
      } else return;
      sc *= sw;
    }
    if (sc < 0.05) return;
    var r = 6.8 * sc, top = 9.5 * sc * stretch;
    C.beginPath();
    M(x, y - top - r * 0.2);
    Q(x + r, y - r * 0.4, x + r, y + r * 0.3);
    C.arc(x * KX, (y + r * 0.3) * KY, r * KX, 0, Math.PI, false);
    Q(x - r, y - r * 0.4, x, y - top - r * 0.2);
    C.closePath();
    C.fillStyle = TEAR; C.fill(); inkStroke(3.2);
  }

  function drawSigh(st, t, sw) {
    if (sw < 0.02) return;
    var u = t - st.t0[2] - 0.9;
    if (u < 0) return;
    u = u % SIGH_PER - 1.3;
    if (u < 0 || u > 1.4) return;
    var v = u / 1.4;
    C.beginPath();
    var r1 = 7.5 * Math.pow(Math.sin(Math.PI * v), 0.7) * sw;
    var v2 = clamp01(v * 1.25 - 0.25);
    var r2 = 5 * Math.pow(Math.sin(Math.PI * v2), 0.7) * sw;
    puff(-30 - 30 * v, MOUTH_Y + 4 + 8 * v, r1);
    puff(-26 - 22 * v2, MOUTH_Y + 2 + 6 * v2, r2);
    fillPuffs(WHITE, 6);
  }

  function drawDust(st, t, m) {
    var u = t - st.dustT0;
    if (!m || u < 0 || u > 0.6) return;
    var v = u / 0.6, s = st.dustS;
    var r = 9 * s * Math.pow(Math.sin(Math.PI * clamp01(v * 1.1)), 0.6) * (1 - v * 0.4);
    C.beginPath();
    puff(st.dustX - 24 * s - 30 * v * s, -4 - 4 * v, r);
    puff(st.dustX + 24 * s + 30 * v * s, -4 - 4 * v, r);
    puff(st.dustX - 8 * s - 10 * v, -9 - 8 * v, r * 0.7);
    fillPuffs(DUST, 6);
  }

  function drawDizzy(st, t, tt, m) {
    if (st.rx !== RX_FAINT) return;
    var u = t - st.rxT0;
    if (m && u < 1.3) return;
    var a = m ? smooth((u - 1.3) / 0.3) : 1;
    var cx = LIE_X - 38, cy = -134;
    C.beginPath();
    for (var i = 0; i < 3; i++) {
      var ang = (m ? tt * 3.2 : 0.6) + i * TAU / 3;
      star(cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 7, (5.5 + 1.6 * Math.sin(ang)) * a, ang);
    }
    C.fillStyle = GOLD; C.fill();
    C.lineWidth = 2.6; C.strokeStyle = INK; C.stroke();
  }

  // ---------------------------------------------------------------- draw
  function draw(ctx, st, x, y, h, mood, intensity, t, dt, reduced) {
    if (!ctx || !st || !(h > 0)) return;
    var m = reduced ? 0 : 1;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    var first = st.lastT === null;
    if (!first && t < st.lastT) rebase(st, t - st.lastT - dt);
    st.lastT = t;
    var i;

    // mood blend (0.3 s) with a squash-and-pop take on each change
    var mi = MOOD_INDEX[mood];
    if (mi === undefined) mi = 0;
    if (first) {
      st.target = mi;
      for (i = 0; i < 4; i++) { st.w[i] = st.from[i] = i === mi ? 1 : 0; st.t0[i] = t; }
      st.blendT0 = t - 1;
      st.flush = mi === 3 ? 1 : 0;
    } else if (mi !== st.target) {
      for (i = 0; i < 4; i++) st.from[i] = st.w[i];
      st.target = mi; st.blendT0 = t; st.t0[mi] = t;
      if (m) st.takeT0 = t;
    }
    var e = smooth((t - st.blendT0) / BLEND);
    for (i = 0; i < 4; i++) st.w[i] = st.from[i] + ((i === mi ? 1 : 0) - st.from[i]) * e;

    var I = intensity > 0 ? (intensity < 1 ? intensity : 1) : 0;
    st.I += (I - st.I) * (m ? 1 - Math.exp(-dt * 5) : 1);
    if (m) {
      st.gPhase += dt * (1.5 + 1.2 * st.I);
      st.rPhase += dt * (3 + 3.5 * st.I);
    }

    if (st.queued) {
      var code = RX_CODES[st.queued] || 0;
      st.queued = null;
      if (code === RX_RECOVER) {
        if (st.rx === RX_FAINT) { st.rx = RX_RECOVER; st.rxT0 = t; }
      } else if (code && st.rx !== RX_FAINT) {
        st.rx = code; st.rxT0 = t; st.hatFree = false;
      }
    }

    // pose
    var tt = t + st.seed;
    zeroPose(R);
    for (i = 0; i < 4; i++) {
      if (st.w[i] > 0.0005) { POSES[i](PM[i], st, tt, t - st.t0[i], st.I, m); addPose(R, PM[i], st.w[i]); }
    }
    var openMul = m ? blinkMul(tt) : 1;
    var tu = t - st.takeT0;
    if (tu >= 0 && tu < 0.7) {
      var d = -0.2 * Math.exp(-5.2 * tu) * Math.sin(18.5 * tu);
      R.sy += d;
      if (tu > 0.08 && tu < 0.36) R.by -= 5 * Math.sin(Math.PI * (tu - 0.08) / 0.28);
      openMul *= 1 - clamp01(-d / 0.12) * 0.85;
    }
    var rxW = applyReaction(st, t, tt, reduced, m);
    var angryFace = st.rx === RX_STOMP ? rxW : 0;

    // anger flush rises from the chin
    var ft = Math.max(st.w[3], angryFace);
    if (!m) st.flush = ft;
    else if (st.flush < ft) st.flush = Math.min(ft, st.flush + dt * 1.6);
    else st.flush = Math.max(ft, st.flush - dt * 2.4);

    updateSprings(st, dt, !m);

    // ------------------------------------------------------------ render
    var s = h / UNIT_H;
    var sy = R.sy, sx = 1 + (1 - sy) * 0.9 + R.wide;
    var fainting = st.rx === RX_FAINT || st.rx === RX_RECOVER;
    var faceW = fainting ? 1 - rxW : 1 - angryFace;
    var sadW = st.w[2] * faceW;
    var angW = Math.max(st.w[3] * faceW, angryFace);
    var gloW = st.w[1] * faceW;

    C = ctx;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(x, y);
    ctx.scale(s, s);
    KX = 1; KY = 1;

    // ground shadow
    var air = clamp01(-R.by / 60);
    var lie = fainting ? clamp01(-R.rot / 1.5) : 0;
    ctx.beginPath();
    EF(lerp(R.bx * 0.5, R.bx + 64 * Math.sin(R.rot), lie), 0, (52 - 18 * air) * (1 + 0.45 * lie), 6.5 * (1 - 0.3 * air));
    ctx.fillStyle = SHADOW; ctx.fill();

    drawDust(st, t, m);

    ctx.save();
    ctx.translate(R.bx, R.by);
    ctx.rotate(R.rot);
    drawFeet();
    KX = sx; KY = sy;
    drawBody(st, tt);
    drawFace(st, tt, openMul, sadW * m);
    drawTear(st, t, sadW, m);
    drawArms();
    KX = 1; KY = 1;
    if (!st.hatFree) {
      var c0 = Math.cos(R.rot), s0 = Math.sin(R.rot);
      var lox = st.ox * c0 + st.oy * s0, loy = -st.ox * s0 + st.oy * c0;
      ctx.translate(R.hatX + lox, HAT_Y * sy + R.hatY + loy);
      ctx.rotate(R.hatRot + st.or);
      drawSteam(st, t, angW, m);
      drawHat();
    }
    ctx.restore();

    if (st.hatFree) {
      ctx.save();
      ctx.translate(st.hfx, st.hfy);
      ctx.rotate(st.hfr);
      drawHat();
      ctx.restore();
    }

    drawSigh(st, t, sadW);
    drawSparkles(st, tt, gloW, st.I, R.bx, R.by, m);
    drawDizzy(st, t, tt, m);
    ctx.restore();
    C = null;
  }

  root.DBD_ARTHUR = { create: create, draw: draw, palette: PAL, UNIT_H: UNIT_H, version: 2 };
})(typeof window !== 'undefined' ? window : this);
