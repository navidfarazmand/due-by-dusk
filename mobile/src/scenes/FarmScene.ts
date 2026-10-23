// ============================================================================
// Due by Dusk · v0.6.00 — FarmScene (`src/scenes/FarmScene.ts`)
// Core Phaser 3 Gameplay Scene managing the illustrated regional backgrounds,
// the 30-frame animated Arthur Grumble Sprite, regional crops, camera FX,
// and SaveSystem integration.
// ============================================================================
// @ts-nocheck
import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';
import { loadSettings, storeSettings, SETTINGS_KEY } from '../systems/PlayerSettings';
import { persistPreference } from '../platform/nativeStorage';
import { hapticImpact, setHapticsEnabled } from '../platform/mobile';
import { calculateStats, calculateGrit, upgradeCost, cropHealthMultiplier } from '../domain/economy';
import { GAZETTE_EVENTS, BILLS, SHED, ALMANAC, HEIRS, PERKS } from '../data/crops';
import { GEOGRAPHY as GEO } from '../data/geography';
import { CROPS as CROP } from '../data/crops';
import { SKILL_TREE_NODES as SKILL_NODES } from '../data/skillTree';

// ============================================================================
// Due by Dusk · v0.5.01 — Authored Regional Crop Renderer (`art/cropRenderer.js`)
// Renders 8 baseline crops + 6 country-authentic regional crops:
//   - Canada: `canola` (Plaid Trapper-Hat Canola), `pei_russet` (Sou'wester PEI Russet)
//   - Brazil: `abacaxi` (Samba Pérola Pineapple), `mandioca` (Amazonian Cassava)
//   - France: `lavender` (Provence Lavandin Sheaf)
//   - Japan:  `daikon` (Hachimaki Sumo White Daikon)
// ============================================================================

window.DBD_CROP_RENDERER = (() => {
  'use strict';

  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function radial(g, x0, y0, r0, x1, y1, r1, a, b) {
    const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    return gr;
  }

  // Render any of the 6 new country-authentic regional crops in Stage 3
  function drawRegionalCrop(ctx, c, def, breeze, tNow, shocked, cursorNear, px, py, gpLeaf) {
    const r = c.r;
    const type = c.type;
    const leafLag = breeze * 0.85;

    /* ----------------------------------------------------------------------
       1. CANADIAN PRAIRIE CANOLA (`canola`, r: 22)
          Branching green stems, 4-petaled golden blossoms & Plaid Trapper Hat!
       ---------------------------------------------------------------------- */
    if (type === 'canola') {
      // Branching green canola stalks
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      for (const [bx, by] of [[-10, -r * 1.35], [10, -r * 1.35], [0, -r * 1.65]]) {
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(bx * 0.6, by * 0.5, bx, by);
        ctx.stroke();
        // 4-petaled golden canola flower clusters at branch tips
        for (let a = 0; a < 4; a++) {
          const ang = a * Math.PI / 2 + tNow * 0.8;
          ctx.fillStyle = '#fde047';
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1;
          ell(ctx, bx + Math.cos(ang) * 4.2, by + Math.sin(ang) * 4.2, 3.6, 2.5, ang);
          ctx.stroke();
        }
        ctx.fillStyle = '#a16207';
        circ(ctx, bx, by, 1.8);
      }

      // Plump leafy canola body bulb
      ctx.fillStyle = radial(ctx, -4, -r * 0.85, 2, 0, -r * 0.65, r, '#fef08a', '#eab308');
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.8;
      ell(ctx, 0, -r * 0.68, r * 0.78, r * 0.70);
      ctx.stroke();

      // Canadian Red-and-Black Plaid Lumberjack Trapper Hat (with earflaps!)
      const flapLift = shocked ? -0.65 : (cursorNear ? -0.25 : 0.1);
      const hatJump = shocked ? 6 : 0;
      ctx.save();
      ctx.translate(0, -r * 1.18 - hatJump);
      // Earflaps on left and right
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(dir * 13, 2);
        ctx.rotate(dir * flapLift);
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.3;
        ell(ctx, 0, 6, 3.8, 6.5);
        ctx.stroke();
        ctx.restore();
      }
      // Plaid dome & sherpa fur front cuff
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 2, 14, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Black buffalo-plaid check stripes
      ctx.fillStyle = 'rgba(17, 24, 39, 0.55)';
      ctx.fillRect(-9, -8, 4, 9);
      ctx.fillRect(3, -8, 4, 9);
      // Warm cream sherpa front visor
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.roundRect(-12, -3.5, 24, 6.5, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Face
      if (shocked) {
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-7, -r * 0.78); ctx.lineTo(-3, -r * 0.68); ctx.lineTo(-7, -r * 0.58);
        ctx.moveTo(7, -r * 0.78);  ctx.lineTo(3, -r * 0.68);  ctx.lineTo(7, -r * 0.58);
        ctx.stroke();
        ctx.fillStyle = '#451a03'; circ(ctx, 0, -r * 0.42, 3.6);
      } else {
        for (const ex of [-5.2, 5.2]) {
          ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.70, 3.3);
          ctx.fillStyle = '#1e293b'; circ(ctx, ex + px * 0.5, -r * 0.70 + py * 0.5, 1.5);
        }
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -r * 0.46, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
      return true;
    }

    /* ----------------------------------------------------------------------
       2. PEI RED-CLAY RUSSET (`pei_russet`, r: 30)
          Terracotta Maritime potato dusted in red soil + Fisherman's Sou'wester Hat!
       ---------------------------------------------------------------------- */
    if (type === 'pei_russet') {
      ctx.fillStyle = radial(ctx, -8, -r * 0.85, 3, 0, -r * 0.55, r * 1.1, '#f59e0b', '#9a3412');
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.82, -r * 0.32);
      ctx.bezierCurveTo(-r * 0.92, -r * 0.88, -r * 0.48, -r * 1.18, 0, -r * 1.16);
      ctx.bezierCurveTo(r * 0.48, -r * 1.18, r * 0.92, -r * 0.88, r * 0.82, -r * 0.32);
      ctx.bezierCurveTo(r * 0.75, r * 0.06, -r * 0.75, r * 0.06, -r * 0.82, -r * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Red iron-clay speckles
      ctx.fillStyle = 'rgba(124, 45, 18, 0.38)';
      for (const [dx, dy] of [[-14, -12], [15, -14], [-10, -24], [12, -22]]) circ(ctx, dx, dy, 2.1);

      // Eyes & sturdy Maritime pipe/smile
      for (const ex of [-7.5, 7.5]) {
        ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.65, shocked ? 4.2 : 3.4);
        ctx.fillStyle = '#0f172a'; circ(ctx, ex + px * 0.5, -r * 0.65 + py * 0.5, 1.6);
      }
      ctx.fillStyle = '#fef3c7';
      ell(ctx, -4.5, -r * 0.38, 5, 2.2, -0.2);
      ell(ctx, 4.5, -r * 0.38, 5, 2.2, 0.2);

      // Yellow Maritime Fisherman's Sou'wester Rain Hat
      const hatTilt = shocked ? -0.32 : (breeze * 0.8);
      ctx.save();
      ctx.translate(0, -r * 1.08 - (shocked ? 8 : 0));
      ctx.rotate(hatTilt);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-22, 3);
      ctx.quadraticCurveTo(0, -5, 24, 5); // Wide rear rain-gutter brim
      ctx.quadraticCurveTo(14, -15, 0, -16);
      ctx.quadraticCurveTo(-14, -15, -22, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return true;
    }

    /* ----------------------------------------------------------------------
       3. BRAZILIAN PÉROLA PINEAPPLE (`abacaxi`, r: 29)
          Diamond-quilted golden pineapple, spiky crown & Carnival Samba Shades!
       ---------------------------------------------------------------------- */
    if (type === 'abacaxi') {
      const samba = Math.sin(tNow * 9.5 + c.wob) * (shocked ? 3.5 : 1.8);
      ctx.save();
      ctx.translate(samba * 0.5, 0);

      // Spiky tropical leaf crown on top (shoots up when smacked!)
      const crownJump = shocked ? 9 : 0;
      for (let i = -3; i <= 3; i++) {
        ctx.save();
        ctx.translate(i * 2.5, -r * 1.25 - crownJump);
        ctx.rotate(i * 0.24 + leafLag);
        ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#047857';
        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-3.5, 2);
        ctx.quadraticCurveTo(0, -18 + Math.abs(i) * 2.2, 0, -22 + Math.abs(i) * 2.5);
        ctx.quadraticCurveTo(3.5, -10, 3.5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Golden-amber pineapple body with diamond cross-hatching
      ctx.fillStyle = radial(ctx, -6, -r * 0.85, 2, 0, -r * 0.65, r * 1.1, '#fef08a', '#d97706');
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.0;
      ell(ctx, 0, -r * 0.68, r * 0.74, r * 0.78);
      ctx.stroke();

      // Diamond quilt lines
      ctx.strokeStyle = 'rgba(146, 64, 14, 0.38)';
      ctx.lineWidth = 1.2;
      for (let d = -12; d <= 12; d += 8) {
        ctx.beginPath();
        ctx.moveTo(d - 8, -r * 1.15); ctx.lineTo(d + 10, -r * 0.22);
        ctx.moveTo(d + 8, -r * 1.15); ctx.lineTo(d - 10, -r * 0.22);
        ctx.stroke();
      }

      // Star-shaped / Carnival Tropical Shades + Big Grin!
      const shadeY = -r * 0.78 + (shocked ? 5 : 0);
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      for (const lx of [-6.8, 6.8]) {
        ctx.beginPath();
        ctx.roundRect(lx - 5.5, shadeY - 3.5, 11, 7, 3);
        ctx.fill();
        ctx.stroke();
      }
      // Joyful samba grin (or shocked O mouth)
      ctx.fillStyle = '#451a03';
      if (shocked) {
        circ(ctx, 0, -r * 0.40, 4.2);
      } else {
        ctx.beginPath();
        ctx.arc(0, -r * 0.45, 5.5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, -r * 0.45, 8, 2.2);
      }
      ctx.restore();
      return true;
    }

    /* ----------------------------------------------------------------------
       4. AMAZONIAN CASSAVA / MANIOC (`mandioca`, r: 26)
          Woody-barked root, 5-fingered palmate canopy & straw sun hat!
       ---------------------------------------------------------------------- */
    if (type === 'mandioca') {
      // 5-fingered palmate cassava leaves
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(0, -r * 1.32);
        ctx.rotate(i * 0.36 + leafLag);
        ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
        ell(ctx, 0, -11, 3.2, 11);
        ctx.restore();
      }

      // Woody brown cassava root body
      ctx.fillStyle = radial(ctx, -5, -r * 0.8, 2, 0, -r * 0.6, r, '#d6b37c', '#78350f');
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.9;
      ell(ctx, 0, -r * 0.64, r * 0.68, r * 0.72);
      ctx.stroke();

      // When smacked, cracks open a chalk-white starchy patch!
      if (shocked) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6, -r * 0.45, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Woven Straw Sun Hat
      ctx.save();
      ctx.translate(0, -r * 1.18 - (shocked ? 7 : 0));
      ctx.fillStyle = '#fde68a';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.4;
      ell(ctx, 0, 0, 18, 4.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -1, 9.5, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(-9.2, -3, 18.4, 2.4);
      ctx.restore();

      for (const ex of [-5.2, 5.2]) {
        ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.70, 3.2);
        ctx.fillStyle = '#1c1917'; circ(ctx, ex + px * 0.5, -r * 0.70 + py * 0.5, 1.5);
      }
      ctx.strokeStyle = '#fffbeb'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -r * 0.44, 3.4, shocked ? 0 : 0.15 * Math.PI, shocked ? Math.PI * 2 : 0.85 * Math.PI);
      ctx.stroke();
      return true;
    }

    /* ----------------------------------------------------------------------
       5. FRENCH PROVENCE LAVANDIN (`lavender`, r: 23)
          Fragrant tied sheaf of purple flower spikes with burlap & tricolore bow!
       ---------------------------------------------------------------------- */
    if (type === 'lavender') {
      // Fragrant purple flower spikes fanning upward
      for (let i = -3; i <= 3; i++) {
        ctx.save();
        ctx.translate(i * 2.6, -r * 0.75);
        ctx.rotate(i * 0.14 + leafLag * 1.1);
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -22); ctx.stroke();
        // Tiered purple florets along each spike
        for (let fy = -8; fy >= -22; fy -= 4.2) {
          ctx.fillStyle = (i + fy) % 2 === 0 ? '#a855f7' : '#7e22ce';
          ell(ctx, -2.2, fy, 2.4, 1.8, -0.3);
          ell(ctx, 2.2, fy, 2.4, 1.8, 0.3);
          ctx.fillStyle = '#e9d5ff';
          circ(ctx, 0, fy - 1, 1.5);
        }
        ctx.restore();
      }

      // Burlap sack base cinched at the waist with a French ribbon bow
      ctx.fillStyle = radial(ctx, -4, -r * 0.55, 2, 0, -r * 0.45, r * 0.8, '#fde68a', '#b45309');
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.roundRect(-r * 0.62, -r * 0.78, r * 1.24, r * 0.78, [4, 4, 10, 10]);
      ctx.fill();
      ctx.stroke();

      // French Tricolore / Crimson Ribbon Bow at waist
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-r * 0.62, -r * 0.74, r * 1.24, 4.2);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-r * 0.62, -r * 0.74, r * 0.42, 4.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.20, -r * 0.74, r * 0.40, 4.2);

      // Expressive Eyes on the burlap wrap
      for (const ex of [-4.8, 4.8]) {
        ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.44, shocked ? 3.6 : 2.9);
        ctx.fillStyle = '#1e1b4b'; circ(ctx, ex + px * 0.4, -r * 0.44 + py * 0.4, 1.4);
      }
      ctx.strokeStyle = '#451a03'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (shocked) ctx.arc(0, -r * 0.22, 2.8, 0, Math.PI * 2);
      else ctx.arc(0, -r * 0.26, 2.8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      return true;
    }

    /* ----------------------------------------------------------------------
       6. JAPANESE SUMO WHITE DAIKON (`daikon`, r: 27)
          Gleaming ivory-white giant radish with lush green top & Hachimaki headband!
       ---------------------------------------------------------------------- */
    if (type === 'daikon') {
      // Lush green daikon leaf crown
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 2.4, -r * 1.38);
        ctx.rotate(i * 0.28 + leafLag);
        ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1.2;
        ell(ctx, 0, -12, 4.8, 13);
        ctx.stroke();
        ctx.restore();
      }

      // Gleaming ivory-white plump daikon body with pale green neck
      const dGrad = ctx.createLinearGradient(0, -r * 1.45, 0, 4);
      dGrad.addColorStop(0, '#bbf7d0');
      dGrad.addColorStop(0.28, '#ffffff');
      dGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = dGrad;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, -r * 1.12);
      ctx.bezierCurveTo(-r * 0.76, -r * 1.52, r * 0.76, -r * 1.52, r * 0.72, -r * 1.12);
      ctx.bezierCurveTo(r * 0.80, -r * 0.45, r * 0.55, 2, 0, 3);
      ctx.bezierCurveTo(-r * 0.55, 2, -r * 0.80, -r * 0.45, -r * 0.72, -r * 1.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Twisted Red-and-White Hachimaki Sumo Headband + whipping tails!
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-r * 0.73, -r * 1.18, r * 1.46, 5.5, 2.5);
      ctx.fill();
      ctx.stroke();
      // Rising sun / white center knot on forehead
      ctx.fillStyle = '#ffffff';
      circ(ctx, 0, -r * 1.18 + 2.7, 3.4);
      ctx.fillStyle = '#dc2626';
      circ(ctx, 0, -r * 1.18 + 2.7, 1.8);

      // Determined Sumo Eyes & Scowl
      for (const ex of [-6.5, 6.5]) {
        ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.82, 3.6);
        ctx.fillStyle = '#0f172a'; circ(ctx, ex + px * 0.5, -r * 0.82 + py * 0.5, 1.7);
      }
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-11, -r * 0.96); ctx.lineTo(-3, -r * 0.89);
      ctx.moveTo(11, -r * 0.96);  ctx.lineTo(3, -r * 0.89);
      ctx.stroke();

      // Sumo gritted mouth
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-5.5, -r * 0.56, 11, shocked ? 5.5 : 3.5, 1.5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4.5, -r * 0.54, 9, 1.6);
      return true;
    }

    return false;
  }

  return { drawRegionalCrop };
})();


// ============================================================================
// Due by Dusk · v0.5.01 — Multi-Plane Regional Environment Renderer
// (`art/environmentRenderer.js`)
// Builds 4 unmistakably distinct regional environments (recognizable even in
// 100% grayscale with all text hidden):
//   1. 'canada' — Jagged Rockies/Shield, Tall Prairie Grain Elevator & Twin Silos,
//                 Gambrel Sugar-Shack Barn, Boreal Spruces & Split-Rail Fence.
//   2. 'brazil' — Steep Flat-Topped Chapada Mesas & Sugar-Loaf Domes, Diagonal
//                 River Delta, Arched Colonial Fazenda, Coconut Palms & Bamboo.
//   3. 'france' — Multi-Arch Roman Stone Aqueduct Bridge, Turreted Loire Château,
//                 Pencil-Thin Cypress Spires & Dry-Stone Limestone Wall.
//   4. 'japan'  — Symmetrical Snow-Crowned Mount Fuji Cone, Curved-Roof Minka
//                 Farmhouse & Kura, Vermilion Torii Gate, Tall Bamboo Stalks &
//                 Woven Kenninji-gaki Bamboo Fence.
// ============================================================================

window.DBD_ENV_RENDERER = (() => {
  'use strict';

  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }

  function mulberry(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Paint the background + midground scenery canvas for the active Country & City
  function paintSceneryCanvas(worldW, FIELD_TOP, scale, dpr, countryCode, subTheme, billsPaid, paintBarn) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(worldW * scale * dpr));
    c.height = Math.round(FIELD_TOP * scale * dpr);
    const g = c.getContext('2d');
    g.scale(scale * dpr, scale * dpr);
    const rng = mulberry(4099 + (countryCode ? countryCode.charCodeAt(0) * 137 : 0));

    // ========================================================================
    // REGION 1: CANADA (`CA`)
    // Distinct Silhouette: Jagged Peaks/Shield + Gambrel Barn (Left) + Towering
    // Vertical Wooden Grain Elevator ("POOL") & Twin Silos (Right) + Boreal Pines
    // ========================================================================
    if (countryCode === 'CA') {
      // Far Jagged Peaks / Boreal Shield Ridge
      g.fillStyle = '#94a3b8';
      g.beginPath();
      g.moveTo(-10, FIELD_TOP);
      const peaks = [[0,138],[0.14,88],[0.26,128],[0.42,82],[0.58,126],[0.76,94],[0.90,122],[1,98]];
      for (const [px, py] of peaks) g.lineTo(px * worldW, py);
      g.lineTo(worldW + 10, FIELD_TOP);
      g.closePath();
      g.fill();
      // Snow-caps on peaks
      g.fillStyle = '#f8fafc';
      for (const [px, py] of [[0.14,88],[0.42,82],[0.76,94]]) {
        g.beginPath();
        g.moveTo(px * worldW, py);
        g.lineTo(px * worldW - 28, py + 20);
        g.lineTo(px * worldW - 8, py + 15);
        g.lineTo(px * worldW + 8, py + 22);
        g.lineTo(px * worldW + 28, py + 18);
        g.closePath();
        g.fill();
      }

      // Midground rolling boreal forest hills
      g.fillStyle = '#5b8266';
      g.beginPath();
      g.moveTo(-10, FIELD_TOP);
      g.lineTo(-10, 162);
      g.quadraticCurveTo(worldW * 0.25, 138, worldW * 0.52, 164);
      g.quadraticCurveTo(worldW * 0.78, 142, worldW + 10, 158);
      g.lineTo(worldW + 10, FIELD_TOP);
      g.closePath();
      g.fill();

      // Pasture strip
      const pas = g.createLinearGradient(0, 175, 0, FIELD_TOP);
      pas.addColorStop(0, subTheme === 'prairie' ? '#d4b459' : '#7ba05b');
      pas.addColorStop(1, '#4d7c43');
      g.fillStyle = pas;
      g.fillRect(0, 184, worldW, FIELD_TOP - 184);

      // Boreal Spruce Pines & Red Sugar Maples along horizon
      for (let i = 0; i < 28; i++) {
        const tx = rng() * worldW, ty = 166 + rng() * 20, s = 12 + rng() * 12;
        if (i % 4 === 0) {
          // Red Sugar Maple
          g.fillStyle = '#5c4033'; g.fillRect(tx - 1.5, ty, 3, 10);
          g.fillStyle = '#dc2626'; circ(g, tx, ty - 4, s * 0.45);
          g.fillStyle = '#f97316'; circ(g, tx - 3, ty - 6, s * 0.32);
        } else {
          // Coniferous Spruce Triangle Silhouette
          g.fillStyle = '#1e3f35';
          for (let t = 0; t < 3; t++) {
            const w = s * (0.48 - t * 0.11), yTop = ty - t * s * 0.28;
            g.beginPath();
            g.moveTo(tx - w, yTop + 6);
            g.lineTo(tx, yTop - s * 0.38);
            g.lineTo(tx + w, yTop + 6);
            g.closePath();
            g.fill();
          }
        }
      }

      // Left Landmark: Classic Canadian Gambrel Barn & Silo
      const bs = worldW < 430 ? 0.83 : 1.05;
      paintBarn(g, Math.max(75, worldW * 0.20), 211, bs, billsPaid);

      // Right Landmark: Towering Iconic Canadian Wooden Grain Elevator ("POOL")!
      if (worldW > 400) {
        const gx = worldW * 0.74, gy = 209;
        g.save();
        g.translate(gx, gy);
        // Main tall sloped-shoulder elevator tower
        g.fillStyle = '#991b1b';
        g.strokeStyle = '#f8fafc';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(-22, 0);
        g.lineTo(-20, -58);
        g.lineTo(-13, -72);
        g.lineTo(-13, -94); // Tall cupola headhouse!
        g.lineTo(13, -94);
        g.lineTo(13, -72);
        g.lineTo(20, -58);
        g.lineTo(22, 0);
        g.closePath();
        g.fill();
        g.stroke();
        // Gable roof on cupola
        g.fillStyle = '#334155';
        g.beginPath();
        g.moveTo(-15, -94); g.lineTo(0, -105); g.lineTo(15, -94);
        g.closePath(); g.fill();
        // White banner "WHEAT POOL"
        g.fillStyle = '#fef3c7';
        g.fillRect(-16, -52, 32, 9);
        g.fillStyle = '#1e293b';
        g.font = 'bold 6px monospace';
        g.textAlign = 'center';
        g.fillText('CANADA POOL', 0, -45.5);
        g.restore();
      }

      // Split-rail cedar log fence
      const fy = FIELD_TOP - 13;
      g.strokeStyle = '#785638'; g.lineWidth = 3.2;
      for (let x = -10; x < worldW; x += 46) {
        g.beginPath();
        g.moveTo(x, fy - 14); g.lineTo(x + 46, fy - 11);
        g.moveTo(x, fy - 6);  g.lineTo(x + 46, fy - 8);
        g.stroke();
        g.fillStyle = '#5c4028';
        g.fillRect(x - 2, fy - 20, 4, 22);
      }
      return c;
    }

    // ========================================================================
    // REGION 2: BRAZIL (`BR`)
    // Distinct Silhouette: Flat-Topped Chapada Mesas & Sugar-Loaf Domes +
    // Wide Winding River Delta + Arched Colonial Fazenda + Curving Coconut Palms
    // ========================================================================
    if (countryCode === 'BR') {
      // Flat-topped Chapada Tafelberg Mesas & Sugar-Loaf Domes (unmistakable silhouette!)
      g.fillStyle = '#9a6b56';
      g.beginPath();
      g.moveTo(-10, FIELD_TOP);
      g.lineTo(-10, 145);
      // Mesa 1 (left flat-top plateau)
      g.lineTo(worldW * 0.06, 142);
      g.lineTo(worldW * 0.10, 88);
      g.lineTo(worldW * 0.28, 88);
      g.lineTo(worldW * 0.33, 142);
      // Sugar-loaf dome (center)
      g.quadraticCurveTo(worldW * 0.46, 55, worldW * 0.56, 145);
      // Mesa 2 (right flat-top plateau)
      g.lineTo(worldW * 0.68, 96);
      g.lineTo(worldW * 0.88, 96);
      g.lineTo(worldW * 0.93, 145);
      g.lineTo(worldW + 10, 142);
      g.lineTo(worldW + 10, FIELD_TOP);
      g.closePath();
      g.fill();

      // Horizontal sandstone strata lines on the Chapada mesas
      g.strokeStyle = 'rgba(254, 215, 170, 0.38)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(worldW * 0.09, 104); g.lineTo(worldW * 0.29, 104);
      g.moveTo(worldW * 0.08, 120); g.lineTo(worldW * 0.31, 120);
      g.moveTo(worldW * 0.67, 112); g.lineTo(worldW * 0.89, 112);
      g.stroke();

      // Lush Tropical Valley Midground
      const pas = g.createLinearGradient(0, 148, 0, FIELD_TOP);
      pas.addColorStop(0, '#4d9058');
      pas.addColorStop(1, '#266339');
      g.fillStyle = pas;
      g.fillRect(0, 152, worldW, FIELD_TOP - 152);

      // Wide Winding River (Rio São Francisco / Amazon) with wooden riverboat!
      g.fillStyle = '#38bdf8';
      g.beginPath();
      g.moveTo(worldW * 0.42, 152);
      g.bezierCurveTo(worldW * 0.35, 175, worldW * 0.62, 195, worldW * 0.52, FIELD_TOP);
      g.lineTo(worldW * 0.68, FIELD_TOP);
      g.bezierCurveTo(worldW * 0.76, 192, worldW * 0.45, 172, worldW * 0.50, 152);
      g.closePath();
      g.fill();

      // Curving Coconut Palms & Umbrella Araucaria Pines across horizon!
      const drawPalm = (px, py, sc, lean) => {
        g.save();
        g.translate(px, py);
        g.scale(sc, sc);
        g.strokeStyle = '#785338';
        g.lineWidth = 4.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(lean * 14, -22, lean * 22, -46);
        g.stroke();
        // 6 radiating arched palm fronds at crown
        g.translate(lean * 22, -46);
        g.strokeStyle = '#15803d';
        g.fillStyle = '#22c55e';
        g.lineWidth = 2.2;
        for (const a of [-2.4, -1.7, -0.9, -0.2, 0.4, 1.1]) {
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(Math.cos(a) * 14, Math.sin(a) * 10 - 6, Math.cos(a) * 24, Math.sin(a) * 16 + 6);
          g.stroke();
        }
        // Coconuts under crown
        g.fillStyle = '#451a03';
        circ(g, -2, 3, 2.5); circ(g, 2, 3, 2.5);
        g.restore();
      };
      drawPalm(worldW * 0.07, 208, 1.15, 1);
      drawPalm(worldW * 0.36, 202, 0.95, -1);
      drawPalm(worldW * 0.64, 204, 1.05, 1);
      drawPalm(worldW * 0.92, 208, 1.20, -1);

      // Left Landmark: Whitewashed Colonial Fazenda with Arched Veranda & Terracotta Roof!
      const fx = Math.max(85, worldW * 0.21), fyB = 210;
      g.save();
      g.translate(fx, fyB);
      g.fillStyle = '#fffbeb';
      g.strokeStyle = '#78350f';
      g.lineWidth = 1.5;
      g.fillRect(-52, -44, 104, 44);
      g.strokeRect(-52, -44, 104, 44);
      // 5 Colonial Veranda Arches along the facade!
      g.fillStyle = '#451a03';
      for (let i = -2; i <= 2; i++) {
        const ax = i * 19;
        g.beginPath();
        g.roundRect(ax - 6.5, -28, 13, 28, [8, 8, 0, 0]);
        g.fill();
      }
      // Terracotta barrel-tile hipped roof + bell gable
      g.fillStyle = '#c2410c';
      g.beginPath();
      g.moveTo(-60, -44);
      g.lineTo(-42, -68);
      g.lineTo(42, -68);
      g.lineTo(60, -44);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();

      // Bamboo & Rope Fence
      const fy = FIELD_TOP - 13;
      g.strokeStyle = '#a16207'; g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(0, fy - 13); g.lineTo(worldW, fy - 13);
      g.moveTo(0, fy - 5);  g.lineTo(worldW, fy - 5);
      g.stroke();
      for (let x = 10; x < worldW; x += 34) {
        g.fillStyle = '#ca8a04';
        g.fillRect(x - 2.5, fy - 22, 5, 24);
        g.fillStyle = '#78350f';
        g.fillRect(x - 3, fy - 14, 6, 2.5);
      }
      return c;
    }

    // ========================================================================
    // REGION 3: FRANCE (`FR`)
    // Distinct Silhouette: Multi-Arch Roman Stone Aqueduct (Left/Center) +
    // Turreted Loire Renaissance Château (Right) + Tall Pencil Cypress Spires
    // ========================================================================
    if (countryCode === 'FR') {
      // Soft rolling Provençal / Loire limestone hills
      g.fillStyle = '#a78bfa';
      g.beginPath();
      g.moveTo(-10, FIELD_TOP);
      g.lineTo(-10, 128);
      g.quadraticCurveTo(worldW * 0.25, 95, worldW * 0.52, 125);
      g.quadraticCurveTo(worldW * 0.78, 92, worldW + 10, 122);
      g.lineTo(worldW + 10, FIELD_TOP);
      g.closePath();
      g.fill();

      // Left-Center Landmark: Multi-Arch Roman Stone Aqueduct Bridge (Pont du Gard silhouette!)
      const aqW = Math.min(340, worldW * 0.44);
      g.save();
      g.translate(worldW * 0.06, 196);
      g.fillStyle = '#e2d5b5';
      g.strokeStyle = '#78684c';
      g.lineWidth = 1.4;
      // Lower tier with 5 semicircular arches
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -48);
      g.lineTo(aqW, -48);
      g.lineTo(aqW, 0);
      const archSpan = aqW / 5;
      for (let i = 4; i >= 0; i--) {
        const cx = (i + 0.5) * archSpan;
        g.lineTo(cx + archSpan * 0.34, 0);
        g.arc(cx, -18, archSpan * 0.34, 0, Math.PI, true);
        g.lineTo(cx - archSpan * 0.34, 0);
      }
      g.closePath();
      g.fill();
      g.stroke();
      // Upper tier with 10 smaller arches
      g.fillRect(0, -66, aqW, 18);
      g.strokeRect(0, -66, aqW, 18);
      g.fillStyle = '#a78bfa';
      for (let i = 0; i < 10; i++) {
        const sx = (i + 0.5) * (aqW / 10);
        g.beginPath();
        g.roundRect(sx - 6, -62, 12, 12, [6, 6, 0, 0]);
        g.fill();
      }
      g.restore();

      // Midground Lavender & Vineyard Pasture
      const pas = g.createLinearGradient(0, 168, 0, FIELD_TOP);
      pas.addColorStop(0, '#7c9a6d');
      pas.addColorStop(1, '#557548');
      g.fillStyle = pas;
      g.fillRect(0, 178, worldW, FIELD_TOP - 178);

      // Tall Pencil-Thin Mediterranean Cypress Spires (`| | |` unmistakable vertical silhouettes!)
      for (let i = 0; i < 18; i++) {
        const cx = (i + 0.5) * (worldW / 18) + (rng() - 0.5) * 12;
        const cy = 188 + (i % 3) * 6;
        const ch = 36 + (i % 4) * 9;
        g.fillStyle = i % 2 === 0 ? '#1e3a2f' : '#2d5240';
        g.beginPath();
        g.moveTo(cx - 4.5, cy);
        g.quadraticCurveTo(cx - 5.5, cy - ch * 0.5, cx, cy - ch);
        g.quadraticCurveTo(cx + 5.5, cy - ch * 0.5, cx + 4.5, cy);
        g.closePath();
        g.fill();
      }

      // Right Landmark: Turreted Loire Renaissance Stone Château!
      if (worldW > 420) {
        const chX = worldW * 0.76, chY = 208;
        g.save();
        g.translate(chX, chY);
        // Main white-tuffeau stone corps de logis
        g.fillStyle = '#fef9eb';
        g.strokeStyle = '#64748b';
        g.lineWidth = 1.4;
        g.fillRect(-38, -46, 76, 46);
        g.strokeRect(-38, -46, 76, 46);
        // Steep slate mansard roof
        g.fillStyle = '#334155';
        g.beginPath();
        g.moveTo(-40, -46); g.lineTo(-28, -74); g.lineTo(28, -74); g.lineTo(40, -46);
        g.closePath(); g.fill(); g.stroke();
        // Twin cylindrical corner turrets with tall conical slate spires!
        for (const tx of [-42, 42]) {
          g.fillStyle = '#f8f0dc';
          g.fillRect(tx - 10, -58, 20, 58);
          g.strokeRect(tx - 10, -58, 20, 58);
          g.fillStyle = '#1e293b';
          g.beginPath();
          g.moveTo(tx - 13, -58);
          g.lineTo(tx, -98); // Tall pointed spire!
          g.lineTo(tx + 13, -58);
          g.closePath();
          g.fill();
          g.stroke();
          // Gold finial
          g.strokeStyle = '#eab308';
          g.beginPath(); g.moveTo(tx, -98); g.lineTo(tx, -106); g.stroke();
        }
        // Tall arched French windows
        g.fillStyle = '#fde68a';
        for (const wx of [-22, 0, 22]) {
          g.beginPath(); g.roundRect(wx - 5, -36, 10, 22, [5, 5, 0, 0]); g.fill();
        }
        g.restore();
      }

      // Provençal Dry-Stone Limestone Wall (`Clos`)
      const fy = FIELD_TOP - 13;
      g.fillStyle = '#d6cfc2';
      g.strokeStyle = '#78716c';
      g.lineWidth = 1.5;
      g.fillRect(0, fy - 15, worldW, 16);
      g.strokeRect(0, fy - 15, worldW, 16);
      for (let x = 8; x < worldW; x += 22) {
        g.fillStyle = '#a8a29e';
        ell(g, x, fy - 7, 8, 4);
      }
      return c;
    }

    // ========================================================================
    // REGION 4: JAPAN (`JP`)
    // Distinct Silhouette: Symmetrical Snow-Crowned Mount Fuji Cone +
    // Curved-Roof Minka Farmhouse (Left) + Vermilion Torii Gate & Tall
    // Vertical Bamboo Stalk Grove (Right) + Woven Bamboo Fence
    // ========================================================================
    if (countryCode === 'JP') {
      // Iconic Symmetrical Snow-Crowned Cone of Mount Fuji dominating center horizon!
      const fujiX = worldW * 0.50;
      g.fillStyle = '#475569';
      g.beginPath();
      g.moveTo(fujiX - 240, FIELD_TOP);
      g.quadraticCurveTo(fujiX - 95, 145, fujiX - 28, 54); // Sweeping concave volcanic slope!
      g.lineTo(fujiX + 28, 54); // Flat crater rim
      g.quadraticCurveTo(fujiX + 95, 145, fujiX + 240, FIELD_TOP);
      g.closePath();
      g.fill();

      // Jagged white snow mantle crowning Mount Fuji
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(fujiX - 28, 54);
      g.lineTo(fujiX + 28, 54);
      g.quadraticCurveTo(fujiX + 54, 92, fujiX + 68, 112);
      g.lineTo(fujiX + 36, 98);
      g.lineTo(fujiX + 18, 118);
      g.lineTo(fujiX, 96);
      g.lineTo(fujiX - 18, 116);
      g.lineTo(fujiX - 38, 98);
      g.lineTo(fujiX - 68, 112);
      g.quadraticCurveTo(fujiX - 54, 92, fujiX - 28, 54);
      g.closePath();
      g.fill();

      // Stepped green tea foothills
      g.fillStyle = '#4d7c5d';
      g.beginPath();
      g.moveTo(-10, FIELD_TOP);
      g.lineTo(-10, 165);
      g.quadraticCurveTo(worldW * 0.3, 148, worldW * 0.65, 168);
      g.quadraticCurveTo(worldW * 0.85, 152, worldW + 10, 162);
      g.lineTo(worldW + 10, FIELD_TOP);
      g.closePath();
      g.fill();

      // Left Landmark: Traditional Japanese Minka Farmhouse with Curved Irimoya Roof & Shoji Doors!
      const mx = Math.max(85, worldW * 0.20), my = 210;
      g.save();
      g.translate(mx, my);
      // White plaster & dark timber walls
      g.fillStyle = '#fffbeb';
      g.strokeStyle = '#1e293b';
      g.lineWidth = 1.8;
      g.fillRect(-46, -42, 92, 42);
      g.strokeRect(-46, -42, 92, 42);
      // Glowing warm Shoji sliding lattice screens
      g.fillStyle = '#fde68a';
      g.fillRect(-34, -30, 28, 28);
      g.fillRect(6, -30, 28, 28);
      g.strokeRect(-34, -30, 28, 28);
      g.strokeRect(6, -30, 28, 28);
      // Sweeping curved Kawara tiled roof with upturned eaves!
      g.fillStyle = '#1e293b';
      g.beginPath();
      g.moveTo(-64, -38);
      g.quadraticCurveTo(-45, -44, -28, -72);
      g.lineTo(28, -72);
      g.quadraticCurveTo(45, -44, 64, -38);
      g.quadraticCurveTo(35, -34, 0, -36);
      g.quadraticCurveTo(-35, -34, -64, -38);
      g.closePath();
      g.fill();
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 1.4;
      g.stroke();
      g.restore();

      // Right Landmark: Vermilion Shinto Torii Gate & Tall Vertical Bamboo Grove!
      if (worldW > 400) {
        // Bamboo stalks grove (`takebayashi`)
        for (let b = 0; b < 14; b++) {
          const bx = worldW * 0.78 + (b - 6) * 9;
          g.strokeStyle = b % 2 === 0 ? '#15803d' : '#22c55e';
          g.lineWidth = 3.2;
          g.beginPath();
          g.moveTo(bx, 210);
          g.lineTo(bx + (b % 3 - 1) * 3, 132 - (b % 4) * 8);
          g.stroke();
        }
        // Vermilion Torii Gate
        const tx = worldW * 0.72, ty = 210;
        g.save();
        g.translate(tx, ty);
        g.fillStyle = '#dc2626';
        g.strokeStyle = '#7f1d1d';
        g.lineWidth = 1.3;
        // Two pillars
        g.fillRect(-20, -56, 5.5, 56);
        g.fillRect(14.5, -56, 5.5, 56);
        // Lower tie beam (Nuki)
        g.fillRect(-26, -42, 52, 4.5);
        // Sweeping top lintel (Kasagi) with upturned ends!
        g.beginPath();
        g.moveTo(-34, -58);
        g.quadraticCurveTo(0, -52, 34, -58);
        g.lineTo(31, -51);
        g.quadraticCurveTo(0, -47, -31, -51);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }

      // Woven Bamboo Fence (Kenninji-gaki)
      const fy = FIELD_TOP - 13;
      g.fillStyle = '#ca8a04';
      g.fillRect(0, fy - 15, worldW, 15);
      g.strokeStyle = '#713f12';
      g.lineWidth = 1.4;
      for (let x = 0; x < worldW; x += 28) {
        g.beginPath();
        g.moveTo(x, fy); g.lineTo(x, fy - 16);
        g.stroke();
      }
      return c;
    }

    return c;
  }

  // Draw Foreground Framing Elements (bottom corners of the stage) for 3-plane depth!
  function drawForegroundFraming(ctx, worldW, HW, countryCode, tNow) {
    const sway = Math.sin(tNow * 1.8) * 3;
    ctx.save();
    if (countryCode === 'CA') {
      // Foreground Pine Boughs & Red Maple Leaves in bottom corners
      ctx.fillStyle = '#143328';
      for (const side of [0, 1]) {
        const x = side === 0 ? 0 : worldW;
        const dir = side === 0 ? 1 : -1;
        for (let i = 0; i < 4; i++) {
          ell(ctx, x + dir * (18 + i * 14), HW - 8 + (i % 2) * 5, 24, 9, dir * -0.25);
        }
      }
    } else if (countryCode === 'BR') {
      // Foreground Lush Tropical Monstera & Palm Fronds framing bottom corners
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.6;
      for (const side of [0, 1]) {
        const x = side === 0 ? -10 : worldW + 10;
        const dir = side === 0 ? 1 : -1;
        for (let f = 0; f < 4; f++) {
          ctx.beginPath();
          ctx.moveTo(x, HW + 5);
          ctx.quadraticCurveTo(x + dir * (35 + f * 18), HW - 45 + f * 8 + sway, x + dir * (65 + f * 22), HW - 18 + f * 6);
          ctx.stroke();
          ell(ctx, x + dir * (38 + f * 14), HW - 18 + f * 4, 18, 7, dir * -0.35);
        }
      }
    } else if (countryCode === 'FR') {
      // Foreground Lavender Hedge Clusters & Stone Corner Pillars
      for (const side of [0, 1]) {
        const x = side === 0 ? 18 : worldW - 18;
        ctx.fillStyle = '#4c1d95';
        ell(ctx, x, HW - 4, 28, 12);
        ctx.fillStyle = '#8b5cf6';
        for (let s = -2; s <= 2; s++) {
          ell(ctx, x + s * 7 + sway * 0.3, HW - 16, 3.2, 9, s * 0.15);
        }
      }
    } else if (countryCode === 'JP') {
      // Foreground Stone Lantern Base & Overhanging Bamboo Leaves
      ctx.fillStyle = '#0f291e';
      for (const side of [0, 1]) {
        const x = side === 0 ? 0 : worldW;
        const dir = side === 0 ? 1 : -1;
        for (let b = 0; b < 5; b++) {
          ell(ctx, x + dir * (16 + b * 11) + sway * 0.4, HW - 14 + (b % 2) * 6, 16, 4.5, dir * -0.4);
        }
      }
    }
    ctx.restore();
  }

  return { paintSceneryCanvas, drawForegroundFraming };
})();




/* ================= data ================= */
const HW = 640, HORIZON = 186, FIELD_TOP = 228, PAD = 30;

// True-to-life relative scale hierarchy: Radish (16) < Carrot (19) < Golden Corn (22) < Cabbage (28) < Couch Potato (36) < King Pumpkin (44)


const UNLOCKS = {
  1: 'Cabbages ($3) and Drama-Queen Onions ($7) that cry big tear splashes.',
  2: 'Grandma Pumpkins ($9, crocheting hats & scarves) + the White Goat.',
  3: 'Runaway Radishes ($5) and Briar-Berry Twins ($13).',
  4: 'VIP Golden Corn ($18) + swooping Crow Pests you can shoo for bonus coins.',
  5: 'Couch Potatoes ($22). Heavy sleepers in nightcaps—use Charge Cleave (hold click/Space)!',
};

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function trim1(x){ return x.toFixed(1).replace(/\.0$/, ''); }
function fmt$(v){ return '$' + Math.floor(Math.max(0, v)).toLocaleString('en-US'); }
function fmtGain(v){ return v < 10 ? '+$' + (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '') : '+$' + Math.floor(v).toLocaleString('en-US'); }
function lc(s){ return s.charAt(0).toLowerCase() + s.slice(1); }
function count(arr, id){ let n = 0; for (const x of arr) if (x === id) n++; return n; }
function hex(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixc(a, b, t){ return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgba(c, a = 1){ return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mul(c, m){ return [c[0] * m[0] / 255, c[1] * m[1] / 255, c[2] * m[2] / 255]; }
function setText(el, s){ if (el.textContent !== s) el.textContent = s; }
function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function mulberry(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ================= state ================= */
const SHED_IDS = SHED.map(d => d.id), HEIR_IDS = HEIRS.map(d => d.id);
const blank = ids => { const o = {}; ids.forEach(k => o[k] = 0); return o; };
let meta = {
  grit: 0,
  diamonds: 2, // Start with 2 Diamonds so players can immediately explore the branching skill tree!
  learnedSkills: [],
  heir: blank(HEIR_IDS),
  lost: 0, owned: 0, best: 0, sound: true,
  country: 'CA',
  cityId: 'ca_toronto',
  cityRecords: {},
  cityOwned: {}
};
let farm = null;
let dayCheckpoint = null;

function newFarm(){
  return { no: meta.lost + meta.owned + 1, day:1, cash: ALMANAC[meta.heir.almanac] || 0, shed: blank(SHED_IDS), perks: [],
    bill:0, due: BILLS[0].days, paidTotal:0, billsPaid:0, lastEarn:0, lastCount:0, played:false, earned:0, harvested:0, pendingPerks:null, lastBest:0, lastBonus:0, bestChain:0 };
}

function hasSkill(id){ return Array.isArray(meta.learnedSkills) && meta.learnedSkills.includes(id); }
function skillPrereqsMet(node){
  if (!node.reqs || !node.reqs.length) return true;
  if (node.reqMode === 'any') return node.reqs.some(r => hasSkill(r));
  return node.reqs.every(r => hasSkill(r));
}
function curCountry(){ return GEO.countries[meta.country] || GEO.countries.CA; }
function curCity(){
  const c = curCountry();
  return c.cities.find(ct => ct.id === meta.cityId) || c.cities[0];
}
function curBiome(){
  const c = curCountry(), ct = curCity();
  return {
    id: c.code,
    countryCode: c.code,
    countryName: c.name,
    city: ct.name,
    name: ct.province,
    short: `${c.flag} ${ct.name}`,
    mul: ct.mul,
    rival: ct.rival,
    record: ct.record,
    buff: ct.buff,
    subTheme: ct.subTheme,
    crops: ct.crops,
    soilA: c.code === 'BR' ? '#7c3f2c' : (c.code === 'FR' ? '#85684e' : (c.code === 'JP' ? '#524742' : '#78553a')),
    soilB: c.code === 'BR' ? '#632f20' : (c.code === 'FR' ? '#6e543d' : (c.code === 'JP' ? '#3f3632' : '#63432b')),
    soilC: c.code === 'BR' ? '#421d13' : (c.code === 'FR' ? '#4a3728' : (c.code === 'JP' ? '#292320' : '#452d1c'))
  };
}
function ownsCity(cityId){ return !!(meta.cityOwned && meta.cityOwned[cityId]); }
function ownedCityCount(){ return meta.cityOwned ? Object.values(meta.cityOwned).filter(Boolean).length : 0; }

function stats(shed){ return calculateStats(shed || farm.shed, meta.heir, farm.perks, meta.learnedSkills, ownedCityCount()); }
function statsWith(id){ const sh = Object.assign({}, farm.shed); sh[id] += 1; return stats(sh); }
function shedCost(def, lvl){ return upgradeCost(def, lvl, .05 * meta.heir.cousin); }
function heirCost(def, lvl){ return upgradeCost(def, lvl); }
function hpMul(){ return cropHealthMultiplier(farm.day, farm.billsPaid); }
function billObj(idx){
  const raw = BILLS[clamp(idx, 0, BILLS.length - 1)];
  const m = curBiome().mul * (hasSkill('gold_lawyer') ? 0.88 : 1.0);
  return { name: raw.name, days: raw.days, note: raw.note, amt: Math.max(10, Math.round(raw.amt * m)) };
}
function billStatus(){ const left = farm.due - (farm.day - 1); return { left, tonight: left <= 0, b: billObj(farm.bill) }; }
function gritFor(f){ return calculateGrit(f); }

/* save */
function save(){
  const savedFarm = dayCheckpoint && mode === 'day' ? dayCheckpoint : farm;
  SaveSystem.save(meta, savedFarm);
}
function loadSavedState(){
  return SaveSystem.loadOrMigrate();
}

function escapeHtml(value){ return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function openSaveTransferModal(statusMsg = ''){
  if (mode === 'day') setPaused(true);
  const exportedJson = SaveSystem.exportSaveJson(meta, farm);
  const report = SaveSystem.getLastMigrationReport();
  const hasBackup = !!SaveSystem.getBackupJson();
  const reportHtml = report
    ? `<div class="migration-box">
        <strong>✓ Save Schema v${report.toVersion} Active</strong> (Migrated from v${report.fromVersion} · Backup Key: <code>${report.backupKey}</code>)<br>
        ${report.notes.map(note => String(note).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))).join(' · ')}
      </div>`
    : '';
  const statusBanner = statusMsg
    ? `<div class="migration-box" style="background:#fef9c3;border-color:#facc15;color:#854d0e;margin-bottom:10px"><strong>${escapeHtml(statusMsg)}</strong></div>`
    : '';

  lastFocus = document.activeElement;
  el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">YOUR PROGRESS</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 6px">Back up or restore your farm</h3>
      </div>
      <button class="chipbtn" type="button" data-close>Close</button>
    </div>
    ${statusBanner}
    <p style="margin:0 0 8px;font-size:12.5px;color:#475569">
      Export a copy of your progress for safekeeping or to move to another device. Import a save file to restore it. Older game saves are upgraded automatically.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:10px">
      <div>
        <label style="display:block;font-family:var(--font-type);font-size:11px;font-weight:700;margin-bottom:4px">CURRENT SAVE JSON (SCHEMA v2)</label>
        <textarea id="exportSaveBox" class="save-textarea" readonly>${escapeHtml(exportedJson)}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn" type="button" data-save-act="download" style="font-size:16px;padding:8px 14px">⬇ Download Save (.json)</button>
          <button class="chipbtn" type="button" data-save-act="copy">📋 Copy JSON</button>
          ${hasBackup ? `<button class="chipbtn" type="button" data-save-act="backup">🛡 Download Pre-Migration Backup</button>` : ''}
        </div>
      </div>
      <div>
        <label style="display:block;font-family:var(--font-type);font-size:11px;font-weight:700;margin-bottom:4px">IMPORT SAVE JSON (PASTE OR UPLOAD FILE)</label>
        <textarea id="importSaveBox" class="save-textarea" placeholder='Paste {"meta": ..., "farm": ...} JSON here...'></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
          <button class="btn money" type="button" data-save-act="import" style="font-size:16px;padding:8px 14px">⬆ Import &amp; Migrate Save</button>
          <label class="chipbtn" style="cursor:pointer;display:inline-flex;align-items:center">
            📂 Choose .json File
            <input type="file" id="importSaveFile" accept=".json,application/json" style="display:none">
          </label>
        </div>
      </div>
    </div>
    ${reportHtml}
  </div>`;
  el.modal.hidden = false; renderCard();

  const fileInput = document.getElementById('importSaveFile') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.onchange = () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const box = document.getElementById('importSaveBox') as HTMLTextAreaElement | null;
        if (box && typeof reader.result === 'string') {
          box.value = reader.result;
        }
      };
      reader.readAsText(file);
    };
  }
}

/* ================= sound ================= */
const Sound = {
  ctx:null, out:null, on:true, lastHit:0,
  init(){
    if (this.ctx || !this.on) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = 0.32; this.out.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
  },
  ok(){ if (!this.on) return false; if (!this.ctx) this.init(); if (!this.ctx) return false; if (this.ctx.state === 'suspended') this.ctx.resume(); return true; },
  tone(f, d, o = {}){
    const c = this.ctx, t = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.v || 0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(this.out); osc.start(t); osc.stop(t + d + 0.03);
  },
  noise(d, o = {}){
    const c = this.ctx, t = c.currentTime + (o.at || 0), len = Math.max(1, Math.floor(c.sampleRate * d)), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; fl.type = o.type || 'bandpass'; fl.frequency.value = o.f || 1500; fl.Q.value = o.q || 0.8; g.gain.value = o.v || 0.2;
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t);
  },
  hit(crit){ if (!this.ok()) return; const n = performance.now(); if (n - this.lastHit < 55) return; this.lastHit = n; this.noise(0.05, { v: crit ? 0.4 : 0.15, f: crit ? 900 : 2600, q: 1.1 }); if (crit) this.tone(150, 0.13, { type:'triangle', v:0.25, to:70 }); },
  pop(n){ if (!this.ok()) return; const f = 380 * Math.pow(1.03, Math.min(n, 30)); this.tone(f, 0.09, { v:0.2, to: f * 1.7 }); },
  coin(){ if (!this.ok()) return; this.tone(1568, 0.1, { type:'square', v:0.05 }); this.tone(2093, 0.24, { type:'square', v:0.045, at:0.07 }); },
  baah(v = 1){
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(340, t); o.frequency.linearRampToValueAtTime(285, t + 0.5);
    l.frequency.value = 23; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency);
    fl.type = 'bandpass'; fl.frequency.value = 1150; fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24 * v, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(fl); fl.connect(g); g.connect(this.out); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6);
  },
  tick(){ if (!this.ok()) return; this.tone(1200, 0.04, { type:'square', v:0.035 }); },
  dawn(){ if (!this.ok()) return; [392, 523, 659].forEach((f, i) => this.tone(f, 0.32, { type:'triangle', v:0.09, at:i * 0.08 })); },
  sunset(){ if (!this.ok()) return; [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.5, { type:'triangle', v:0.1, at:i * 0.12 })); },
  stamp(){ if (!this.ok()) return; this.noise(0.12, { v:0.5, f:320, q:0.7, type:'lowpass' }); this.tone(95, 0.16, { v:0.35, to:50 }); this.tone(1318, 0.1, { type:'square', v:0.045, at:0.13 }); this.tone(1760, 0.26, { type:'square', v:0.045, at:0.21 }); },
  sad(){ if (!this.ok()) return; [392, 370, 349, 330].forEach((f, i) => this.tone(f, i === 3 ? 0.95 : 0.34, { type:'sawtooth', v:0.07, at:i * 0.38, to: i === 3 ? 290 : null })); },
  fanfare(){ if (!this.ok()) return; [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type:'triangle', v:0.13, at:i * 0.12 })); this.tone(1047, 0.9, { type:'triangle', v:0.11, at:0.5 }); },
  click(){ if (!this.ok()) return; this.tone(660, 0.05, { type:'square', v:0.035 }); },
};

/* ================= canvas & scene ================= */
const canvas = $('#field'), ctx = canvas.getContext('2d'), stage = $('#stage');
const playerSettings = loadSettings();
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = playerSettings.reducedEffects || motionPreference.matches;
motionPreference.addEventListener('change', () => { reduceMotion = playerSettings.reducedEffects || motionPreference.matches; });
setHapticsEnabled(playerSettings.haptics);
let worldW = 0, scale = 1, dpr = 1, cssW = 0, cssH = 0;
let fieldLayer = null, hills = null;
const stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random() * 0.85, r: Math.random() * 1.3 + 0.4, tw: Math.random() * 6.3 }));

const SKY = [
  [0.00, '#8ebbd0', '#ffe2af'],
  [0.30, '#66aaca', '#d9f0dc'],
  [0.70, '#7e9abf', '#ffe1ab'],
  [0.90, '#716f9f', '#f9b27e'],
  [1.00, '#505d8a', '#d28c91'],
  [1.30, '#182c4c', '#52628c'],
].map(s => [s[0], hex(s[1]), hex(s[2])]);
function skyAt(p){
  if (p <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++){ if (p <= SKY[i][0]){ const a = SKY[i - 1], b = SKY[i], t = (p - a[0]) / (b[0] - a[0]); return [mixc(a[1], b[1], t), mixc(a[2], b[2], t)]; } }
  const l = SKY[SKY.length - 1]; return [l[1], l[2]];
}
const WHITE = [255, 255, 255], WARM = hex('#ffe4bf'), NIGHT = hex('#b8c7e6');
function lightMul(p){ const warm = smooth(0.6, 1.0, p) * 0.75, night = smooth(1.0, 1.3, p); return mixc(mixc(WHITE, WARM, warm), NIGHT, night); }

function ell(g, x, y, rx, ry, rot){ g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }
function circ(g, x, y, r){ g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function radial(g, x0, y0, r0, x1, y1, r1, a, b){ const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }

const SPRITES = { carrot: true };
function buildSprites(){ SPRITES.carrot = true; }

let sceneryLayer = null, sceneryKey = '';
function buildHills(){
  hills = {
    far:[[0,154],[.18,112],[.39,144],[.62,105],[.84,136],[1,112]],
    near:[[0,192],[.2,165],[.43,182],[.66,151],[.86,176],[1,159]],
  }; sceneryKey='';
}
function canopy(g,x,y,s,col,bright){
  g.fillStyle='#69533b';g.fillRect(x-s*.075,y-s*.1,s*.15,s*.72);
  g.strokeStyle='#69533b';g.lineWidth=s*.065;g.beginPath();g.moveTo(x,y+s*.3);g.lineTo(x-s*.3,y-s*.12);g.moveTo(x,y+s*.21);g.lineTo(x+s*.32,y-s*.2);g.stroke();
  [[-.39,.02,.38],[-.2,-.3,.43],[.2,-.37,.42],[.44,-.05,.35],[0,.03,.48]].forEach(([dx,dy,r])=>{
    g.fillStyle=radial(g,x+(dx-.15)*s,y+(dy-.2)*s,1,x+dx*s,y+dy*s,r*s,bright,col);circ(g,x+dx*s,y+dy*s,r*s);
  });
  g.fillStyle='rgba(229,238,149,.18)';ell(g,x-s*.2,y-s*.34,s*.18,s*.08,-.3);
}
function paintBarn(g,x,y,s,repair){
  g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(43,65,39,.22)';ell(g,12,3,75,11);
  const silo=g.createLinearGradient(38,0,69,0);silo.addColorStop(0,'#8b9e9a');silo.addColorStop(.4,'#d4d7c0');silo.addColorStop(1,'#778e8d');g.fillStyle=silo;g.fillRect(39,-76,28,76);ell(g,53,-75,14,8);
  g.strokeStyle='#778e87';g.lineWidth=1;for(let yy=-66;yy<-3;yy+=11){g.beginPath();g.moveTo(40,yy);g.quadraticCurveTo(53,yy+4,67,yy);g.stroke();}g.strokeStyle='#e6e1c5';g.lineWidth=1.2;g.beginPath();g.moveTo(60,-67);g.lineTo(60,-2);g.moveTo(64,-67);g.lineTo(64,-2);g.stroke();for(let yy=-64;yy<0;yy+=6){g.beginPath();g.moveTo(60,yy);g.lineTo(64,yy);g.stroke();}
  g.fillStyle='#883c32';g.beginPath();g.moveTo(-43,-48);g.lineTo(20,-48);g.lineTo(38,-34);g.lineTo(38,0);g.lineTo(-43,0);g.closePath();g.fill();
  g.fillStyle='#b44e3a';g.fillRect(-43,-45,64,45);
  g.fillStyle='#cb6548';g.beginPath();g.moveTo(-43,-45);g.lineTo(-43,-54);g.lineTo(-31,-73);g.lineTo(-11,-85);g.lineTo(9,-73);g.lineTo(21,-54);g.lineTo(21,-45);g.fill();
  g.strokeStyle='rgba(100,41,30,.45)';g.lineWidth=1;for(let xx=-39;xx<22;xx+=6){g.beginPath();g.moveTo(xx,-45);g.lineTo(xx,0);g.stroke();}
  g.fillStyle=repair>=5?'#4b5550':'#575248';g.beginPath();g.moveTo(-47,-54);g.lineTo(-33,-77);g.lineTo(-11,-90);g.lineTo(14,-76);g.lineTo(41,-54);g.lineTo(23,-50);g.lineTo(8,-70);g.lineTo(-11,-81);g.lineTo(-29,-70);g.lineTo(-41,-50);g.closePath();g.fill();
  g.strokeStyle='#ebdabb';g.lineWidth=2.2;g.beginPath();g.moveTo(-45,-52);g.lineTo(-31,-74);g.lineTo(-11,-86);g.lineTo(11,-74);g.lineTo(24,-52);g.stroke();g.strokeRect(-41,-47,60,46);
  g.fillStyle='#67382f';g.fillRect(-31,-37,39,37);g.strokeStyle='#f0dfbd';g.lineWidth=2.5;g.strokeRect(-31,-37,39,37);g.beginPath();g.moveTo(-11,-37);g.lineTo(-11,0);g.moveTo(-31,-36);g.lineTo(7,-1);g.moveTo(7,-36);g.lineTo(-31,-1);g.stroke();
  g.fillStyle='#f6d389';g.fillRect(-17,-66,12,10);g.strokeStyle='#efe3c1';g.lineWidth=1.5;g.strokeRect(-17,-66,12,10);g.beginPath();g.moveTo(-11,-66);g.lineTo(-11,-56);g.stroke();
  g.fillStyle='#ecd2a0';g.fillRect(-27,-45,31,6);g.fillStyle='#755b3d';g.font='bold 4.5px Georgia';g.textAlign='center';g.fillText('DUSK ACRES',-11.5,-40.4);
  if(repair<5){g.fillStyle='#8b765b';g.beginPath();g.moveTo(7,-73);g.lineTo(12,-68);g.lineTo(17,-71);g.lineTo(14,-76);g.fill();}
  if(repair>=1){g.fillStyle='#d4aa59';g.fillRect(27,-14,24,14);ell(g,39,-14,12,4);g.strokeStyle='#9e7940';g.lineWidth=1;for(let yy=-11;yy<-1;yy+=3){g.beginPath();g.moveTo(28,yy);g.lineTo(50,yy);g.stroke();}}
  g.restore();
}
function ensureScenery(){
  const bm = curBiome();
  const phaserScene = (window as any).__PHASER_FARM_SCENE;
  const fgTex = phaserScene && phaserScene.textures ? phaserScene.textures.get(`env_${bm.countryCode}_fg`) : null;
  const fullTex = phaserScene && phaserScene.textures ? phaserScene.textures.get(`env_${bm.countryCode}`) : null;
  const hasTex = !!(fgTex && fgTex.getSourceImage() && fgTex.getSourceImage().width > 0);
  const key = [Math.round(worldW), Math.round(scale * dpr * 100), farm.billsPaid, bm.countryCode, bm.subTheme, hasTex ? 'tex' : 'proc'].join(':');
  if (sceneryKey === key && sceneryLayer) return;
  sceneryKey = key;
  if (hasTex) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(worldW * scale * dpr));
    c.height = Math.round(FIELD_TOP * scale * dpr);
    const g = c.getContext('2d')!;
    g.scale(scale * dpr, scale * dpr);
    // Draw subtle sky-blended base from full panorama at 35% opacity so mountain ridges blend seamlessly with dynamic sky, then 100% opaque sky-keyed midground illustration on top!
    if (fullTex && fullTex.getSourceImage()) {
      g.save();
      g.globalAlpha = 0.32;
      g.drawImage(fullTex.getSourceImage(), 0, 0, worldW, FIELD_TOP);
      g.restore();
    }
    g.drawImage(fgTex.getSourceImage(), 0, 0, worldW, FIELD_TOP);
    sceneryLayer = c;
    return;
  }
  sceneryLayer = (window as any).DBD_ENV_RENDERER.paintSceneryCanvas(
    worldW, FIELD_TOP, scale, dpr, bm.countryCode, bm.subTheme, farm.billsPaid, paintBarn
  );
}
function buildFieldLayer(){
  const top=FIELD_TOP-14,h=HW-top,c=document.createElement('canvas');c.width=Math.max(1,Math.round(worldW*scale*dpr));c.height=Math.max(1,Math.round(h*scale*dpr));const g=c.getContext('2d');g.scale(scale*dpr,scale*dpr);g.translate(0,-top);
  const bm = curBiome();
  const ground=g.createLinearGradient(0,top,0,HW);ground.addColorStop(0,bm.soilA);ground.addColorStop(.35,bm.soilB);ground.addColorStop(1,bm.soilC);g.fillStyle=ground;g.fillRect(0,top,worldW,h);
  const n=10;for(let i=0;i<n;i++){
    const t=i/n,y=FIELD_TOP+10+(HW-FIELD_TOP)*Math.pow(t,1.3),th=5+18*t,sag=3+t*8;
    const ridge=g.createLinearGradient(0,y-th*.5,0,y+th*1.3);
    if (bm.countryCode === 'BR') {
      // World 2: Shimmering Cranberry Bog water channels between peat rows!
      ridge.addColorStop(0,'rgba(56, 189, 248, 0.28)');
      ridge.addColorStop(0.45,'rgba(20, 184, 166, 0.22)');
      ridge.addColorStop(1,'rgba(15, 23, 42, 0.42)');
    } else if (bm.countryCode === 'CA') {
      // World 3: Frosted Snow-Rim Alpine Terraces!
      ridge.addColorStop(0,'rgba(241, 245, 249, 0.38)');
      ridge.addColorStop(0.4,'rgba(148, 163, 184, 0.18)');
      ridge.addColorStop(1,'rgba(30, 41, 59, 0.38)');
    } else if (bm.countryCode === 'FR') {
      // World 4: Grumble's Manor Manicured Velvet & Gold-Trimmed Rows!
      ridge.addColorStop(0,'rgba(250, 204, 21, 0.22)');
      ridge.addColorStop(0.4,'rgba(168, 85, 247, 0.14)');
      ridge.addColorStop(1,'rgba(30, 27, 75, 0.40)');
    } else {
      ridge.addColorStop(0,'rgba(237,184,115,.29)');
      ridge.addColorStop(.35,'rgba(206,146,88,.13)');
      ridge.addColorStop(.55,'rgba(74,39,21,.1)');
      ridge.addColorStop(1,'rgba(40,24,18,.38)');
    }
    g.fillStyle=ridge;
    g.beginPath();g.moveTo(0,y-th*.6);g.bezierCurveTo(worldW*.3,y-th*.5+sag,worldW*.7,y-th*.6+sag,worldW,y-th*.6);g.lineTo(worldW,y+th*1.2);g.bezierCurveTo(worldW*.7,y+th*1.2+sag,worldW*.3,y+th*1.1+sag,0,y+th*1.2);g.closePath();g.fill();
    g.strokeStyle=bm.countryCode==='CA'?'rgba(255,255,255,.28)':(bm.countryCode==='BR'?'rgba(125,211,252,.22)':'rgba(237,188,127,.14)');
    g.lineWidth=.8+t*.5;g.beginPath();g.moveTo(0,y-th*.6);g.quadraticCurveTo(worldW/2,y-th*.6+sag*1.7,worldW,y-th*.6);g.stroke();
  }
  const r=mulberry(701);for(let i=0;i<Math.min(2400,worldW*2.4);i++){
    const x=r()*worldW,y=top+r()*h,d=(y-top)/h,z=.35+r()*1.8*(.5+d);g.fillStyle=i%3===0?'rgba(243,200,139,.14)':'rgba(48,26,16,.15)';ell(g,x,y,z,z*.45,r()*.5);
  }
  for(let i=0;i<Math.min(70,worldW/10);i++){const x=r()*worldW,y=top+12+r()*(h-25),z=.6+r()*1.4;g.fillStyle='#73593e';ell(g,x,y,z*1.6,z);g.fillStyle='rgba(213,176,119,.35)';ell(g,x-.3,y-.4,z*.8,z*.4);}
  const grass=(x,y,sz)=>{g.strokeStyle=r()<.5?'#688b42':'#9aaa58';g.lineWidth=1.2;for(let k=0;k<3;k++){g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+(k-1)*sz*.6,y-sz*.55,x+(k-1)*sz,y-sz);g.stroke();}};
  for(let x=0;x<worldW;x+=4+r()*7)grass(x,top+5+r()*4,4+r()*7);
  for(let y=top+12;y<HW;y+=12+r()*20){grass(3+r()*5,y,5+r()*8);grass(worldW-3-r()*5,y,5+r()*8);}
  for(let x=0;x<worldW;x+=7+r()*10){grass(x,HW+2+r()*5,5+r()*10);if(r()<.18){g.fillStyle=r()<.5?'#f6d68e':'#e9d8b4';circ(g,x,HW-5-r()*5,1.6);}}
  const vig=g.createLinearGradient(0,0,worldW,0);vig.addColorStop(0,'rgba(36,39,22,.25)');vig.addColorStop(.1,'rgba(36,39,22,0)');vig.addColorStop(.9,'rgba(36,39,22,0)');vig.addColorStop(1,'rgba(36,39,22,.25)');g.fillStyle=vig;g.fillRect(0,top,worldW,h);
  fieldLayer=c;
}
function resize(){
  const rect = stage.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const oldW = worldW;
  cssW = rect.width; cssH = rect.height; dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  scale = cssH / HW; worldW = cssW / scale;
  if (oldW && Math.abs(oldW - worldW) > 0.5){ const f = worldW / oldW; crops.forEach(c => c.x *= f); if (goat) goat.x *= f; pointer.x *= f; }
  buildHills(); buildFieldLayer(); coinTarget = null;
  if (!oldW && mode === 'idle' && cur && SPRITES.carrot) fillIdle();
}

/* ================= runtime ================= */
let mode = 'idle';           // idle | day | dusk
let cur = null, time = 0, dayLen = 16, tNow = 0;
let tutorialChargeShown = false;
let paused = false, rushTimer = 0, rushCharge = 0;
const RUSH_GOAL = 22, RUSH_DURATION = 4;
const CHAIN_TIERS = [{ count:0, mul:1 }, { count:8, mul:1.25 }, { count:18, mul:1.5 }, { count:30, mul:2 }];
let crops = [], parts = [], texts = [], goat = null, goatTimer = Infinity;
let tickAcc = 0, spawnAcc = 0, sweepT = 0, sweepA = 0, shakeA = 0, duskT = 0, dawnFade = 0, lastSec = 99, hitStopTimer = 0;
let smokePuffs = [], weatherParts = [], fieldProps = [], crows = [], bolts = [];
let propTimer = 4.5, crowTimer = 7.0, chargeT = 0, chargeReady = false, arthurAngerTimer = 0, vortexes = [];
let dailyEvent = GAZETTE_EVENTS[0];
function rollDailyEvent(){
  dailyEvent = GAZETTE_EVENTS[(farm.day * 7 + farm.no * 3 + (meta.biome || 0)) % GAZETTE_EVENTS.length];
}
let combo = 0, comboTimer = 0, today = { earned:0, count:0, best:0, bonus:0, rushes:0, lucky:0 }, coinTarget = null, lastBump = 0;
const pointer = { x:0, y:0, lastX:0, lastY:0, vx:0, vy:0, active:false, down:false, placed:false, kind:'mouse' };
const keys = new Set();

// 3-Stage Crop Growth Timings (snappy so gameplay stays fast and responsive!)
const STAGE2_AGE = 0.16;
const STAGE3_AGE = 0.36;

function depth(y){ return 0.8 + 0.45 * clamp((y - FIELD_TOP) / (HW - FIELD_TOP), 0, 1); }
function pickType(){
  const paid = farm.billsPaid;
  const allowed = curCity().crops || ['carrot', 'cabbage', 'pumpkin', 'radish', 'golden', 'potato'];
  if (paid >= 3 && allowed.includes('golden') && Math.random() < cur.gold) return 'golden';
  const weights = [];
  for (let i = 0; i < allowed.length; i++) {
    const k = allowed[i];
    if (!CROP[k]) continue;
    // Unlock higher-tier regional crops progressively as bills are paid, but always include the city's signature regional crops from Bill 0-1!
    const minBill = i <= 2 ? 0 : (i <= 4 ? 1 : (i <= 6 ? 2 : 3));
    if (paid >= minBill) {
      const w = i === 0 ? 32 : (i <= 2 ? 24 : 16);
      weights.push([k, w]);
    }
  }
  if (!weights.length) return allowed[0] || 'carrot';
  let r = Math.random() * weights.reduce((a, b) => a + b[1], 0);
  for (const [k, v] of weights){ r -= v; if (r <= 0) return k; }
  return weights[0][0];
}

function makeMoundClumps(r){
  const clumps = [];
  const cnt = Math.max(6, Math.round(r * 0.22));
  for (let i = 0; i < cnt; i++){
    const t = (i / (cnt - 1)) * Math.PI - Math.PI;
    clumps.push({
      ox: Math.cos(t) * (r * (0.55 + Math.random() * 0.28)),
      oy: Math.sin(t) * -(r * 0.09) + (Math.random() - 0.5) * 2.5,
      r: (r * 0.14) + Math.random() * (r * 0.09),
      shade: i % 2 === 0 ? '#4a3222' : '#5e402b'
    });
  }
  return clumps;
}

function spawnCrop(delay){
  const type = pickType(), def = CROP[type];
  let x = 0, y = 0, ok = false;
  for (let i = 0; i < 14 && !ok; i++){
    x = PAD + Math.random() * (worldW - PAD * 2); y = FIELD_TOP + 32 + Math.random() * (HW - FIELD_TOP - 54);
    const rr = def.r * depth(y);
    ok = crops.every(c => { const dx = c.x - x, dy = c.y - y, m = (c.r * c.ds + rr) * 0.85; return dx * dx + dy * dy > m * m; });
  }
  if (!ok) return false;
  const hp = def.hp * hpMul();
  const ds = depth(y);
  crops.push({
    type, x, y, ds, r: def.r, hp, maxHp: hp,
    age: -(delay || 0),
    stage: 1,
    // Hooke's Law spring state for squash-and-stretch
    stretch: -0.52,
    stretchVel: 7.2,
    wobbleAngle: 0,
    wobbleVel: 0,
    moundClumps: makeMoundClumps(def.r),
    sq:0, flash:0, wob: Math.random() * 6.28,
    vx:0, vy:0, hpShow:0, panic:0, stam:1,
    zt: Math.random() * 2, eye:0, monoclePop:0, capBounce:0, crownPop:0,
    hatProgress:0, scarfProgress:0,
    frosted: !!(dailyEvent && dailyEvent.frost && Math.random() < 0.55),
    dead:false, lucky:Math.random() < (0.03 + 0.008 * (meta.heir.horseshoe || 0))
  });
  return true;
}
function fillIdle(){
  crops = [];
  for (let i = 0; i < cur.max; i++) spawnCrop(0);
  crops.forEach(c => { c.age = 1; c.stage = 3; c.stretch = 0; c.stretchVel = 0; c.hatProgress = 0.65; c.scarfProgress = 0; });
}

function startDay(){
  if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden || billStatus().tonight) return;
  window.dispatchEvent(new Event('dbd:close-management'));
  dayCheckpoint = JSON.parse(JSON.stringify(farm));
  save();
  Sound.init();
  cur = stats(); dayLen = cur.day; time = dayLen; lastSec = 99;
  rollDailyEvent();
  crops = []; parts = []; texts = []; fieldProps = []; crows = []; bolts = [];
  spawnAcc = 0; tickAcc = 0; combo = 0; comboTimer = 0;
  propTimer = 3.8; crowTimer = farm.billsPaid >= 2 ? 5.5 : 999; chargeT = 0; chargeReady = false;
  rushTimer = 0; rushCharge = 0; paused = false;
  today = { earned:0, count:0, best:0, bonus:0, rushes:0, lucky:0 };
  goatTimer = farm.billsPaid >= 2 ? 3 + Math.random() * 5 : Infinity; goat = null;
  const initCount = Math.min(cur.max, 4 + Math.floor(cur.max * 0.35) + (hasSkill('soil_dew') ? 3 : 0));
  for (let i = 0; i < initCount; i++) spawnCrop(0.08 + i * 0.04);
  mode = 'day'; last = performance.now(); dawnFade = reduceMotion ? 0 : 0.65;
  stage.classList.add('playing'); syncPause();
  if (pointer.kind === 'key') pointer.active = false;
  Sound.dawn(); renderAll();
  if (!playerSettings.tutorialComplete) toast('Arthur: Drag across the crops to harvest. Every cut earns cash.', 4800);
}

function endDay(){
  if (mode !== 'day') return;
  dayCheckpoint = null;
  mode = 'dusk'; duskT = 0; paused = false; syncPause();
  farm.lastEarn = today.earned; farm.lastCount = today.count; farm.lastBest = today.best; farm.lastBonus = today.bonus;
  farm.bestChain = Math.max(farm.bestChain || 0, today.best); farm.day += 1; farm.played = true;
  rushTimer = 0; rushCharge = 0; comboTimer = 0; combo = 0;
  stage.classList.remove('playing'); keys.clear(); pointer.active = false; pointer.down = false;
  if (hasSkill('gold_interest') && farm.cash > 0) {
    const interest = Math.min(300, Math.floor(farm.cash * 0.12));
    if (interest > 0) { farm.cash += interest; farm.earned += interest; }
  }
  const ct = curCity();
  if (!meta.cityRecords) meta.cityRecords = {};
  if (!meta.cityOwned) meta.cityOwned = {};
  meta.cityRecords[ct.id] = Math.max(meta.cityRecords[ct.id] || 0, Math.floor(today.earned));
  if (today.earned >= ct.record && !meta.cityOwned[ct.id]) {
    meta.cityOwned[ct.id] = true;
    meta.diamonds = (meta.diamonds || 0) + 1;
    toast(`👑 Dethroned ${ct.rival} in ${ct.name}! Earned +1 💎 Diamond & Regional Tribute!`, 4200);
  }
  Sound.sunset(); save(); renderAll();
  if (!playerSettings.tutorialComplete) {
    playerSettings.tutorialComplete = true; if (storeSettings(playerSettings)) void persistPreference(SETTINGS_KEY, JSON.stringify(playerSettings)).catch(() => undefined);
    toast('Open ⚙ to buy an upgrade. Cash buys equipment for this farm; Grit and Diamonds carry over.', 6500);
  }
}

function chainMultiplier(){
  let value = 1;
  for (const tier of CHAIN_TIERS) if (combo >= tier.count) value = tier.mul;
  return value;
}
function incomeMultiplier(){ return Math.min(3, Math.round(chainMultiplier() * (rushTimer > 0 ? 1.5 : 1) * 100) / 100); }
function syncPause(){
  const overlay = $('#pauseOverlay'), button = $('#btnPause');
  if (overlay) overlay.hidden = !paused;
  if (button){ button.hidden = mode !== 'day'; button.setAttribute('aria-pressed', String(paused)); }
  stage.classList.toggle('paused', paused);
}
function setPaused(value){
  if (mode !== 'day') return;
  paused = !!value; keys.clear(); pointer.down = false; pointer.active = false;
  last = 0; if (paused) save(); syncPause();
  const focus = paused ? $('#btnResume') : $('#btnPause');
  if (focus) focus.focus();
}
function triggerRush(){
  rushTimer = RUSH_DURATION;
  const sc = (window as any).__PHASER_FARM_SCENE;
  if (sc && sc.cameras && sc.cameras.main) sc.cameras.main.flash(260, 255, 235, 145); rushCharge = 0; today.rushes++;
  addText('HARVEST RUSH!', worldW / 2, FIELD_TOP + 65, '#ffe08a', 36, -20, 1.1);
  toast('Harvest Rush! +50% income + faster crops for 4 seconds.', 2600);
  Sound.fanfare();
}

function unleashChargeCleave(){
  if (mode !== 'day' || !pointer.active) { chargeT = 0; chargeReady = false; return; }
  const cleaveR = cur.R * (cur.cleaver ? 2.5 : 2.15);
  const cleaveDmg = cur.dmg * 2.6;
  chargeT = 0; chargeReady = false;
  sweepT = 0.22;
  hitStopTimer = 0.04;
  shake(8);
  void hapticImpact('medium');
  Sound.hit(true);
  parts.push({ k:'ring', x:pointer.x, y:pointer.y, r:cleaveR, life:0.42, max:0.42, c:'#38bdf8' });
  parts.push({ k:'ring', x:pointer.x, y:pointer.y, r:cleaveR * 0.72, life:0.32, max:0.32, c:'#fde047' });
  addText('CLEAVE!', pointer.x, pointer.y - cleaveR * 0.6, '#fde047', 28, -45, 0.85);

  let killed = 0;
  for (const c of crops){
    if (c.dead || c.age < 0.04) continue;
    const cy = c.y - c.r * c.ds * 0.55;
    if (Math.hypot(c.x - pointer.x, cy - pointer.y) > cleaveR + c.r * c.ds * 0.6) continue;
    if (c.frosted) {
      c.frosted = false;
      farm.cash += 2; farm.earned += 2; today.earned += 2;
      addText('ICE CRACK +$2', c.x, cy - 22, '#bae6fd', 18, -35, 0.8);
    }
    c.hp -= cleaveDmg;
    c.sq = 1; c.flash = 1; c.hpShow = 1.6; c.eye = 1.45;
    c.stretch = -0.45; c.stretchVel = -9.0;
    debris(c, 5);
    if (c.hp <= 1e-6 || (hasSkill('reap_exec') && c.hp / c.maxHp <= 0.25)){ harvest(c); killed++; }
  }
  if (killed) crops = crops.filter(c => !c.dead);
  // Calm angry goat if caught in Charge Cleave!
  if (goat && goat.bumped && Math.hypot(goat.x - pointer.x, goat.y - pointer.y) <= cleaveR + 35) {
    goat.bumped = false; goat.speed = 65; goat.hop = 1.0;
    farm.cash += 5; farm.earned += 5; today.earned += 5;
    addText('GOAT CALMED +$5', goat.x, goat.y - 45, '#86efac', 24, -40, 1.0);
    Sound.coin();
  }
  checkPropsAndCrows(cleaveR);
}

function spawnFieldProp(){
  if (fieldProps.length >= 2) return;
  const kind = (goat && !cur.treaty && Math.random() < 0.45) ? 'treat' : 'fertilizer';
  const x = PAD + 40 + Math.random() * (worldW - PAD * 2 - 80);
  const y = FIELD_TOP + 45 + Math.random() * (HW - FIELD_TOP - 80);
  fieldProps.push({ kind, x, y, ds: depth(y), age: 0, life: 9.5 });
}

function spawnCrow(){
  if (crows.length >= 2 || !crops.length) return;
  const target = crops[Math.floor(Math.random() * crops.length)];
  const fromLeft = Math.random() < 0.5;
  crows.push({
    x: fromLeft ? -30 : worldW + 30,
    y: 45 + Math.random() * 55,
    tx: target.x,
    ty: target.y - 18,
    vx: 0, vy: 0,
    t: 0, scared: false
  });
}

function checkPropsAndCrows(rad){
  const R = rad || cur.R;
  for (let i = fieldProps.length - 1; i >= 0; i--){
    const fp = fieldProps[i];
    if (Math.hypot(fp.x - pointer.x, (fp.y - 14 * fp.ds) - pointer.y) <= R + 22 * fp.ds){
      fieldProps.splice(i, 1);
      Sound.coin();
      parts.push({ k:'ring', x:fp.x, y:fp.y - 10, r:55, life:0.4, max:0.4, c:'#86efac' });
      if (fp.kind === 'fertilizer'){
        addText('FERTILIZER! +4 CROPS', fp.x, fp.y - 32, '#bef264', 24, -42, 1.0);
        for (let k = 0; k < 4; k++) {
          if (spawnCrop(0)) {
            const nc = crops[crops.length - 1];
            nc.age = 0.5; nc.stage = 3;
          }
        }
      } else {
        const bonus = 5 + farm.billsPaid * 2;
        farm.cash += bonus; farm.earned += bonus; today.earned += bonus;
        if (goat) { goat.bumped = false; goat.speed = 60; goat.hop = 1.0; }
        addText(`CLOVER TREAT! +$${bonus}`, fp.x, fp.y - 32, '#fde047', 24, -42, 1.0);
      }
    }
  }
  for (const cr of crows){
    if (!cr.scared && Math.hypot(cr.x - pointer.x, cr.y - pointer.y) <= R + 28){
      cr.scared = true; arthurAngerTimer = 2.4;
      cr.vx = (cr.x < pointer.x ? -1 : 1) * 260;
      cr.vy = -220;
      const tip = 3 + farm.billsPaid * 2;
      farm.cash += tip; farm.earned += tip; today.earned += tip;
      addText(`SHOO CROW! +$${tip}`, cr.x, cr.y - 20, '#fde047', 22, -38, 0.95);
      Sound.pop(10);
      coin(cr.x, cr.y, 0);
    }
  }
}

function swing(){
  if (!pointer.active) return;
  sweepT = 0.13; sweepA = (sweepA + 2.3) % (Math.PI * 2);
  const crit = Math.random() < cur.cc, dmg = cur.dmg * (crit ? cur.cm : 1);
  let hits = 0, killed = 0;
  for (const c of crops){
    if (c.dead || c.age < 0.04) continue;
    const cy = c.y - c.r * c.ds * 0.55, dx = c.x - pointer.x, dy = cy - pointer.y, rr = cur.R + c.r * c.ds * 0.65;
    if (dx * dx + dy * dy > rr * rr) continue;
    hits++;
    if (c.frosted) {
      c.frosted = false;
      farm.cash += 2; farm.earned += 2; today.earned += 2;
      addText('FROST +$2', c.x, cy - 24, '#bae6fd', 18, -36, 0.8);
    }
    c.hp -= dmg;
    if (c.type === 'onion' && canAdd()) {
      for (const dir of [-1, 1]) {
        parts.push({ k:'juice', x:c.x + dir * 8, y:cy - 4, vx:dir * (45 + Math.random() * 40), vy:-65, g:520, floor:c.y + 4, r:3.2, c:'#38bdf8', life:0.55, max:0.55 });
      }
    }
    c.sq = 1;
    c.flash = 1;
    c.hpShow = 1.4;
    c.eye = 1.35;
    c.monoclePop = 1.0;
    c.capBounce = 1.0;
    c.crownPop = 1.0;
    // Spring squash impulse on hit!
    c.stretch = -0.38;
    c.stretchVel = -7.5;
    c.wobbleVel = (pointer.vx >= 0 ? 1 : -1) * 9.5;

    debris(c, crit ? 5 : 3);
    if (c.hp <= 1e-6 || (hasSkill('reap_exec') && c.hp / c.maxHp <= 0.25)){ harvest(c); killed++; }
  }
  if (hits){
    Sound.hit(crit);
    if (crit){
      shake(5); hitStopTimer = 0.035;
      addText('CRIT', pointer.x, pointer.y - cur.R - 8, '#ffd34d', 30, -40, 0.7);
      spark(pointer.x, pointer.y);
      // Storm Scythe synergy: chain lightning to up to 2 nearby crops!
      if (cur.storm) {
        let chained = 0;
        for (const tCrop of crops) {
          if (tCrop.dead || chained >= 2) continue;
          const d = Math.hypot(tCrop.x - pointer.x, tCrop.y - pointer.y);
          if (d > cur.R && d < cur.R + 170) {
            chained++;
            bolts.push({ x1: pointer.x, y1: pointer.y, x2: tCrop.x, y2: tCrop.y - 18, life: 0.22, max: 0.22 });
            tCrop.hp -= cur.dmg * 1.6;
            tCrop.eye = 0.85; tCrop.stretch = -0.35;
            if (tCrop.hp <= 1e-6) { harvest(tCrop); killed++; }
          }
        }
      }
    }
  }
  if (killed) crops = crops.filter(c => !c.dead);
  if (goat) checkGoat();
  checkPropsAndCrows(cur.R);
}

function harvest(c){
  if (c.dead) return;
  c.dead = true;
  const def = CROP[c.type], previousTier = chainMultiplier();
  combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = cur.chainGrace;
  today.best = Math.max(today.best, combo);
  if (rushTimer <= 0){ rushCharge++; if (rushCharge >= RUSH_GOAL) triggerRush(); }
  const midas = (hasSkill('gold_midas') && (c.lucky || ['golden','canola','abacaxi','lavender','daikon'].includes(c.type))) ? 1.5 : 1; const multiplier = incomeMultiplier(), lucky = (c.lucky ? 2 : 1) * midas;
  const gazetteMul = (dailyEvent && dailyEvent.valMul ? dailyEvent.valMul : 1) * ((dailyEvent && dailyEvent.pumpkinBonus && (c.type === 'pumpkin' || c.type === 'onion')) ? dailyEvent.pumpkinBonus : 1);
  const baseValue = def.val * cur.vm * gazetteMul * (c.type === 'radish' ? cur.radishBonus : 1);
  const v = baseValue * multiplier * lucky;
  farm.cash += v; farm.earned += v; farm.harvested += 1; today.earned += v; today.count += 1;
  today.bonus += v - baseValue; if (c.lucky) today.lucky++;
  const top = c.y - def.top * c.ds;
  addText(fmtGain(v), c.x, top - 4, c.lucky || c.type === 'golden' ? '#ffe27a' : '#fffaf0', c.type === 'golden' ? 32 : Math.min(30, 21 + v / 4), -58, 0.9);
  if (c.lucky) addText('LUCKY ×2', c.x, top - 28, '#ffe08a', 19, -36, 1);
  if (chainMultiplier() > previousTier){
    addText('CHAIN ×' + chainMultiplier(), c.x, top - 52, '#c8f5a8', 26, -26, 0.95); Sound.coin();
  }
  parts.push({ k:'ring', x:c.x, y:c.y - c.r * c.ds * 0.5, r:c.r * c.ds * 1.5, life:0.35, max:0.35, c:c.lucky ? '#ffe08a' : def.color });
  if (c.type === 'pumpkin' || c.type === 'potato' || c.type === 'golden') { hitStopTimer = 0.032; spark(c.x, c.y - c.r * c.ds * 0.6); }

  // 4-Part Slice Burst: Clipped Crop Halves, Fluttering Leaves, Dirt Clods, and Juice Droplets!
  sliceBurst(c);
  if (hasSkill('soil_eden') && Math.random() < 0.25 && crops.length < cur.max) {
    spawnCrop(0.05);
  }

  const n = Math.min(5, 1 + Math.floor(v / 3));
  for (let i = 0; i < n; i++) coin(c.x + (Math.random() - 0.5) * 16, c.y - c.r * c.ds * 0.5, i * 0.03);
  Sound.pop(combo); if (c.type === 'golden' || c.lucky) Sound.coin();
}

/* ================= 4-part slice burst & particles ================= */
function canAdd(){ return parts.length < (reduceMotion ? 140 : 480); }

function debris(c, n){
  if (!canAdd()) return;
  const def = CROP[c.type];
  const sz = (c.r / 24) * c.ds;
  for (let i = 0; i < n; i++){
    // Bouncing soil clods on hit
    parts.push({
      k:'clod',
      x: c.x + (Math.random() - 0.5) * c.r * c.ds,
      y: c.y + 2,
      vx: (Math.random() - 0.5) * 140 * sz,
      vy: -70 - Math.random() * 110 * sz,
      g: 560,
      floor: c.y + 5 + (Math.random() - 0.5) * 8,
      r: (2.2 + Math.random() * 2.8) * Math.sqrt(sz),
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 13,
      c: Math.random() < 0.5 ? '#4a3222' : '#6b4830',
      life: 0.55 + Math.random() * 0.25,
      max: 0.8
    });
  }
  // A couple fluttering leaf clippings on hit
  if (!reduceMotion && canAdd()){
    parts.push({
      k:'leaf',
      x: c.x + (Math.random() - 0.5) * 14 * sz,
      y: c.y - c.r * c.ds * 0.8,
      vx: (Math.random() - 0.5) * 120,
      vy: -60 - Math.random() * 60,
      g: 210,
      len: (6 + Math.random() * 5) * Math.sqrt(sz),
      wid: (2.5 + Math.random() * 2) * Math.sqrt(sz),
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 15,
      phase: Math.random() * 6.28,
      c: Math.random() < 0.5 ? def.leaf : def.leafDark,
      life: 0.7,
      max: 0.7
    });
  }
}

function sliceBurst(c){
  const def = CROP[c.type];
  const sz = (c.r / 24) * c.ds;
  const cutAngle = Math.atan2(pointer.vy || -20, pointer.vx || 80);

  // 1. Two clean-cut crop halves with inner cross-section flying apart
  for (const side of [-1, 1]){
    const perp = cutAngle + side * (Math.PI * 0.5);
    parts.push({
      k: 'half',
      type: c.type,
      x: c.x,
      y: c.y - c.r * c.ds * 0.55,
      vx: Math.cos(perp) * (70 + Math.random() * 40) + (pointer.vx || 0) * 0.12,
      vy: Math.sin(perp) * 45 - 135,
      g: 490,
      rot: 0,
      vr: side * (5 + Math.random() * 4),
      side,
      r: c.r * c.ds * 0.74,
      life: 0.58,
      max: 0.58
    });
  }

  if (reduceMotion) return;

  // 2. Fluttering leaf clippings with horizontal sine drag
  const leafCount = Math.min(9, Math.round(7 * sz));
  for (let i = 0; i < leafCount && canAdd(); i++){
    const a = -Math.PI * (0.1 + Math.random() * 0.8);
    const sp = (80 + Math.random() * 145) * Math.sqrt(sz);
    parts.push({
      k: 'leaf',
      x: c.x + (Math.random() - 0.5) * 14 * sz,
      y: c.y - c.r * c.ds * 0.75,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 45,
      g: 210,
      len: (6.5 + Math.random() * 6) * Math.sqrt(sz),
      wid: (2.6 + Math.random() * 2.4) * Math.sqrt(sz),
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 16,
      phase: Math.random() * 6.28,
      c: i % 2 === 0 ? def.leaf : def.leafDark,
      life: 0.85 + Math.random() * 0.3,
      max: 1.0
    });
  }

  // 3. Bouncing dirt clods
  debris(c, Math.min(8, Math.round(6 * sz)));

  // 4. Glossy juice droplets that splat into puddles on the soil
  const juiceCount = Math.min(12, Math.round(9 * sz));
  for (let i = 0; i < juiceCount && canAdd(); i++){
    const a = Math.random() * Math.PI * 2;
    const sp = (75 + Math.random() * 170) * Math.sqrt(sz);
    parts.push({
      k: 'juice',
      x: c.x,
      y: c.y - c.r * c.ds * 0.5,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 85,
      g: 560,
      floor: c.y + 6 + (Math.random() - 0.5) * 20 * sz,
      r: (2.2 + Math.random() * 2.8) * Math.sqrt(sz),
      c: def.juice,
      life: 0.65,
      max: 0.65
    });
  }
}

function coin(x, y, delay){
  if (!canAdd()) return;
  if (!coinTarget) coinTarget = hudPoint();
  const tx = coinTarget[0], ty = coinTarget[1];
  parts.push({ k:'coin', sx:x, sy:y, cx:lerp(x, tx, 0.3) + (Math.random() - 0.5) * 140, cy:Math.min(y, ty) - 60 - Math.random() * 80, tx, ty, t:-delay * 2, dur:0.55 + Math.random() * 0.2, life:3 });
}
function spark(x, y){ if (canAdd()) parts.push({ k:'spark', x, y, s:2 + Math.random() * 3, life:0.5, max:0.5 }); }
function addText(t, x, y, col, size, vy, life){ texts.push({ t, x, y, col, size, vy, life, max:life }); }
function shake(a){
  if (reduceMotion) return;
  shakeA = Math.max(shakeA, a);
  const sc = (window as any).__PHASER_FARM_SCENE;
  if (sc && sc.cameras && sc.cameras.main) sc.cameras.main.shake(180, a * 0.0012);
}
function hudPoint(){
  const el = $('#hudEarn'), r = el.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  if (!r.width) return [80 / scale, 30 / scale];
  return [(r.left + r.width / 2 - cr.left) / scale, (r.top + r.height / 2 - cr.top) / scale];
}
function bumpHud(){
  const now = performance.now(); if (now - lastBump < 120 || reduceMotion) return; lastBump = now;
  const el = $('#hudToday'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* the goat: peaceful white goat that only gets angry when touched! */
function spawnGoat(){
  const left = Math.random() < 0.5;
  goat = {
    x: left ? -50 : worldW + 50,
    y: FIELD_TOP + 70 + Math.random() * (HW - FIELD_TOP - 120),
    dir: left ? 1 : -1,
    speed: 56 + Math.random() * 22,
    t: 0,
    bumped: false,
    petted: false,
    angerFlash: 0,
    hop: 0
  };
}
function checkGoat(){
  if (!pointer.active || !goat) return;
  const ds = depth(goat.y), gy = goat.y - 26 * ds;
  if (Math.hypot(goat.x - pointer.x, gy - pointer.y) > cur.R + 26 * ds) return;
  if (cur.treaty){
    if (!goat.petted){
      goat.petted = true;
      goat.hop = 1.0;
      const tip = 2 + 3 * farm.billsPaid;
      farm.cash += tip; farm.earned += tip; today.earned += tip;
      addText('Good goat +$' + tip, goat.x, gy - 38, '#c6f2ae', 24, -40, 1.1);
      Sound.baah(0.5);
    }
    return;
  }
  if (goat.bumped) return;
  goat.bumped = true;
  goat.angerFlash = 1.0;
  goat.hop = 1.0;
  time = Math.max(0, time - 1.5);
  goat.speed = 295;
  goat.dir = pointer.x < goat.x ? 1 : -1;
  hitStopTimer = 0.04;
  shake(12);
  addText('ANGRY BAAH! −1.5 s', goat.x, gy - 38, '#ff7a5c', 30, -45, 1.2);
  Sound.baah(1);
}

/* ================= update ================= */
function moveRadish(c, dt){
  const dx = c.x - pointer.x, dy = c.y - pointer.y, d = Math.hypot(dx, dy) || 1;
  if (pointer.active && d < cur.R + 120){ c.vx += dx / d * 1100 * dt; c.vy += dy / d * 1100 * dt; c.panic = 1; c.stam = Math.max(0.35, c.stam - dt * 0.28); }
  else { c.panic = Math.max(0, c.panic - dt * 1.5); c.stam = Math.min(1, c.stam + dt * 0.2); }
  const k = Math.exp(-5 * dt); c.vx *= k; c.vy *= k;
  const maxV = 190 * cur.radishSlow * c.stam, v = Math.hypot(c.vx, c.vy);
  if (v > maxV){ c.vx *= maxV / v; c.vy *= maxV / v; }
  c.x += c.vx * dt; c.y += c.vy * dt;
  if (c.x < PAD){ c.x = PAD; c.vx = Math.abs(c.vx) * 0.3; }
  if (c.x > worldW - PAD){ c.x = worldW - PAD; c.vx = -Math.abs(c.vx) * 0.3; }
  if (c.y < FIELD_TOP + 30){ c.y = FIELD_TOP + 30; c.vy = Math.abs(c.vy) * 0.3; }
  if (c.y > HW - 22){ c.y = HW - 22; c.vy = -Math.abs(c.vy) * 0.3; }
  c.ds = depth(c.y);
  if (v > 60 && Math.random() < dt * 14 && canAdd()) parts.push({ k:'dust', x:c.x, y:c.y + 2, vx:-c.vx * 0.1, vy:-10, g:0, s:3 + Math.random() * 3, life:0.4, max:0.4 });
}

function updateCropSpringAndStages(c, dt){
  const prevAge = c.age;
  c.age += dt;
  if (c.age <= 0) return;

  // Stage 1 -> Stage 2 (Budding bulb + dirt crumbs)
  if (c.stage === 1 && prevAge < STAGE2_AGE && c.age >= STAGE2_AGE){
    c.stage = 2;
    c.stretch = -0.28;
    c.stretchVel = 5.8;
    c.wobbleVel = (Math.random() < 0.5 ? -1 : 1) * 4.0;
    debris(c, 2);
  }
  // Stage 2 -> Stage 3 (Full Ripeness Pop!)
  if (c.stage < 3 && prevAge < STAGE3_AGE && c.age >= STAGE3_AGE){
    c.stage = 3;
    c.stretch = 0.36;
    c.stretchVel = 8.8;
    c.wobbleVel = (Math.random() < 0.5 ? -1 : 1) * 5.2;
    debris(c, 3);
    if (canAdd()){
      parts.push({ k:'ring', x:c.x, y:c.y - c.r * c.ds * 0.5, r:c.r * c.ds * 1.35, life:0.28, max:0.28, c:'#fef08a' });
    }
  }

  // Hooke's Law Damped Harmonic Spring
  const fStretch = -230 * c.stretch - 13.5 * c.stretchVel;
  c.stretchVel += fStretch * dt;
  c.stretch += c.stretchVel * dt;

  const fWob = -175 * c.wobbleAngle - 11.0 * c.wobbleVel;
  c.wobbleVel += fWob * dt;
  c.wobbleAngle += c.wobbleVel * dt;

  c.sq = Math.max(0, c.sq - dt * 6);
  c.flash = Math.max(0, c.flash - dt * 7);
  c.hpShow = Math.max(0, c.hpShow - dt);
  c.eye = Math.max(0, c.eye - dt);
  c.monoclePop = Math.max(0, (c.monoclePop || 0) - dt * 1.9);
  c.capBounce = Math.max(0, (c.capBounce || 0) - dt * 2.1);
  c.crownPop = Math.max(0, (c.crownPop || 0) - dt * 2.0);

  // Grandma Pumpkin crochets her flat beret hat first, wears it, then crochets her striped scarf!
  if (c.type === 'pumpkin' && c.stage === 3 && c.eye <= 0) {
    if ((c.hatProgress || 0) < 1) {
      c.hatProgress = Math.min(1, (c.hatProgress || 0) + dt * 0.24);
    } else if ((c.scarfProgress || 0) < 1) {
      c.scarfProgress = Math.min(1, (c.scarfProgress || 0) + dt * 0.22);
    }
  }

  // Blade Wind-Wake: nearby crops lean away when the sickle sweeps past
  if (mode === 'day' && pointer.active && !reduceMotion) {
    const cy = c.y - c.r * c.ds * 0.55;
    const dx = c.x - pointer.x, dy = cy - pointer.y;
    const dist = Math.hypot(dx, dy);
    const wakeR = (cur ? cur.R : 48) + c.r * c.ds + 48;
    const pSpeed = Math.hypot(pointer.vx || 0, pointer.vy || 0);
    if (dist < wakeR && dist > 4 && pSpeed > 40) {
      const push = (1 - dist / wakeR) * clamp(pSpeed / 650, 0.1, 0.9);
      c.wobbleVel += (dx > 0 ? 1 : -1) * push * 5.2 * dt * 60;
    }
  }
}

function update(dt){
  if (paused) return;
  if (hitStopTimer > 0) {
    hitStopTimer = Math.max(0, hitStopTimer - dt);
    shakeA = Math.max(0, shakeA - dt * 25);
    return;
  }
  tNow += dt; arthurAngerTimer = Math.max(0, arthurAngerTimer - dt);
  // Farmhouse chimney smoke update
  if (!reduceMotion && worldW > 420) {
    if (Math.random() < dt * 3.8 && smokePuffs.length < 28) {
      smokePuffs.push({ x: worldW * 0.76 + 17, y: 149, vx: 7 + Math.random() * 6, vy: -14 - Math.random() * 6, r: 2.8, maxR: 11.5, life: 0, max: 2.3 });
    }
    for (let i = smokePuffs.length - 1; i >= 0; i--) {
      const sp = smokePuffs[i];
      sp.life += dt;
      if (sp.life >= sp.max) { smokePuffs.splice(i, 1); continue; }
      sp.x += (sp.vx + Math.sin(tNow * 2.1 + i) * 4) * dt;
      sp.y += sp.vy * dt;
    }
  }
  if (mode === 'day'){
    time -= dt;
    if (keys.size){
      let vx = 0, vy = 0;
      if (keys.has('arrowleft') || keys.has('a')) vx -= 1; if (keys.has('arrowright') || keys.has('d')) vx += 1;
      if (keys.has('arrowup') || keys.has('w')) vy -= 1; if (keys.has('arrowdown') || keys.has('s')) vy += 1;
      if (vx || vy){
        const l = Math.hypot(vx, vy);
        pointer.vx = (vx / l) * 520;
        pointer.vy = (vy / l) * 520;
        pointer.x = clamp(pointer.x + pointer.vx * dt, 0, worldW);
        pointer.y = clamp(pointer.y + pointer.vy * dt, FIELD_TOP - 20, HW);
        pointer.active = true;
      }
    }
    comboTimer = Math.max(0, comboTimer - dt); if (comboTimer <= 0 && combo){ combo = 0; }
    rushTimer = Math.max(0, rushTimer - dt);
    tickAcc += dt; const iv = 1 / cur.tick; while (tickAcc >= iv){ tickAcc -= iv; swing(); }
    spawnAcc += dt;
    if (!playerSettings.tutorialComplete && today.count >= 3 && today.count < 7 && !tutorialChargeShown) {
      tutorialChargeShown = true; toast('Arthur: Hold on a tough crop, then lift your finger to release a powerful cleave.', 4500);
    }
    // Charge Cleave charging while holding pointer or Spacebar
    if ((pointer.down || keys.has(' ')) && pointer.active) {
      const cRate = (cur.cleaver ? 1.5 : 1.0) * (dailyEvent && dailyEvent.chargeFast ? dailyEvent.chargeFast : 1.0);
      chargeT = Math.min(1, chargeT + dt * 1.9 * cRate);
      if (chargeT >= 1 && !chargeReady) { chargeReady = true; Sound.tick(); }
    } else if (chargeT > 0) {
      if (chargeT >= 0.72) unleashChargeCleave();
      else { chargeT = Math.max(0, chargeT - dt * 3.5); chargeReady = false; }
    }
    // Field props & Crow pests timers
    propTimer -= dt * (dailyEvent && dailyEvent.propBoost ? dailyEvent.propBoost : 1) * (hasSkill('soil_bounty') ? 2.0 : 1.0);
    if (propTimer <= 0) { propTimer = 6.5 + Math.random() * 4; spawnFieldProp(); }
    crowTimer -= dt;
    if (crowTimer <= 0 && farm.billsPaid >= 2) { crowTimer = 8.5 + Math.random() * 5; spawnCrow(); }

    const spawnInterval = cur.spawn / ((rushTimer > 0 ? 1.35 : 1) * (dailyEvent && dailyEvent.spawnFast ? dailyEvent.spawnFast : 1));
    let spawned = 0;
    while (spawnAcc >= spawnInterval && spawned < 4){
      if (crops.length >= cur.max){ spawnAcc = Math.min(spawnAcc, spawnInterval); break; }
      spawnCrop(0);
      if (hasSkill('soil_twin') && crops.length < cur.max && Math.random() < 0.20) spawnCrop(0.05);
      spawnAcc -= spawnInterval; spawned++;
    }
    if (!goat){ goatTimer -= dt; if (goatTimer <= 0 && farm.billsPaid >= 2) spawnGoat(); }
    const sec = Math.ceil(time);
    if (time < 3.2 && sec !== lastSec && sec > 0){ lastSec = sec; Sound.tick(); }
    if (time <= 0){ time = 0; endDay(); }
  } else if (mode === 'dusk'){
    duskT += dt; if (duskT >= 1.3){ mode = 'idle'; renderAll(); }
  }
  if (goat){
    goat.t += dt;
    goat.hop = Math.max(0, (goat.hop || 0) - dt * 2.8);
    goat.angerFlash = Math.max(0, (goat.angerFlash || 0) - dt * 2.5);
    goat.x += goat.dir * goat.speed * dt;
    if (hasSkill('gold_herd') && mode === 'day') {
      for (const c of crops) {
        if (!c.dead && c.age > 0.2 && Math.hypot(c.x - goat.x, c.y - goat.y) < 34) {
          c.hp -= cur.dmg * 12 * dt;
          if (c.hp <= 0) harvest(c);
        }
      }
      crops = crops.filter(c => !c.dead);
    }
    if (goat.bumped && !reduceMotion && Math.random() < dt * 22 && canAdd()) {
      parts.push({ k:'dust', x:goat.x - goat.dir * 16, y:goat.y + 2, vx:-goat.dir * (30 + Math.random() * 40), vy:-15 - Math.random() * 20, g:0, s:4 + Math.random() * 3.5, life:0.45, max:0.45 });
    }
    if (goat.x < -90 || goat.x > worldW + 90){ goat = null; goatTimer = 7 + Math.random() * 7; }
  }
  for (const c of crops){
    updateCropSpringAndStages(c, dt);
    if (c.type === 'radish' && mode === 'day') moveRadish(c, dt); else if (c.type === 'radish'){ c.vx *= 0.9; c.vy *= 0.9; c.panic = Math.max(0, c.panic - dt); }
    if (c.type === 'potato' && c.age > STAGE3_AGE && c.eye <= 0){ c.zt -= dt; if (c.zt <= 0){ c.zt = 1.3 + Math.random(); addText('z', c.x + 12 * c.ds, c.y - 54 * c.ds, '#efeaff', 16, -16, 1.6); } }
    if (c.type === 'golden' && c.age > 0 && Math.random() < dt * 3) spark(c.x + (Math.random() - 0.5) * 30 * c.ds, c.y - (14 + Math.random() * 30) * c.ds);
  }
  for (let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    p.life -= dt;
    if (p.k === 'coin'){ p.t += dt / p.dur; if (p.t >= 1){ p.life = 0; bumpHud(); } continue; }
    if (p.k === 'leaf'){
      p.vx *= Math.pow(0.28, dt);
      p.vy += (p.g || 200) * dt;
      p.x += (p.vx + Math.sin((p.max - p.life) * 14 + p.phase) * 34) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      continue;
    }
    if (p.vx !== undefined){
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      if (p.k === 'clod' && p.y > p.floor && p.vy > 0){
        p.y = p.floor; p.vy *= -0.4; p.vx *= 0.65;
      } else if (p.k === 'juice' && p.y >= p.floor && p.vy > 0){
        // Splat into a soil puddle!
        if (canAdd()){
          parts.push({ k:'puddle', x:p.x, y:p.floor, rx:p.r * 1.7, ry:p.r * 0.65, c:p.c, life:0.9, max:0.9 });
        }
        p.life = 0;
      }
    }
  }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts){ t.life -= dt; t.y += t.vy * dt; t.vy *= (1 - 1.6 * dt); }
  texts = texts.filter(t => t.life > 0);
  for (let i = fieldProps.length - 1; i >= 0; i--) {
    fieldProps[i].age += dt; fieldProps[i].life -= dt;
    if (fieldProps[i].life <= 0) fieldProps.splice(i, 1);
  }
  for (let i = crows.length - 1; i >= 0; i--) {
    const cr = crows[i]; cr.t += dt;
    if (!cr.scared) {
      const dx = cr.tx - cr.x, dy = cr.ty - cr.y, d = Math.hypot(dx, dy) || 1;
      cr.x += (dx / d) * 115 * dt; cr.y += (dy / d) * 115 * dt;
      if (d < 12) { cr.scared = true; cr.vx = (Math.random() < 0.5 ? -1 : 1) * 180; cr.vy = -160; }
    } else {
      cr.x += cr.vx * dt; cr.y += cr.vy * dt;
      if (cr.y < -40 || cr.x < -80 || cr.x > worldW + 80) crows.splice(i, 1);
    }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1);
  }
  // Weather particles (Rain streaks or Blowing Autumn Leaves)
  if (!reduceMotion && worldW > 0 && dailyEvent) {
    if (dailyEvent.weather === 'rain' && weatherParts.length < 48 && Math.random() < dt * 35) {
      weatherParts.push({ w:'rain', x: Math.random() * (worldW + 80), y: -15, vx: -75, vy: 460, life: 1.4 });
    } else if (dailyEvent.weather === 'wind' && weatherParts.length < 22 && Math.random() < dt * 10) {
      weatherParts.push({ w:'leaf', x: -15, y: 40 + Math.random() * (HW - 80), vx: 130 + Math.random() * 70, vy: 18 + Math.random() * 20, rot: Math.random() * 6.28, c: Math.random() < 0.5 ? '#f97316' : '#eab308', life: 6.0 });
    }
    for (let i = weatherParts.length - 1; i >= 0; i--) {
      const wp = weatherParts[i]; wp.life -= dt;
      wp.x += wp.vx * dt; wp.y += wp.vy * dt;
      if (wp.w === 'leaf') wp.y += Math.sin(tNow * 4 + i) * 18 * dt;
      if (wp.life <= 0 || wp.y > HW + 20 || wp.x > worldW + 40) weatherParts.splice(i, 1);
    }
  }
  sweepT = Math.max(0, sweepT - dt); shakeA = Math.max(0, shakeA - dt * 40); dawnFade = Math.max(0, dawnFade - dt * 1.8);
}

/* ================= 3-stage crop & funny character renderer ================= */
function skyP(){
  if (mode === 'day') return clamp(1 - time / dayLen, 0, 1);
  if (mode === 'dusk') return 1 + 0.3 * smooth(0, 1, duskT / 1.3);
  return farm.played ? 1.3 : 0.08;
}

function getCropScales(c){
  let base = 1.0;
  if (c.stage === 1){
    base = 0.36 + 0.28 * easeBack(clamp(c.age / STAGE2_AGE, 0, 1));
  } else if (c.stage === 2){
    base = 0.64 + 0.24 * easeBack(clamp((c.age - STAGE2_AGE) / (STAGE3_AGE - STAGE2_AGE), 0, 1));
  }
  const sy = clamp(1 + (c.stretch || 0), 0.32, 1.75);
  const sx = 1 / Math.sqrt(sy);
  return [c.ds * base * sx, c.ds * base * sy];
}

function drawDirtMound(c){
  const r = c.r * c.ds;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = '#3e2718';
  ell(ctx, 0, 2.5, r * 0.82, r * 0.26);
  if (c.moundClumps){
    for (const cl of c.moundClumps){
      ctx.fillStyle = cl.shade;
      circ(ctx, cl.ox * c.ds, (cl.oy + 2) * c.ds, cl.r * c.ds);
    }
  }
  ctx.restore();
}

function drawStage1Sprout(c, def){
  const s = c.r / 24;
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(2 * s, -11 * s, 0, -19 * s);
  ctx.stroke();

  ctx.fillStyle = def.leaf;
  ctx.strokeStyle = def.leafDark;
  ctx.lineWidth = 1.2 * s;
  for (const dir of [-1, 1]){
    ctx.save();
    ctx.translate(0, -17 * s);
    ctx.rotate(dir * 0.55);
    ell(ctx, dir * 7 * s, -2 * s, 8 * s, 4 * s, dir * 0.25);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStage2Bud(c, def, breeze){
  const r = c.r * 0.62;
  for (let i = -1; i <= 1; i++){
    ctx.save();
    ctx.translate(0, -r * 1.05);
    ctx.rotate(i * 0.45 + breeze * 0.6);
    ctx.fillStyle = i === 0 ? def.leaf : def.leafDark;
    ell(ctx, 0, -r * 0.52, r * 0.25, r * 0.58);
    ctx.restore();
  }
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.shade;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -r * 0.48, r * 0.72, Math.PI * 0.95, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sleepy baby eyes on Stage 2 bud
  ctx.strokeStyle = 'rgba(30, 15, 10, 0.65)';
  ctx.lineWidth = 1.4;
  for (const ex of [-r * 0.24, r * 0.24]){
    ctx.beginPath();
    ctx.arc(ex, -r * 0.6, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

function drawStage3RipeCharacter(c, def, breeze){
  const r = c.r;
  const type = c.type;
  const leafLag = breeze * 0.85;
  const shocked = c.eye > 0;
  const distToCursor = pointer.active ? Math.hypot(pointer.x - c.x, pointer.y - (c.y - r * c.ds * 0.6)) : 9999;
  const cursorNear = mode === 'day' && distToCursor < (cur ? cur.R : 48) + r * c.ds + 45;

  const ang = Math.atan2(pointer.y - (c.y - r * c.ds * 0.6), pointer.x - c.x);
  const px = pointer.active ? Math.cos(ang) * 1.9 : 0;
  const py = pointer.active ? Math.sin(ang) * 1.6 : 0;

  if (window.DBD_CROP_RENDERER && window.DBD_CROP_RENDERER.drawRegionalCrop(ctx, c, def, breeze, tNow, shocked, cursorNear, px, py, gpLeaf)) {
    return;
  }

  /* ------------------------------------------------------------------------
     1. RUNAWAY RADISH (r: 16 — Tiny, Caffeinated, Googly-Eyed Runner)
     ------------------------------------------------------------------------ */
  if (type === 'radish'){
    const fast = Math.hypot(c.vx, c.vy) > 25 || cursorNear || shocked;
    if (fast){
      const kick = reduceMotion ? 0 : Math.sin(tNow * 30) * 4;
      ctx.strokeStyle = '#9f1239';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, -1); ctx.lineTo(-5.5 + kick, 7);
      ctx.moveTo(4, -1);  ctx.lineTo(5.5 - kick, 7);
      ctx.stroke();
    }

    for (let i = -1; i <= 1; i++){
      ctx.save();
      ctx.translate(0, -r * 1.45);
      ctx.rotate(i * 0.48 + leafLag);
      ctx.fillStyle = i === 0 ? def.leaf : def.leafDark;
      ell(ctx, 0, -8.5, 4.5, 10);
      ctx.restore();
    }

    ctx.fillStyle = radial(ctx, -4, -r * 0.95, 1.5, 0, -r * 0.75, r, def.light, def.color);
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 1.6;
    circ(ctx, 0, -r * 0.8, r * 0.82);
    ctx.stroke();

    // Asymmetrical googly eyes
    ctx.fillStyle = '#fff';
    circ(ctx, -4.4, -r * 0.9, 4.1);
    circ(ctx, 4.4, -r * 0.9, 3.3);
    ctx.fillStyle = '#111827';
    circ(ctx, -4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.6);
    circ(ctx, 4.4 + px * 0.7, -r * 0.9 + py * 0.7, 1.3);

    if (c.panic > 0.2 || shocked || cursorNear){
      ctx.fillStyle = '#4c0519';
      ell(ctx, 0, -r * 0.45, 3.8, 3.0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2.5, -r * 0.45 - 2.6, 5, 1.5);
      ctx.fillRect(-2.5, -r * 0.45 + 1.1, 5, 1.5);
      // Sweat drop
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.moveTo(11, -r * 1.3);
      ctx.quadraticCurveTo(14, -r * 1.05, 11, -r * 1.0);
      ctx.quadraticCurveTo(8, -r * 1.05, 11, -r * 1.3);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#4c0519';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, -r * 0.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------------
     2. GYM-BRO CARROT (r: 19 — 80s Sweatband, Puffed Chest, Wince on Hit)
     ------------------------------------------------------------------------ */
  else if (type === 'carrot'){
    for (let i = -2; i <= 2; i++){
      ctx.save();
      ctx.translate(i * 1.8, -r * 1.38);
      ctx.rotate(i * 0.27 + leafLag);
      ctx.fillStyle = i % 2 === 0 ? def.leaf : def.leafDark;
      ell(ctx, 0, -12, 4, 13);
      ctx.restore();
    }

    ctx.fillStyle = radial(ctx, -4, -r, 2, 0, -r * 0.7, r * 1.2, def.light, def.color);
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 1.15);
    ctx.bezierCurveTo(-r * 0.74, -r * 1.5, r * 0.74, -r * 1.5, r * 0.7, -r * 1.15);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.28, r * 0.2, 2);
    ctx.lineTo(-r * 0.2, 2);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.28, -r * 0.7, -r * 1.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red & White Gym Sweatband
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-r * 0.69, -r * 1.28, r * 1.38, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 0.69, -r * 1.28 + 1.6, r * 1.38, 1.7);

    if (shocked){
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, -r * 1.0); ctx.lineTo(-2.5, -r * 0.88); ctx.lineTo(-7, -r * 0.76);
      ctx.moveTo(7, -r * 1.0);  ctx.lineTo(2.5, -r * 0.88);  ctx.lineTo(7, -r * 0.76);
      ctx.stroke();
    } else {
      for (const ex of [-4.8, 4.8]){
        ctx.fillStyle = '#fff';
        circ(ctx, ex, -r * 0.88, 3.2);
        ctx.fillStyle = '#292524';
        circ(ctx, ex + px * 0.55, -r * 0.88 + py * 0.55, 1.6);
      }
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-8, -r * 1.03); ctx.lineTo(-2, -r * 0.98);
      ctx.moveTo(8, -r * 1.03);  ctx.lineTo(2, -r * 0.98);
      ctx.stroke();

      ctx.beginPath();
      if (cursorNear){
        ctx.arc(0, -r * 0.55, 2.2, 0, Math.PI * 2);
      } else {
        ctx.arc(0, -r * 0.6, 3.8, 0.1 * Math.PI, 0.85 * Math.PI);
      }
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------------
     3. VIP GOLDEN CORN (r: 22 — Aviator Shades & Magnificent Flowing Corn-Silk Beard!)
     ------------------------------------------------------------------------ */
  else if (type === 'golden'){
    ctx.fillStyle = radial(ctx, 0, -r, 2, 0, -r, r * 1.65, 'rgba(254,240,138,.45)', 'rgba(254,240,138,0)');
    circ(ctx, 0, -r, r * 1.65);

    // Outer peeled-back green husk cape cradling the base of the cob
    for (const dir of [-1, 1]){
      ctx.save();
      ctx.translate(dir * 6, -4);
      ctx.rotate(dir * 0.52 + leafLag * 0.6);
      ctx.fillStyle = '#15803d';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(dir * 10, -r * 0.55, dir * 14, -r * 1.05);
      ctx.quadraticCurveTo(dir * 2, -r * 0.75, -dir * 3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const cobW = r * 0.62, cobH = r * 1.15;
    ctx.fillStyle = radial(ctx, -4, -r * 1.25, 2, 0, -r, cobH, '#fef9c3', '#eab308');
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 1.8;
    ell(ctx, 0, -r * 1.04, cobW, cobH);
    ctx.stroke();

    // Plump golden kernel rows
    ctx.fillStyle = 'rgba(161, 98, 7, 0.28)';
    for (let row = -3; row <= 2; row++){
      for (let col = -1; col <= 1; col++){
        circ(ctx, col * 5.0 + (row % 2 ? 1.8 : 0), -r * 1.12 + row * 4.8, 1.7);
      }
    }

    // Silky top hair tuft
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.moveTo(s * 3, -r * 2.15);
      ctx.quadraticCurveTo(s * 8 + breeze * 18, -r * 2.45, s * 11 + breeze * 25, -r * 2.25);
      ctx.stroke();
    }

    const shadeDrop = shocked ? 6.5 : (cursorNear ? 3.2 : 0);
    const shadeTilt = shocked ? 0.28 : (cursorNear ? -0.1 : 0);
    if (shadeDrop > 0){
      for (const ex of [-4.8, 4.8]){
        ctx.fillStyle = '#fff';
        circ(ctx, ex, -r * 1.28, 3.3);
        ctx.fillStyle = '#111';
        circ(ctx, ex + px * 0.5, -r * 1.28 + py * 0.5, 1.5);
      }
    }

    // Aviator Sunglasses
    ctx.save();
    ctx.translate(0, -r * 1.22 + shadeDrop);
    ctx.rotate(shadeTilt);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(11, -2); ctx.stroke();
    ctx.fillStyle = '#0f172a'; ctx.strokeStyle = '#eab308'; ctx.lineWidth = 1.3;
    for (const lx of [-5.5, 5.5]){
      ctx.beginPath(); ctx.roundRect(lx - 4.8, -3, 9.6, 6.6, [1, 1, 3.8, 3.8]); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(lx - 2.2, -1.3); ctx.lineTo(lx + 1.4, 2.0); ctx.stroke();
      ctx.strokeStyle = '#eab308';
    }
    ctx.restore();

    // MAGNIFICENT FLOWING CORN-SILK BEARD & MUSTACHE!
    const beardFlip = shocked ? -0.35 : breeze * 1.4;
    ctx.save();
    ctx.translate(0, -r * 0.82);
    ctx.rotate(beardFlip);

    // Flowing golden-cream corn-silk beard
    const bGrad = ctx.createLinearGradient(0, 0, 0, r * 0.95);
    bGrad.addColorStop(0, '#fffbeb');
    bGrad.addColorStop(0.6, '#fef08a');
    bGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = bGrad;
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.bezierCurveTo(-14, r * 0.45, -7, r * 0.85, 0, r * 1.02);
    ctx.bezierCurveTo(7, r * 0.85, 14, r * 0.45, 11, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wavy beard silk strands
    ctx.strokeStyle = 'rgba(161, 98, 7, 0.35)';
    ctx.lineWidth = 1.1;
    for (const bx of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(bx, 3);
      ctx.quadraticCurveTo(bx + 2, r * 0.45, bx * 0.4, r * 0.82);
      ctx.stroke();
    }

    // Golden Viking beard clasp bead near the bottom
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#78350f';
    ctx.beginPath(); ctx.roundRect(-3.5, r * 0.68, 7, 3.5, 1.5); ctx.fill(); ctx.stroke();

    // Sweeping handlebar corn-silk mustache on top of the beard!
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.3;
    ell(ctx, -6.5, 0, 7.5, 3.2, -0.25); ctx.stroke();
    ell(ctx, 6.5, 0, 7.5, 3.2, 0.25); ctx.stroke();

    if (shocked) {
      ctx.fillStyle = '#451a03';
      circ(ctx, 0, 3.5, 3.2);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     4. LORD CABBAGE (r: 28 — Aristocrat, Leaf Mustache & Popping Monocle)
     ------------------------------------------------------------------------ */
  else if (type === 'cabbage'){
    for (let i = 0; i < 6; i++){
      const a = (i / 6) * Math.PI * 2;
      ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#15803d';
      ell(ctx, Math.cos(a) * r * 0.55, -r * 0.45 + Math.sin(a) * r * 0.24, r * 0.46, r * 0.32, a * 0.3);
    }

    ctx.fillStyle = radial(ctx, -7, -r * 0.92, 3, 0, -r * 0.66, r, '#ecfccb', '#4ade80');
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 2;
    ell(ctx, 0, -r * 0.66, r * 0.85, r * 0.76);
    ctx.stroke();

    ctx.fillStyle = 'rgba(244, 63, 94, 0.26)';
    ell(ctx, -11, -r * 0.54, 4.2, 2.4);
    ell(ctx, 11, -r * 0.54, 4.2, 2.4);

    for (const ex of [-7.5, 7.5]){
      ctx.fillStyle = '#fff';
      circ(ctx, ex, -r * 0.7, 3.9);
      ctx.fillStyle = '#14532d';
      circ(ctx, ex + px * 0.65, -r * 0.7 + py * 0.65, 1.9);
    }

    const browLift = (shocked || cursorNear) ? -3 : 0;
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, -r * 0.88 + browLift);
    ctx.quadraticCurveTo(-5, -r * 0.78 + browLift, 0, -r * 0.82 + browLift);
    ctx.quadraticCurveTo(5, -r * 0.78 + browLift, 13, -r * 0.88 + browLift);
    ctx.stroke();

    // Leaf handlebar mustache
    ctx.fillStyle = '#15803d';
    ell(ctx, -5, -r * 0.45, 6, 2.6, -0.24);
    ell(ctx, 5, -r * 0.45, 6, 2.6, 0.24);

    if (shocked || cursorNear){
      ctx.fillStyle = '#052e16';
      circ(ctx, 0, -r * 0.33, 3.3);
    }

    // Gold Monocle on chain
    const popOff = c.monoclePop > 0 ? Math.sin(c.monoclePop * Math.PI) * 14 : (cursorNear ? 3.5 : 0);
    const mx = 7.5 + popOff * 0.5, my = -r * 0.7 - popOff;
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(13, -r * 0.34);
    ctx.quadraticCurveTo(17, -r * 0.48, mx + 5, my);
    ctx.stroke();

    ctx.fillStyle = 'rgba(254, 249, 195, 0.35)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.8;
    circ(ctx, mx, my, 5.4);
    ctx.stroke();
  }

  /* ------------------------------------------------------------------------
     5. COUCH POTATO (r: 36 — Cozy Beanbag Shape, Nightcap ON TOP, Snot Bubble)
     ------------------------------------------------------------------------ */
  else if (type === 'potato'){
    // Symmetric-top, chubby-bottom cozy beanbag potato silhouette!
    ctx.fillStyle = radial(ctx, -10, -r * 0.88, 3, 0, -r * 0.55, r * 1.15, def.light, '#a86b32');
    ctx.strokeStyle = def.shade;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.16); // Top crown of head
    ctx.bezierCurveTo(r * 0.65, -r * 1.16, r * 1.02, -r * 0.68, r * 0.96, -r * 0.25);
    ctx.bezierCurveTo(r * 0.90, r * 0.08, -r * 0.90, r * 0.08, -r * 0.96, -r * 0.25);
    ctx.bezierCurveTo(-r * 1.02, -r * 0.68, -r * 0.65, -r * 1.16, 0, -r * 1.16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle potato freckles
    ctx.fillStyle = 'rgba(110, 66, 25, 0.26)';
    [[-18, -12, 2.2], [19, -14, 2.0], [-14, -28, 1.6], [15, -30, 1.8]].forEach(([dx, dy, dr]) => circ(ctx, dx, dy, dr));

    // Face: Asleep with snot bubble OR Woken up in rage!
    if (shocked){
      for (const ex of [-9.5, 9.5]){
        ctx.fillStyle = '#fff';
        circ(ctx, ex, -r * 0.64, 4.8);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#1c1917';
        circ(ctx, ex + px * 0.6, -r * 0.64 + py * 0.6, 2.1);
      }
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-15, -r * 0.80); ctx.lineTo(-4, -r * 0.72);
      ctx.moveTo(15, -r * 0.80);  ctx.lineTo(4, -r * 0.72);
      ctx.stroke();
      ctx.fillStyle = '#451a03';
      ell(ctx, 0, -r * 0.36, 5, 3.6);
    } else {
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (const ex of [-9.5, 9.5]){
        ctx.beginPath();
        ctx.arc(ex, -r * 0.64, 4.0, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
      ell(ctx, -16, -r * 0.50, 4.5, 2.5);
      ell(ctx, 16, -r * 0.50, 4.5, 2.5);

      ctx.fillStyle = '#451a03';
      circ(ctx, 0, -r * 0.40, 2.5);

      // Expanding & contracting Sleep Snot Bubble
      const bubbleR = 5.0 + (reduceMotion ? 0 : Math.sin(tNow * 3.2 + c.wob) * 2.8);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
      ctx.lineWidth = 1.3;
      circ(ctx, 5 + bubbleR * 0.55, -r * 0.46 - bubbleR * 0.25, bubbleR);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      circ(ctx, 5 + bubbleR * 0.25, -r * 0.46 - bubbleR * 0.55, bubbleR * 0.25);
    }

    // Striped Nightcap sitting RIGHT ON TOP OF ITS HEAD!
    const capLift = c.capBounce > 0 ? Math.sin(c.capBounce * Math.PI) * 16 : 0;
    ctx.save();
    ctx.translate(0, -capLift);

    // Nightcap cone perched on the top crown (-r * 1.12) and drooping to the right
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, -r * 1.05);
    ctx.quadraticCurveTo(-r * 0.15, -r * 1.68, r * 0.72, -r * 1.22); // Floppy tip to the side
    ctx.quadraticCurveTo(r * 0.42, -r * 1.10, r * 0.58, -r * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Decorative cream stripe on cap
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 1.35);
    ctx.lineTo(r * 0.22, -r * 1.12);
    ctx.stroke();

    // Fluffy cream headband brim right across the top forehead
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#d6c7b2';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-r * 0.62, -r * 1.14, r * 1.24, 8.5, 4.5);
    ctx.fill();
    ctx.stroke();

    // Fluffy white pom-pom at the drooping tip
    ctx.fillStyle = '#fffbeb';
    circ(ctx, r * 0.74, -r * 1.21, 5.5);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     6. DRAMA-QUEEN ONION (r: 24 — Posh Opera Diva When Peaceful, Bawls Fountains ONLY When Smacked!)
     ------------------------------------------------------------------------ */
  else if (type === 'onion'){
    for (let i = -1; i <= 1; i++){
      ctx.save(); ctx.translate(i * 2.5, -r * 1.25); ctx.rotate(i * 0.25 + leafLag + (shocked ? Math.sin(tNow * 35) * 0.25 : 0));
      ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a';
      ell(ctx, 0, -9, 3.2, 10);
      ctx.restore();
    }
    ctx.fillStyle = radial(ctx, -6, -r * 0.85, 2, 0, -r * 0.58, r * 1.05, '#f3e8ff', '#9333ea');
    ctx.strokeStyle = '#581c87'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.32);
    ctx.bezierCurveTo(r * 0.45, -r * 1.05, r * 0.95, -r * 0.82, r * 0.92, -r * 0.35);
    ctx.bezierCurveTo(r * 0.88, r * 0.05, -r * 0.88, r * 0.05, -r * 0.92, -r * 0.35);
    ctx.bezierCurveTo(-r * 0.95, -r * 0.82, -r * 0.45, -r * 1.05, 0, -r * 1.32);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Theatrical ribbon bow (pops up when smacked!)
    const bowLift = shocked ? Math.sin(c.eye * Math.PI) * 9 : 0;
    ctx.save();
    ctx.translate(0, -bowLift);
    ctx.fillStyle = '#f43f5e';
    ell(ctx, -6, -r * 1.15, 5.5, 3.2, -0.3);
    ell(ctx, 6, -r * 1.15, 5.5, 3.2, 0.3);
    ctx.fillStyle = '#fda4af'; circ(ctx, 0, -r * 1.15, 2.5);
    ctx.restore();

    if (shocked) {
      // SMACKED STATE: Scrunched '> <' bawling eyes + gushing fountain of blue tears + wide wailing mouth!
      ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9.5, -r * 0.70); ctx.lineTo(-4.2, -r * 0.62); ctx.lineTo(-9.5, -r * 0.54);
      ctx.moveTo(9.5, -r * 0.70);  ctx.lineTo(4.2, -r * 0.62);  ctx.lineTo(9.5, -r * 0.54);
      ctx.stroke();

      // Twin fountains of cartoon tears spraying sideways and down!
      const tearPhase = (tNow * 24) % 1;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.88)';
      for (const dir of [-1, 1]) {
        ell(ctx, dir * 6.5, -r * 0.45, 2.4, 5.5, dir * 0.15);
        circ(ctx, dir * (9 + tearPhase * 8), -r * 0.62 + tearPhase * 10, 2.4);
        circ(ctx, dir * (7 + tearPhase * 5), -r * 0.30 + tearPhase * 8, 2.0);
      }
      // Huge wailing mouth with tongue
      ctx.fillStyle = '#3b0764'; ell(ctx, 0, -r * 0.30, 5.6, 4.8);
      ctx.fillStyle = '#fb7185'; ell(ctx, 0, -r * 0.22, 3.6, 2.0);
    } else if (cursorNear) {
      // CURSOR NEAR: Dramatic gasp!
      for (const ex of [-6.2, 6.2]){
        ctx.fillStyle = '#fff'; circ(ctx, ex, -r * 0.62, 4.0);
        ctx.fillStyle = '#1e1b4b'; circ(ctx, ex + px * 0.5, -r * 0.62 + py * 0.5, 1.6);
      }
      ctx.fillStyle = '#3b0764'; circ(ctx, 0, -r * 0.33, 3.0);
    } else {
      // PEACEFUL IDLE: Posh snooty opera diva with closed lashed eyes & rosy cheeks (NO tears!)
      ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      for (const ex of [-6.2, 6.2]) {
        ctx.beginPath(); ctx.arc(ex, -r * 0.62, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        // Posh eyelashes
        ctx.beginPath(); ctx.moveTo(ex + (ex < 0 ? -3.5 : 3.5), -r * 0.60); ctx.lineTo(ex + (ex < 0 ? -5.5 : 5.5), -r * 0.66); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
      ell(ctx, -10.5, -r * 0.48, 3.5, 2.0); ell(ctx, 10.5, -r * 0.48, 3.5, 2.0);
      // Cute smug smile
      ctx.beginPath(); ctx.arc(0, -r * 0.38, 3.0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------------
     7. BRIAR-BERRY TWINS (r: 25 — Cheeky When Peaceful, Bonk Heads & Scream When Smacked!)
     ------------------------------------------------------------------------ */
  else if (type === 'berry'){
    const bonk = shocked ? Math.sin(tNow * 40) * 2.5 : 0;
    ctx.strokeStyle = '#15803d'; ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-9, -r * 0.65); ctx.quadraticCurveTo(0, -r * 1.45 - (shocked ? 6 : 0), 9, -r * 0.65);
    ctx.stroke();
    gpLeaf(ctx, 0, -r * 1.25 - (shocked ? 4 : 0), 0.4 + leafLag + (shocked ? 0.5 : 0), 0.85);

    for (const [baseBx, baseBy, cheeky] of [[-8.5, -r * 0.52, false], [8.5, -r * 0.48, true]]){
      const bob = reduceMotion ? 0 : Math.sin(tNow * 5.5 + (cheeky ? 2.2 : 0)) * 1.4;
      const bx = baseBx + (shocked ? (cheeky ? -2.2 : 2.2) + bonk : 0);
      const by = baseBy + (shocked ? -2 : bob);

      ctx.fillStyle = radial(ctx, bx - 3, by - 4, 1, bx, by, 12.5, shocked ? '#fca5a5' : '#c7d2fe', '#4338ca');
      ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 1.6;
      circ(ctx, bx, by, 11.2); ctx.stroke();

      if (shocked) {
        // SMACKED STATE: Dizzy '><' X-eyes & screaming mouths!
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1.8;
        for (const ex of [-3.5, 3.5]) {
          ctx.beginPath();
          ctx.moveTo(bx + ex - 1.8, by - 3.8); ctx.lineTo(bx + ex + 1.8, by - 0.2);
          ctx.moveTo(bx + ex + 1.8, by - 3.8); ctx.lineTo(bx + ex - 1.8, by - 0.2);
          ctx.stroke();
        }
        ctx.fillStyle = '#0f172a';
        ell(ctx, bx, by + 3.5, 3.6, 3.0);
        ctx.fillStyle = '#fb7185';
        ell(ctx, bx, by + 4.5, 2.2, 1.2);
      } else if (cursorNear) {
        // CURSOR NEAR: Wide nervous eyes + trembling mouth
        for (const ex of [-3.4, 3.4]){
          ctx.fillStyle = '#fff'; circ(ctx, bx + ex, by - 2, 2.9);
          ctx.fillStyle = '#0f172a'; circ(ctx, bx + ex + px * 0.4, by - 2 + py * 0.4, 1.1);
        }
        ctx.strokeStyle = '#e0e7ff'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(bx, by + 4.2, 2.2, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        // PEACEFUL IDLE: Happy / winking twin berries!
        for (const ex of [-3.4, 3.4]){
          if (cheeky && ex > 0) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(bx + ex - 2, by - 2); ctx.lineTo(bx + ex + 2, by - 2); ctx.stroke();
          } else {
            ctx.fillStyle = '#fff'; circ(ctx, bx + ex, by - 2, 2.5);
            ctx.fillStyle = '#0f172a'; circ(ctx, bx + ex + px * 0.4, by - 2 + py * 0.4, 1.2);
          }
        }
        if (cheeky){
          ctx.fillStyle = '#fb7185';
          ell(ctx, bx + 1, by + 3.8, 2.6, 2.0, 0.2);
        } else {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(bx, by + 2, 2.8, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }
      }
    }
    if (shocked) {
      // Cartoon impact star between their bonking heads!
      ctx.fillStyle = '#fde047';
      circ(ctx, 0, -r * 0.72, 3.5);
    }
  }

  /* ------------------------------------------------------------------------
     8. GRANDMA PUMPKIN (r: 44 — Crochets a Flat Beret Hat, Wears It, Then Crochets a Cozy Striped Scarf!)
     ------------------------------------------------------------------------ */
  else if (type === 'pumpkin'){
    drawGrandmaPumpkin(ctx, {
      time: tNow + c.wob,
      action: shocked ? clamp(1 - c.eye / 0.85, 0.05, 0.95) : -1,
      hatProgress: c.hatProgress || 0,
      scarfProgress: c.scarfProgress || 0,
      lookX: px,
      radius: r
    });
  }
}

/* Grandma Pumpkin helpers: Flat Pancake Beret Hat & Cozy Striped Scarf */
const TAU = Math.PI * 2;
function gpLine(g, cmds, col, w = 1) {
  g.beginPath();
  for (const p of cmds) {
    if (p[0] === 'M') g.moveTo(p[1], p[2]);
    else if (p[0] === 'L') g.lineTo(p[1], p[2]);
    else if (p[0] === 'Q') g.quadraticCurveTo(p[1], p[2], p[3], p[4]);
    else g.bezierCurveTo(p[1], p[2], p[3], p[4], p[5], p[6]);
  }
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}
function gpOval(g, x, y, rx, ry, col, ang = 0) {
  g.beginPath(); g.ellipse(x, y, rx, ry, ang, 0, TAU); g.fillStyle = col; g.fill();
}
function gpLeaf(g, x, y, ang, sz = 1) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(sz, sz);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-7, -6, -1, -13); g.quadraticCurveTo(9, -9, 0, 0);
  g.fillStyle = '#65c45a'; g.fill(); g.strokeStyle = '#397b35'; g.lineWidth = 1.1; g.stroke();
  gpLine(g, [['M', 0, -1], ['Q', 1, -6, -1, -10]], '#b8e78e', 0.85);
  g.restore();
}
function gpHook(g, gx, gy, tx, ty) {
  const ang = Math.atan2(ty - gy, tx - gx), len = Math.hypot(tx - gx, ty - gy);
  g.save(); g.translate(gx, gy); g.rotate(ang);
  gpLine(g, [['M', -3.5, 0], ['L', len - 1, 0]], '#7b4b29', 3.4);
  gpLine(g, [['M', -3, -0.4], ['L', 6, -0.4]], '#e9ad64', 2.3);
  gpLine(g, [['M', 6, -0.3], ['L', len, -0.3], ['Q', len + 3.5, -0.3, len + 3, 2.6], ['Q', len + 2.4, 4.2, len + 0.7, 3]], '#ffe5a2', 1.9);
  g.restore();
}
function flatBeret(g, x, bottom, w, h, prog, onHead, t) {
  const half = w / 2, top = bottom - h;
  g.save();
  const col = g.createLinearGradient(x, top, x, bottom);
  col.addColorStop(0, '#a7ece0'); col.addColorStop(0.65, '#5ec2b7'); col.addColorStop(1, '#358c86');
  g.beginPath();
  g.moveTo(x - half * 0.92, bottom);
  g.bezierCurveTo(x - half * 1.18, bottom - h * 0.12, x - half * 1.12, top + h * 0.08, x - half * 0.52, top);
  g.quadraticCurveTo(x, top - 1.2, x + half * 0.54, top + 0.4);
  g.bezierCurveTo(x + half * 1.14, top + h * 0.12, x + half * 1.20, bottom + 1.2, x + half * 0.90, bottom + 0.4);
  g.quadraticCurveTo(x, bottom - 2.2, x - half * 0.92, bottom);
  g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = '#286c68'; g.lineWidth = 1.25; g.stroke();

  const rows = Math.max(1, Math.floor(1 + prog * 3));
  for (let r = 0; r < rows; r++) {
    const py = bottom - 2.6 - r * 2.5;
    if (py < top + 1.2) continue;
    const reach = half * (0.88 - r * 0.11);
    for (let px = x - reach + 2; px < x + reach - 2; px += 4.5)
      gpLine(g, [['M', px - 1.4, py - 0.5], ['L', px, py + 0.7], ['L', px + 1.4, py - 0.5]], '#d2f7ef', 0.85);
  }
  if (onHead) {
    const cw = half * 0.88;
    g.beginPath();
    g.moveTo(x - cw, bottom - 3.0); g.quadraticCurveTo(x, bottom - 4.8, x + cw, bottom - 2.6);
    g.lineTo(x + cw, bottom + 1.2); g.quadraticCurveTo(x, bottom - 0.8, x - cw, bottom + 0.8);
    g.closePath(); g.fillStyle = '#c4a7e7'; g.fill(); g.strokeStyle = '#7c5d9e'; g.lineWidth = 1.1; g.stroke();
    for (let px = x - cw + 3; px < x + cw - 2; px += 3.8)
      gpLine(g, [['M', px, bottom - 3.0], ['L', px, bottom + 0.4]], '#efe3fc', 0.85);
    gpOval(g, 9, bottom - 4.6, 5.5, 2.0, '#286c68', -0.1);
    const pomX = x - half * 0.55, pomY = top - 1.2 + Math.sin(t * 4.5) * 0.6;
    gpOval(g, pomX, pomY, 5.2, 3.8, '#d8b4fe', -0.2);
    gpOval(g, pomX - 1.5, pomY - 1.0, 1.8, 1.0, '#faf5ff');
  }
  g.restore();
}
function grandmaScarf(g, prog, onNeck, t, wob) {
  g.save();
  if (!onNeck) {
    const w = 10 + prog * 36, h = 4.5 + prog * 5.5, left = -1 - w / 2, top = -9 - h;
    g.beginPath(); g.roundRect(left, top, w, h, 3);
    g.fillStyle = '#f43f5e'; g.fill(); g.strokeStyle = '#9f1239'; g.lineWidth = 1.2; g.stroke();
    const stripes = Math.floor(prog * 6);
    for (let i = 0; i < stripes; i++) {
      const sx = left + 5 + i * 6.2;
      if (sx + 2.5 < left + w - 2) { g.fillStyle = i % 2 === 0 ? '#fef08a' : '#fda4af'; g.fillRect(sx, top + 1, 2.5, h - 2); }
    }
  } else {
    const sway = Math.sin(t * 3.2) * 2.2 + wob * 4;
    g.beginPath();
    g.moveTo(-40, -17); g.quadraticCurveTo(0, -8, 40, -17);
    g.quadraticCurveTo(43, -10, 38, -5); g.quadraticCurveTo(0, 4, -38, -5); g.quadraticCurveTo(-43, -10, -40, -17);
    g.closePath(); g.fillStyle = '#e11d48'; g.fill(); g.strokeStyle = '#881337'; g.lineWidth = 1.4; g.stroke();
    for (let sx = -30; sx <= 30; sx += 10) gpLine(g, [['M', sx, -14], ['L', sx, -3]], '#fef08a', 2.2);
    for (const [idx, ox, len] of [[0, 16, 22], [1, 25, 18]]) {
      g.save(); g.translate(ox, -6); g.rotate((idx === 0 ? 0.12 : -0.08) + sway * 0.04);
      g.beginPath(); g.roundRect(-5.5, 0, 11, len, 3);
      g.fillStyle = idx === 0 ? '#f43f5e' : '#e11d48'; g.fill(); g.strokeStyle = '#881337'; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = '#fef08a'; g.fillRect(-4.8, len - 6.5, 9.6, 3);
      for (let tx = -4; tx <= 4; tx += 2.6) gpLine(g, [['M', tx, len], ['L', tx + sway * 0.25, len + 4.5]], '#fef08a', 1.2);
      g.restore();
    }
  }
  g.restore();
}
function drawGrandmaPumpkin(g, s = {}) {
  const t = s.time || 0, action = s.action ?? -1;
  const hatP = clamp(s.hatProgress || 0, 0, 1), scarfP = clamp(s.scarfProgress || 0, 0, 1);
  const hatDone = hatP >= 1, scarfDone = scarfP >= 1, allDone = hatDone && scarfDone;
  const hit = action >= 0 && action < 1, startled = hit && action < 0.58;
  const wob = hit ? Math.sin(action * 20) * Math.exp(-action * 5) : 0;
  const stitch = allDone || hit ? 0 : Math.sin(t * TAU * 2.8);
  const breathe = hit ? 0 : Math.sin(t * 2) * 0.45;
  const glassesLift = hit ? Math.sin(Math.min(1, action / 0.6) * Math.PI) * 5.5 : 0;
  const hatBounce = hit ? Math.sin(Math.min(1, action / 0.55) * Math.PI) * 12 : 0;

  g.save();
  const sc = (s.radius || 44) / 48;
  g.scale(sc, sc);

  const paint = g.createRadialGradient(-17, -51, 2, 0, -29, 60);
  paint.addColorStop(0, '#fdc07e'); paint.addColorStop(0.64, '#f98428'); paint.addColorStop(1, '#df641b');
  g.beginPath(); g.moveTo(0, -65);
  g.bezierCurveTo(-10, -70, -20, -68, -28, -61); g.bezierCurveTo(-42, -61, -50, -48, -50, -33);
  g.bezierCurveTo(-51, -18, -41, -5, -29, -3); g.quadraticCurveTo(-14, 2, 0, 0); g.quadraticCurveTo(15, 3, 29, -3);
  g.bezierCurveTo(44, -7, 51, -20, 50, -35); g.bezierCurveTo(50, -49, 41, -61, 28, -61);
  g.bezierCurveTo(19, -69, 9, -69, 0, -65); g.closePath();
  g.fillStyle = paint; g.fill(); g.strokeStyle = '#a4471b'; g.lineWidth = 1.7; g.stroke();
  for (const side of [-1, 1]) {
    gpLine(g, [['M', side * 16, -65], ['C', side * 30, -52, side * 30, -18, side * 20, -2]], '#d16b28', 1.1);
    gpLine(g, [['M', side * 31, -59], ['C', side * 43, -45, side * 42, -20, side * 34, -7]], '#dc7832', 0.8);
  }

  const drawStem = () => {
    g.save(); g.translate(9, -65 + breathe - hatBounce * 0.35); g.rotate(wob * 0.1);
    g.beginPath(); g.moveTo(-4, 2); g.quadraticCurveTo(-5, -10, 1, -17); g.lineTo(6, -15); g.quadraticCurveTo(0, -8, 4, 2); g.closePath();
    g.fillStyle = '#75bd57'; g.fill(); g.strokeStyle = '#347831'; g.lineWidth = 1.5; g.stroke();
    gpLeaf(g, 2, -7, 0.95, 0.95); g.restore();
  };
  if (!hatDone) drawStem();
  else {
    g.save(); g.translate(0, -hatBounce + breathe); flatBeret(g, -2, -59, 64, 9.8, 1, true, t); g.restore();
    drawStem();
  }

  const eyeY = -39 + breathe;
  for (const [x, r] of [[-9.5, 4.5], [9.5, 4]]) {
    gpOval(g, x, eyeY, r, startled ? r * 1.15 : r * 0.85, '#fffdf3');
    gpOval(g, x + (s.lookX || 0) * 0.6, eyeY + (startled ? 0 : 0.6), 1.65, 1.85, '#342b22');
  }
  g.save(); g.translate(0, -glassesLift); g.rotate(wob * 0.045);
  for (const x of [-10, 10]) { g.beginPath(); g.arc(x, eyeY + 2.2, 7.2, 0, TAU); g.strokeStyle = '#725244'; g.lineWidth = 1.25; g.stroke(); }
  gpLine(g, [['M', -2.8, eyeY + 1.6], ['Q', 0, eyeY - 0.5, 2.8, eyeY + 1.6]], '#725244', 1.1);
  g.restore();

  gpOval(g, -18, -29, 3.8, 1.9, 'rgba(225,91,48,.28)'); gpOval(g, 18, -29, 3.8, 1.9, 'rgba(225,91,48,.28)');
  if (startled) gpOval(g, 0, -26, 2.9, 3.6, '#63351f');
  else gpLine(g, [['M', -4.2, -27], ['Q', 0, allDone ? -20.5 : -23.5, 4.2, -27]], '#63351f', 1.35);

  if (scarfDone) grandmaScarf(g, 1, true, t, wob);

  const isScarf = hatDone && !scarfDone, ballX = 58, ballY = -3 - Math.abs(stitch) * 0.8;
  const yMain = isScarf ? '#fb7185' : '#b29acb', yStr = isScarf ? '#9f1239' : '#816895';
  gpLine(g, [['M', ballX - 7, ballY + 1], ['C', 39, 6, 37, -2, 30, -5], ['Q', 23, -8, allDone ? 27 : 13, allDone ? -5 : -12]], yStr, 1.25);
  gpOval(g, ballX, ballY + 1, 8.4, 8.4, yMain);

  const handY = allDone ? -12 : -10 + stitch * 0.85, rightX = allDone ? 29 : 27 + stitch * 0.85;
  gpLine(g, [['M', -37, -25], ['C', -44, -11, -31, -5, -17, handY]], '#3b8138', 4);
  gpLine(g, [['M', 38, -24], ['Q', 43, -8, rightX, handY - 2]], '#3b8138', 4);

  if (!hatDone) {
    const cw = 8 + hatP * 38, ch = 2.0 + hatP * 6.8;
    flatBeret(g, -1, -7, cw, ch, hatP, false, t);
    gpHook(g, rightX, handY - 2, clamp(cw / 2 - 3, 1, 16) + stitch * 1.6, -7 - ch + 1 + stitch * 1.3);
  } else if (!scarfDone) {
    grandmaScarf(g, scarfP, false, t, wob);
    gpHook(g, rightX, handY - 2, clamp((10 + scarfP * 36) * 0.5 - 2, 2, 17) + stitch * 1.6, -14 + stitch * 1.4);
  } else {
    gpHook(g, 28, handY - 1, 44, handY - 5);
  }
  gpLeaf(g, -17, handY + 2, 0.9, 0.6); gpLeaf(g, rightX, handY + 1, -0.3, 0.6);
  g.restore();
}

function drawCrop(c){
  if (c.age <= 0) return;
  const def = CROP[c.type];
  if (!def) return;

  drawDirtMound(c);

  const [sx, sy] = getCropScales(c);
  // Heavier crops sway slightly less in the breeze than tiny ones
  const weightDamp = 26 / (c.r + 10);
  const breeze = reduceMotion ? 0 : (
    Math.sin(tNow * 2.2 + c.x * 0.008 + c.wob) * 0.065 +
    Math.sin(tNow * 4.8 + c.wob * 1.7) * 0.02
  ) * weightDamp + (c.panic > 0.3 ? Math.sin(tNow * 32) * 0.07 : 0);

  ctx.save();
  ctx.translate(c.x, c.y + 2);

  if (c.lucky){
    const pulse = reduceMotion ? 1 : 1 + Math.sin(tNow * 5 + c.wob) * 0.09;
    ctx.save();
    ctx.scale(c.ds, c.ds);
    ctx.fillStyle = radial(ctx, 0, -18, 0, 0, -18, (c.r + 18) * pulse, 'rgba(255,233,123,.42)', 'rgba(255,222,105,0)');
    circ(ctx, 0, -18, (c.r + 18) * pulse);
    ctx.strokeStyle = 'rgba(255,225,116,.8)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 1, c.r * 1.05, c.r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.rotate(breeze + (c.wobbleAngle || 0));
  ctx.scale(sx, sy);

  if (c.stage === 1){
    drawStage1Sprout(c, def);
  } else if (c.stage === 2){
    drawStage2Bud(c, def, breeze);
  } else {
    drawStage3RipeCharacter(c, def, breeze);
  }

  if (c.frosted && c.stage >= 2){
    ctx.save();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.34)';
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 1.6;
    ell(ctx, 0, -c.r * 0.58, c.r * 0.92, c.r * 0.68);
    ctx.stroke();
    ctx.restore();
  }
  if (c.lucky && c.stage === 3){
    const starY = -def.top - 8, tw = reduceMotion ? 0 : tNow * 0.8;
    ctx.save();
    ctx.translate(0, starY);
    ctx.rotate(tw);
    ctx.fillStyle = '#fff3bf';
    ctx.beginPath();
    for (let i = 0; i < 8; i++){
      const a = i * Math.PI / 4, rr = i % 2 ? 2.2 : 5.5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawHpBar(c){
  if(c.hpShow<=0||c.dead||c.maxHp<=1.001)return;
  const w=Math.max(30, c.r * 1.1)*c.ds,x=c.x-w/2,y=c.y-CROP[c.type].top*c.ds-12,f=clamp(c.hp/c.maxHp,0,1);
  ctx.globalAlpha=Math.min(1,c.hpShow*2);ctx.fillStyle='rgba(37,37,27,.75)';ctx.beginPath();ctx.roundRect(x-2,y-2,w+4,8,4);ctx.fill();ctx.fillStyle=f>.5?'#b4dd8b':f>.25?'#f5ce74':'#ed9773';ctx.beginPath();ctx.roundRect(x,y,w*f,4,2);ctx.fill();ctx.globalAlpha=1;
}
function drawGoat(gt){
  const ds = depth(gt.y);
  const angry = !!gt.bumped;
  const freq = angry ? 28 : 10.5;
  const walk = reduceMotion ? 0 : Math.sin(gt.t * freq);
  const stride = reduceMotion ? 0 : Math.cos(gt.t * freq);
  const bounce = reduceMotion ? 0 : Math.abs(Math.sin(gt.t * freq)) * (angry ? 3.5 : 2.6);
  const hopY = (gt.hop || 0) > 0 ? Math.sin(gt.hop * Math.PI) * 14 : 0;

  ctx.save();
  ctx.translate(gt.x, gt.y - bounce - hopY);
  ctx.scale(ds * gt.dir, ds);

  // Back legs (articulated knee + dark cloven hoof)
  const drawLeg = (hipX, hipY, phase, back) => {
    const sw = Math.sin(gt.t * freq + phase) * (angry ? 7.5 : 4.5);
    const lift = Math.max(0, -Math.cos(gt.t * freq + phase)) * (angry ? 6 : 3.5);
    const kneeX = hipX + sw * 0.55 + 1.5;
    const kneeY = hipY + 9 - lift * 0.5;
    const footX = hipX + sw;
    const footY = -1.5 - lift + bounce;
    ctx.strokeStyle = back ? '#cbd5e1' : '#f1f5f9';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ell(ctx, footX + 1, footY + 0.5, 3.6, 2.1);
  };

  drawLeg(-14, -18, Math.PI, true);
  drawLeg(11, -18, 0, true);

  // Wagging fluffy white tail
  const tailWag = reduceMotion ? 0 : Math.sin(gt.t * (angry ? 32 : 12)) * (angry ? 0.35 : 0.25);
  ctx.save();
  ctx.translate(-25, -31);
  ctx.rotate((angry ? 0.45 : -0.35) + tailWag);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.3;
  ell(ctx, -4, -3, 7.5, 4.5, -0.3);
  ctx.stroke();
  circ(ctx, -8, -5, 4);
  ctx.restore();

  // Fluffy cloud-white wool body (scalloped wool puffs so it never looks like a plain oval!)
  ctx.fillStyle = radial(ctx, -6, -34, 3, 0, -25, 32, '#ffffff', angry ? '#ffe4e6' : '#e2e8f0');
  ctx.strokeStyle = angry ? '#fda4af' : '#cbd5e1';
  ctx.lineWidth = 1.6;
  ell(ctx, 0, -25, 26, 15.5, -0.03);
  ctx.stroke();

  const puffs = [
    [-18, -32, 8.5], [-9, -36, 9.5], [1, -37, 10], [11, -35, 9.5], [19, -30, 8.5],
    [-17, -18, 7.5], [-5, -15, 8.5], [7, -15, 8.5], [17, -18, 8.0]
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pr] = puffs[i];
    const puffJiggle = reduceMotion ? 0 : Math.sin(gt.t * freq * 2 + i) * (angry ? 1.2 : 0.5);
    ctx.fillStyle = i < 5 ? '#ffffff' : '#f1f5f9';
    circ(ctx, px, py + puffJiggle, pr * (angry ? 1.08 : 1));
  }
  // Subtle wool curl lines inside coat
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.2;
  for (const [cx, cy] of [[-10, -27], [2, -26], [11, -23]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0.2 * Math.PI, 1.3 * Math.PI);
    ctx.stroke();
  }

  // Front legs
  drawLeg(-6, -17, 0, false);
  drawLeg(17, -17, Math.PI, false);

  // Collar & swinging brass cowbell
  ctx.save();
  ctx.translate(18, -26);
  ctx.rotate(angry ? 0.25 : 0.05);
  ctx.fillStyle = cur && cur.treaty ? '#22c55e' : (angry ? '#dc2626' : '#3b82f6');
  ctx.beginPath();
  ctx.roundRect(-3, -6, 6, 15, 3);
  ctx.fill();
  const bellSwing = reduceMotion ? 0 : Math.sin(gt.t * freq) * 0.28;
  ctx.translate(2, 9);
  ctx.rotate(bellSwing);
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 2, 4.2, Math.PI, 0);
  ctx.lineTo(4.8, 6);
  ctx.lineTo(-4.8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head & Neck
  ctx.save();
  const headBob = reduceMotion ? 0 : Math.sin(gt.t * (angry ? 22 : 5.5)) * (angry ? 0.06 : 0.08);
  ctx.translate(22, angry ? -28 : -35);
  ctx.rotate((angry ? -0.42 : 0.08) + headBob);

  // Curved ridged cream horns
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1, -10);
  ctx.quadraticCurveTo(-9, -24, -17, -18);
  ctx.moveTo(5, -11);
  ctx.quadraticCurveTo(1, -26, -7, -23);
  ctx.stroke();
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-1, -10);
  ctx.quadraticCurveTo(-9, -24, -17, -18);
  ctx.moveTo(5, -11);
  ctx.quadraticCurveTo(1, -26, -7, -23);
  ctx.stroke();

  // Floppy white & pink ear that bounces
  const earFlop = reduceMotion ? 0 : Math.sin(gt.t * freq + 1.2) * 0.22;
  ctx.save();
  ctx.translate(-3, -7);
  ctx.rotate((angry ? -0.65 : -0.25) + earFlop);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ell(ctx, -6, 0, 7.5, 3.4, -0.15);
  ctx.stroke();
  ctx.fillStyle = '#fda4af';
  ell(ctx, -6, 0.3, 4.8, 1.7, -0.15);
  ctx.restore();

  // White goat head & snout
  ctx.fillStyle = radial(ctx, 4, -8, 1, 7, -2, 18, '#ffffff', '#e2e8f0');
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.4;
  ell(ctx, 6, -2, 12.5, 9.5, 0.05);
  ctx.stroke();
  ell(ctx, 14, 0, 7.5, 6.2, 0.12);
  ctx.stroke();

  // Fluffy top head tuft
  ctx.fillStyle = '#ffffff';
  circ(ctx, 2, -10, 4.5);
  circ(ctx, 6, -10.5, 4);

  // Pink nose & nostril
  ctx.fillStyle = angry ? '#f43f5e' : '#fda4af';
  ell(ctx, 19.5, -1, 2.4, 3.2, 0.15);
  ctx.fillStyle = '#881337';
  circ(ctx, 19.5, -1.2, 1.0);

  // Wagging white chin beard (goatee)
  const chew = reduceMotion ? 0 : Math.sin(gt.t * 9) * 1.4;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(9, 5 + chew * 0.4);
  ctx.quadraticCurveTo(11, 16 + chew, 15, 18 + chew);
  ctx.quadraticCurveTo(17, 12 + chew, 16, 5 + chew * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (!angry) {
    // PEACEFUL STATE: Big happy derpy goat eye + chewing a clover flower stem!
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.3;
    circ(ctx, 10.5, -4.8, 4.0);
    ctx.stroke();
    // Horizontal rectangular goat pupil (classic funny goat look!)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(8.8, -5.8, 3.6, 2.0, 0.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    circ(ctx, 11.4, -6.2, 1.0);

    // Happy curved smile + chewing clover stem
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(15.5, 1.5 + chew * 0.3, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Green clover stem & little yellow flower bobbing as it chews
    ctx.save();
    ctx.translate(18, 3 + chew * 0.4);
    ctx.rotate(0.25 + chew * 0.08);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(7, 2, 13, -1);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ell(ctx, 8, 1, 3, 1.6, -0.4);
    ctx.fillStyle = '#facc15';
    circ(ctx, 14, -1.5, 2.8);
    ctx.fillStyle = '#fef08a';
    circ(ctx, 14, -1.5, 1.2);
    ctx.restore();
  } else {
    // ANGRY STATE (Only when touched!): Glowing red eye, V-brow, gritted teeth & snorting steam puffs!
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1.6;
    circ(ctx, 10.5, -4.5, 4.3);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    circ(ctx, 11.2, -4.5, 2.1);
    ctx.fillStyle = '#ffffff';
    circ(ctx, 11.8, -5.2, 0.9);

    // Heavy slanted angry eyebrow
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(5.5, -9.5);
    ctx.lineTo(15.5, -6.2);
    ctx.stroke();

    // Open bleating angry mouth with teeth
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.roundRect(12.5, 1.2, 6.5, 4.2, 1.5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(13.5, 1.4, 4.5, 1.5);

    // Snorting steam puffs from nose
    const puffPhase = (gt.t * 4.5) % 1;
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - puffPhase) * 0.85})`;
    circ(ctx, 22 + puffPhase * 14, -2 - puffPhase * 6, 2.5 + puffPhase * 4.5);
    circ(ctx, 20 + puffPhase * 10, 1 - puffPhase * 3, 2.0 + puffPhase * 3.2);
  }

  ctx.restore();
  ctx.restore();
}

function drawPuddles(){
  for (const p of parts){
    if (p.k !== 'puddle') continue;
    ctx.globalAlpha = (p.life / p.max) * 0.55;
    ctx.fillStyle = p.c;
    ell(ctx, p.x, p.y, p.rx, p.ry);
  }
  ctx.globalAlpha = 1;
}

function drawParts(){
  for(const p of parts){
    if(p.k==='clod'){
      ctx.globalAlpha=Math.min(1, p.life / p.max * 2);
      ctx.fillStyle=p.c;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.beginPath();ctx.roundRect(-p.r, -p.r*0.8, p.r*2, p.r*1.6, 1.5);ctx.fill();
      ctx.restore();
    }
    else if(p.k==='leaf'){
      ctx.globalAlpha=Math.min(1, p.life / p.max * 1.8);
      ctx.fillStyle=p.c;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.beginPath();ctx.moveTo(-p.len,0);ctx.quadraticCurveTo(0,-p.wid,p.len,0);ctx.quadraticCurveTo(0,p.wid,-p.len,0);ctx.fill();
      ctx.restore();
    }
    else if(p.k==='juice'){
      const ang = Math.atan2(p.vy, p.vx);
      const stretch = Math.min(1.8, 1 + Math.hypot(p.vx, p.vy) * 0.002);
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);
      ctx.fillStyle = p.c;
      ell(ctx, 0, 0, p.r * stretch, p.r * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      circ(ctx, -p.r * 0.25, -p.r * 0.25, p.r * 0.3);
      ctx.restore();
    }
    else if(p.k==='half'){
      const def = CROP[p.type];
      const t = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.save();ctx.translate(p.x, p.y);ctx.rotate(p.rot);
      ctx.fillStyle = def.color;
      ctx.strokeStyle = def.shade;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI, p.side < 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner pale flesh cross-section
      ctx.fillStyle = def.flesh;
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.76, 0, Math.PI, p.side < 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    else if(p.k==='ring'){const t=1-p.life/p.max;ctx.globalAlpha=(1-t)*.65;ctx.strokeStyle=p.c;ctx.lineWidth=2*(1-t)+.5;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.4+t*.9),0,Math.PI*2);ctx.stroke();}
    else if(p.k==='dust'){ctx.globalAlpha=(p.life/p.max)*.4;ctx.fillStyle='#d1b285';circ(ctx,p.x,p.y,p.s*(1.6-p.life/p.max));}
    else if(p.k==='spark'){const t=p.life/p.max;ctx.globalAlpha=t;ctx.fillStyle='#fff3ba';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(reduceMotion?0:tNow*2);const s=p.s*(.5+t);ctx.beginPath();ctx.moveTo(-s,0);ctx.lineTo(-s*.2,-s*.2);ctx.lineTo(0,-s);ctx.lineTo(s*.2,-s*.2);ctx.lineTo(s,0);ctx.lineTo(s*.2,s*.2);ctx.lineTo(0,s);ctx.lineTo(-s*.2,s*.2);ctx.closePath();ctx.fill();ctx.restore();}
  }ctx.globalAlpha=1;
}
function drawCoins(){
  for(const p of parts){
    if(p.k!=='coin'||p.t<0)continue;
    const t=clamp(p.t,0,1),u=1-t,x=u*u*p.sx+2*u*t*p.cx+t*t*p.tx,y=u*u*p.sy+2*u*t*p.cy+t*t*p.ty,r=5.5-t*1.5;
    // Golden Ribbon Trail behind flying coin
    if (!reduceMotion && t > 0.04) {
      ctx.save();
      ctx.beginPath();
      for (let s = 0; s <= 6; s++) {
        const ts = Math.max(0, t - s * 0.032), us = 1 - ts;
        const rx = us*us*p.sx + 2*us*ts*p.cx + ts*ts*p.tx;
        const ry = us*us*p.sy + 2*us*ts*p.cy + ts*ts*p.ty;
        if (s === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = `rgba(255, 230, 128, ${(1 - t) * 0.55})`;
      ctx.lineWidth = r * 1.1;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle='#a56d24';circ(ctx,x,y+1,r);ctx.fillStyle='#f6cf6d';circ(ctx,x,y,r);ctx.strokeStyle='#fff0ab';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r*.65,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b08429';ctx.fillRect(x-.6,y-r*.4,1.2,r*.8);ctx.fillStyle='#fff7c9';circ(ctx,x-r*.3,y-r*.3,r*.2);
  }
}
function drawCursor(){
  if(!pointer.active||mode!=='day')return;
  const R=cur.R,x=pointer.x,y=pointer.y;
  ctx.fillStyle = rushTimer > 0 ? 'rgba(255,230,115,.11)' : 'rgba(255,246,213,.06)';
  circ(ctx,x,y,R);
  ctx.setLineDash([5,7]);
  ctx.lineDashOffset=reduceMotion?0:-tNow*18;
  ctx.strokeStyle = rushTimer > 0 ? 'rgba(255,230,120,.88)' : 'rgba(255,249,226,.66)';
  ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  if (chargeT > 0.05) {
    const cR = lerp(R * 0.4, R * (cur.cleaver ? 2.4 : 2.05), chargeT);
    ctx.save();
    ctx.strokeStyle = chargeT >= 0.72 ? 'rgba(56, 189, 248, 0.9)' : 'rgba(253, 224, 71, 0.75)';
    ctx.lineWidth = chargeT >= 0.72 ? 3.5 : 2.2;
    ctx.beginPath(); ctx.arc(x, y, cR, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Dynamic crescent slash arc when swinging
  if(sweepT>0){
    const t=1-sweepT/.13;
    const span = Math.PI * 1.28 * t;
    ctx.save();
    ctx.lineCap='round';
    ctx.strokeStyle=`rgba(255, 224, 130, ${0.45 * (1 - t)})`;
    ctx.lineWidth=12*(1-t)+2;
    ctx.beginPath();ctx.arc(x,y,R*0.88,sweepA,sweepA+span);ctx.stroke();
    ctx.strokeStyle=`rgba(255, 251, 235, ${0.92 * (1 - t)})`;
    ctx.lineWidth=5.5*(1-t)+1;
    ctx.beginPath();ctx.arc(x,y,R*0.91,sweepA+span*0.15,sweepA+span);ctx.stroke();
    ctx.restore();
  }

  // Upgraded Harvest Crescent Sickle
  ctx.save();
  ctx.translate(x,y);
  const swingKick = reduceMotion ? 0 : Math.sin((1 - clamp(sweepT / 0.13, 0, 1)) * Math.PI) * 0.95;
  const velTilt = clamp((pointer.vx || 0) * 0.0004, -0.18, 0.18);
  ctx.rotate(-0.62 + swingKick + velTilt);
  const z=clamp(R/46, 0.72, 1.28);
  ctx.scale(z,z);

  // Drop shadow
  ctx.save();
  ctx.translate(2, 4);
  ctx.strokeStyle='rgba(20, 28, 18, 0.28)';
  ctx.lineWidth=6;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-14, 24);
  ctx.lineTo(6, -12);
  ctx.arc(-6, -18, 18, 0.2, Math.PI * 1.18, true);
  ctx.stroke();
  ctx.restore();

  // Forged crescent steel blade (outer spine + honed inner bevel)
  const bladeGrad = ctx.createLinearGradient(-28, -36, 18, -6);
  bladeGrad.addColorStop(0, '#ffffff');
  bladeGrad.addColorStop(0.35, '#e2e8f0');
  bladeGrad.addColorStop(0.75, '#94a3b8');
  bladeGrad.addColorStop(1, '#475569');

  ctx.fillStyle = bladeGrad;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(6, -12); // Tang at collar
  ctx.bezierCurveTo(18, -28, -4, -44, -26, -30); // Outer forged spine
  ctx.bezierCurveTo(-33, -25, -34, -16, -29, -12); // Hooked tip
  ctx.bezierCurveTo(-24, -22, -4, -29, 3, -10); // Razor inner cutting edge
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Polished bevel highlight along the inner cutting edge
  ctx.strokeStyle = '#fffbeb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-28, -14);
  ctx.bezierCurveTo(-20, -25, -3, -29, 4, -12);
  ctx.stroke();

  // Golden harvest fuller line etched into blade
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-22, -26);
  ctx.bezierCurveTo(-10, -34, 6, -28, 5, -14);
  ctx.stroke();

  // Brass bolster / ferrule collar
  ctx.save();
  ctx.translate(4, -10);
  ctx.rotate(0.48);
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-4.2, -3.5, 8.4, 7, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  circ(ctx, 0, 0, 1.3);
  ctx.restore();

  // Ergonomic turned ash-wood handle with leather grip wraps
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 7.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -7);
  ctx.quadraticCurveTo(-5, 8, -14, 23);
  ctx.stroke();

  ctx.strokeStyle = '#c27838';
  ctx.lineWidth = 5.0;
  ctx.beginPath();
  ctx.moveTo(2, -7);
  ctx.quadraticCurveTo(-5, 8, -14, 23);
  ctx.stroke();

  ctx.strokeStyle = '#f6d096';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(1, -7);
  ctx.quadraticCurveTo(-6, 7, -15, 22);
  ctx.stroke();

  // Leather grip bands
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.4;
  for (const tGrip of [0.28, 0.52, 0.76]) {
    const gx = lerp(2, -14, tGrip), gy = lerp(-7, 23, tGrip);
    ctx.beginPath();
    ctx.moveTo(gx - 2.6, gy - 1.2);
    ctx.lineTo(gx + 2.6, gy + 1.2);
    ctx.stroke();
  }

  // Brass pommel cap at bottom of handle
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.2;
  circ(ctx, -14.5, 23.5, 3.8);
  ctx.stroke();

  ctx.restore();
}
function drawTexts(){
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(const t of texts){const a=Math.min(1,t.life/t.max*2.5);ctx.globalAlpha=a;ctx.font=`800 ${Math.round(t.size)}px "Big Shoulders Stencil", Impact, sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='rgba(39,35,23,.65)';ctx.strokeText(t.t,t.x,t.y);ctx.fillStyle=t.col;ctx.fillText(t.t,t.x,t.y);}ctx.globalAlpha=1;
}
function drawSkyLife(p,night){
  const motion=reduceMotion?0:tNow;
  for(let i=0;i<5;i++){
    const x=((worldW*(.08+i*.23)+motion*(1.8+i*.2))%(worldW+150))-70,y=64+(i%3)*24,z=.6+(i%2)*.24;
    ctx.save();ctx.translate(x,y);ctx.scale(z,z);ctx.fillStyle=night>.4?'rgba(176,185,209,.12)':'rgba(255,246,222,.58)';
    ell(ctx,0,0,42,11);ell(ctx,-20,-6,20,13);ell(ctx,3,-12,24,18);ell(ctx,29,-3,23,12);ctx.fillStyle=night>.4?'rgba(175,182,205,.08)':'rgba(255,251,233,.3)';ell(ctx,-3,-15,20,10);ctx.restore();
  }
  if(night<.6){ctx.strokeStyle='rgba(54,78,76,.48)';ctx.lineWidth=1.15;for(let i=0;i<3;i++){const x=(worldW*.53+i*14+motion*7)%(worldW+50),y=83+i%2*8+Math.sin(motion*1.3+i)*2,wing=reduceMotion?2:Math.sin(motion*6+i)*3;ctx.beginPath();ctx.moveTo(x-4,y-wing);ctx.quadraticCurveTo(x-2,y-2,x,y);ctx.quadraticCurveTo(x+2,y-2,x+4,y-wing);ctx.stroke();}}
}
function drawAmbient(night){
  if(reduceMotion)return;
  const r=mulberry(93);
  if(night>.2){for(let i=0;i<15;i++){const x=r()*worldW+Math.sin(tNow*.6+i)*12,y=FIELD_TOP+25+r()*(HW-FIELD_TOP-55)+Math.cos(tNow*.7+i)*8,a=night*(.2+.6*Math.pow(Math.sin(tNow*1.3+i),2));ctx.fillStyle=`rgba(246,232,137,${a*.13})`;circ(ctx,x,y,7);ctx.fillStyle=`rgba(255,241,159,${a})`;circ(ctx,x,y,1.2);}}
  else{for(let i=0;i<7;i++){const x=(r()*worldW+tNow*(3+i*.3))%(worldW+15),y=FIELD_TOP+20+r()*(HW-FIELD_TOP-40)+Math.sin(tNow*.6+i)*5;ctx.fillStyle='rgba(255,240,176,.32)';ell(ctx,x,y,1.8,.6,-.7);}}
}
function mountainRidgeY(xNorm){
  // Matches the topmost mountain silhouette in ensureScenery: [[0,137],[.19,103],[.39,138],[.6,109],[.78,126],[1,90]]
  const pts = [[0,137],[0.19,103],[0.39,138],[0.6,109],[0.78,126],[1,90]];
  const x = clamp(xNorm, 0, 1);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      const midY = Math.min(a[1], b[1]) - 15;
      return (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * midY + t * t * b[1];
    }
  }
  return 115;
}

function drawScarecrowAndSmoke(night){
  // 1. Evolving Farm: Spinning Windmill (unlocked after Bill 1)
  if (farm.billsPaid >= 1 && worldW > 380) {
    const wx = worldW * 0.34, wy = 198;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-3, -44); ctx.lineTo(3, -44); ctx.lineTo(8, 0); ctx.stroke();
    ctx.translate(0, -44);
    ctx.rotate(reduceMotion ? 0.4 : tNow * (dailyEvent && dailyEvent.weather === 'wind' ? 3.2 : 1.2));
    ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.rect(2, -2.5, 16, 5); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#dc2626'; circ(ctx, 0, 0, 3);
    ctx.restore();
  }

  // 2. Evolving Farm: Chugging Red Tractor (unlocked after Bill 3)
  if (farm.billsPaid >= 3 && worldW > 420) {
    const tx = worldW * 0.43, ty = 207, chug = reduceMotion ? 0 : Math.sin(tNow * 16) * 0.7;
    ctx.save();
    ctx.translate(tx, ty + chug);
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.roundRect(-14, -18, 26, 12, 3); ctx.fill();
    ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.roundRect(-12, -28, 14, 11, 2); ctx.fill();
    ctx.fillStyle = '#bae6fd'; ctx.fillRect(-9, -26, 8, 7);
    ctx.fillStyle = '#1e293b'; circ(ctx, -8, -6, 7.5); circ(ctx, 9, -4.5, 5);
    ctx.fillStyle = '#facc15'; circ(ctx, -8, -6, 3.2); circ(ctx, 9, -4.5, 2);
    ctx.restore();
  }

  // 3. Cozy Farmhouse Chimney Smoke on the right
  if (worldW > 420 && smokePuffs.length) {
    for (const sp of smokePuffs) {
      const k = sp.life / sp.max;
      ctx.fillStyle = `rgba(245, 240, 230, ${(1 - k) * 0.42 * (1 - night * 0.4)})`;
      circ(ctx, sp.x, sp.y, sp.r + (sp.maxR - sp.r) * k);
    }
  }

  // 4. Background Scarecrow near the fence (wobbles happily during Harvest Rush!)
  const scX = worldW * 0.62, scY = 208;
  const dance = (rushTimer > 0 && mode === 'day')
    ? (reduceMotion ? 0 : Math.sin(tNow * 18) * 0.26)
    : (reduceMotion ? 0 : Math.sin(tNow * 2.1) * 0.035);
  ctx.save();
  ctx.translate(scX, scY);
  ctx.rotate(dance);
  ctx.strokeStyle = '#6b4f35';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -28);
  ctx.moveTo(-14, -19); ctx.lineTo(14, -19);
  ctx.stroke();
  ctx.fillStyle = '#c85a32';
  ctx.beginPath(); ctx.roundRect(-7, -21, 14, 12, 2); ctx.fill();
  ctx.fillStyle = '#f3d58d';
  circ(ctx, 0, -26, 5.5);
  ctx.fillStyle = '#7c4d25';
  ctx.beginPath();
  ctx.moveTo(-10, -29); ctx.lineTo(0, -37); ctx.lineTo(10, -29);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // 5. Evolving Farm: Glowing Fence Post Lanterns at Dusk/Night (unlocked after Bill 1)
  if (farm.billsPaid >= 1) {
    const fy = FIELD_TOP - 13;
    for (let x = 56; x < worldW - 40; x += 147) {
      ctx.fillStyle = '#475569'; ctx.fillRect(x - 2, fy - 25, 4, 5);
      ctx.fillStyle = '#fef08a'; circ(ctx, x, fy - 22, 2.2);
      if (night > 0.05) {
        ctx.fillStyle = radial(ctx, x, fy - 22, 1, x, fy - 22, 22, `rgba(255, 220, 120, ${night * 0.45})`, 'rgba(255, 220, 120, 0)');
        circ(ctx, x, fy - 22, 22);
      }
    }
  }

  // 6. Character: Authored Arthur Grumble Rig along the fence!
  const st = billStatus();
  const gx = worldW * 0.85, gy = 213;
  const paidEnough = farm.cash >= st.b.amt;
  let aState = 'idle';
  let bubble = '';
  if (arthurAngerTimer > 0) {
    aState = 'anger';
    bubble = 'Stop that!!';
  } else if (paidEnough && (st.left <= 1 || mode === 'day')) {
    aState = 'shock';
    if (mode === 'day' && time < 7.0) bubble = 'Impossible! You have the cash?!';
  } else if (mode === 'day' && time < 4.8) {
    aState = 'demand';
    bubble = `Pay ${fmt$(st.b.amt)} at dusk or else!`;
  } else if (st.left <= 1 || (mode === 'day' && time < 9.5)) {
    aState = 'smug';
    if (mode === 'day' && time < 8.0) bubble = `Heh heh... ${fmt$(st.b.amt)} due soon!`;
  }
  const phaserScene = (window as any).__PHASER_FARM_SCENE;
  if (phaserScene && phaserScene.arthurSprite && phaserScene.textures.exists('arthur')) {
    const spr = phaserScene.arthurSprite;
    spr.setPosition(gx, gy + 5);
    // Draw the real Phaser atlas frame inside our procedural Canvas2D scene.
    // Phaser animates the sprite; our renderer owns the visible canvas.
    spr.play(`arthur_${aState}`, true);
    const frame = spr.frame;
    const image = frame.source.image;
    const width = frame.cutWidth * .35, height = frame.cutHeight * .35;
    ctx.drawImage(image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      gx - width * .5, gy + 5 - height * .95, width, height);
    if (bubble) {
      ctx.save();
      ctx.translate(gx, gy - 122);
      ctx.font = '700 10.5px "Courier Prime", monospace';
      const tw = ctx.measureText(bubble).width + 16;
      ctx.fillStyle = 'rgba(255, 253, 242, 0.96)';
      ctx.strokeStyle = paidEnough ? '#15803d' : '#991b1b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -18, tw, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = paidEnough ? '#15803d' : '#b91c1c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bubble, 0, -8);
      ctx.restore();
    }
  }
}

function drawPropsCrowsAndWeather(){
  // Field Props (Fertilizer Bags & Clover Treats)
  for (const fp of fieldProps) {
    const s = fp.ds * (0.92 + Math.sin(tNow * 5) * 0.05);
    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255, 235, 130, 0.25)';
    circ(ctx, 0, -12, 22);
    if (fp.kind === 'fertilizer') {
      ctx.fillStyle = '#d6b37c'; ctx.strokeStyle = '#78532a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(-12, -24, 24, 24, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#16a34a'; circ(ctx, 0, -12, 6);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('+4', 0, -9);
    } else {
      ctx.fillStyle = '#22c55e'; ctx.strokeStyle = '#14532d'; ctx.lineWidth = 1.5;
      for (const [ox, oy] of [[-5, -14], [5, -14], [0, -20]]) { circ(ctx, ox, oy, 6); ctx.stroke(); }
      ctx.fillStyle = '#facc15'; circ(ctx, 0, -14, 3.5);
    }
    ctx.restore();
  }

  // Swooping Crow Pests
  for (const cr of crows) {
    const wing = reduceMotion ? 0 : Math.sin(cr.t * 22) * 8;
    ctx.save();
    ctx.translate(cr.x, cr.y);
    if (cr.vx < 0 || (!cr.scared && cr.tx < cr.x)) ctx.scale(-1, 1);
    ctx.fillStyle = '#1e293b';
    ell(ctx, 0, 0, 11, 6.5);
    ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-12, -10 + wing); ctx.lineTo(4, -3); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(17, 0); ctx.lineTo(10, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; circ(ctx, 7, -2, 2);
    ctx.fillStyle = '#0f172a'; circ(ctx, 7.5, -2, 1);
    ctx.restore();
  }

  // Storm Scythe Chain Lightning Bolts
  for (const b of bolts) {
    ctx.save();
    ctx.globalAlpha = b.life / b.max;
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo((b.x1 + b.x2) * 0.5 + (Math.random() - 0.5) * 18, (b.y1 + b.y2) * 0.5 - 12);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Weather Particles (Summer Rain or Blowing Autumn Leaves)
  for (const wp of weatherParts) {
    if (wp.w === 'rain') {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.48)';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(wp.x, wp.y); ctx.lineTo(wp.x - 4, wp.y + 13); ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(wp.x, wp.y); ctx.rotate(wp.rot + tNow * 3);
      ctx.fillStyle = wp.c;
      ell(ctx, 0, 0, 4.5, 2.4);
      ctx.restore();
    }
  }
}

function draw(){
  if(!worldW)return;
  const p=skyP(),m=lightMul(p),night=smooth(1,1.3,p),warm=smooth(.55,1,p);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  ctx.save();
  if(shakeA>.2)ctx.translate((Math.random()-.5)*shakeA,(Math.random()-.5)*shakeA);

  const [top,bot]=skyAt(p),sg=ctx.createLinearGradient(0,0,0,FIELD_TOP);
  sg.addColorStop(0,rgba(top));sg.addColorStop(1,rgba(bot));
  ctx.fillStyle=sg;ctx.fillRect(-20,-20,worldW+40,FIELD_TOP+20);

  if(night>0){
    for(const s of stars){
      ctx.globalAlpha=night*(.55+.45*Math.sin((reduceMotion?0:tNow)*1.7+s.tw));
      ctx.fillStyle='#fff2ca';circ(ctx,s.x*worldW,s.y*(HORIZON-30),s.r);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle=radial(ctx,worldW*.81,70,2,worldW*.81,70,65,'rgba(245,239,206,.28)','rgba(245,239,206,0)');
    circ(ctx,worldW*.81,70,65);
    ctx.fillStyle='#f5ecd0';circ(ctx,worldW*.81,70,13);
    ctx.fillStyle='rgba(162,168,165,.3)';circ(ctx,worldW*.81-4,67,3);circ(ctx,worldW*.81+4,74,2);
  }

  // Sun arc & mountain occlusion check
  const q = Math.min(1, p);
  const sx = worldW * (0.12 + 0.76 * q);
  // Sun rises high at midday (y ~ 52) and dips behind the mountain ridge around p ~ 0.80
  const sy = 136 - Math.sin(Math.PI * q) * 84 + (p > 0.72 ? Math.pow((p - 0.72) / 0.28, 1.55) * 95 : 0);
  const ridgeY = mountainRidgeY(sx / worldW);
  // Positive when the sun's center is above the mountain ridge; <= 0 when behind the mountain
  const sunClearance = ridgeY - sy;
  const beamVisibility = clamp((sunClearance - 8) / 28, 0, 1) * (1 - night);

  if(p<1.06){
    const sun=mixc(hex('#fff4be'),hex('#ff9e58'),warm);
    ctx.fillStyle=radial(ctx,sx,sy,4,sx,sy,105,rgba(sun,.46),rgba(sun,0));
    circ(ctx,sx,sy,105);
    ctx.fillStyle=rgba(sun);
    circ(ctx,sx,sy,20);
  }

  drawSkyLife(p,night);
  ensureScenery();
  ctx.drawImage(sceneryLayer,0,0,worldW,FIELD_TOP);
  ctx.drawImage(fieldLayer,0,FIELD_TOP-14,worldW,HW-FIELD_TOP+14);
  drawScarecrowAndSmoke(night);

  // Sunbeams ("God Rays") ONLY when the sun is strictly above the mountain ridge!
  // As the sun drops behind the mountain (beamVisibility -> 0), beams vanish completely.
  if (beamVisibility > 0.01 && mode === 'day') {
    const rayCol = mixc(hex('#fff6c8'), hex('#ffc078'), warm);
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(sx, sy);
      const sway = reduceMotion ? 0 : Math.sin(tNow * 0.7 + i) * 0.025;
      ctx.rotate(((sx - worldW * 0.5) / worldW) * 0.55 + i * 0.20 + sway);
      const gr = ctx.createLinearGradient(0, 18, 0, 360);
      gr.addColorStop(0, rgba(rayCol, 0.14 * beamVisibility));
      gr.addColorStop(0.65, rgba(rayCol, 0.06 * beamVisibility));
      gr.addColorStop(1, rgba(rayCol, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(-12, 18); ctx.lineTo(12, 18);
      ctx.lineTo(64, 360); ctx.lineTo(-64, 360);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawPuddles();
  const sunX=sx,shDx=mode==='day'?-(sunX-worldW/2)/worldW*1.4:0,shA=(night>.5?.16:.3)*(0.55+0.45*beamVisibility),list=crops.slice().sort((a,b)=>a.y-b.y);
  for(const c of list){const grow=c.age<=0?0:Math.min(1,c.age/.35);if(grow<=0)continue;const w=c.r*c.ds*grow;ctx.fillStyle=`rgba(36,27,17,${shA*.5})`;ell(ctx,c.x+shDx*w*.9,c.y+3,w*1.22,w*.38);ctx.fillStyle=`rgba(30,22,14,${shA})`;ell(ctx,c.x,c.y+3,w*.67,w*.2);}
  if(goat){const ds=depth(goat.y);ctx.fillStyle=`rgba(30,26,17,${shA})`;ell(ctx,goat.x+shDx*20*ds,goat.y+2,29*ds,8*ds);}
  let goatDrawn=!goat;for(const c of list){if(!goatDrawn&&goat.y<c.y){drawGoat(goat);goatDrawn=true;}drawCrop(c);}if(!goatDrawn)drawGoat(goat);for(const c of list)drawHpBar(c);drawParts();drawPropsCrowsAndWeather();

  // Seamless full-canvas evening/night atmospheric tint (NO horizontal cut line at y=105!)
  if (warm > 0.05 || night > 0.05) {
    const ambGrad = ctx.createLinearGradient(0, 0, 0, HW);
    ambGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    ambGrad.addColorStop(0.28, rgba(mixc([255, 255, 255], m, 0.45)));
    ambGrad.addColorStop(1, rgba(m));
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ambGrad;
    ctx.fillRect(-20, -20, worldW + 40, HW + 40);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (warm > 0.15 && night < 0.85) {
    const duskWash = ctx.createLinearGradient(0, 0, 0, HW);
    duskWash.addColorStop(0, 'rgba(255, 180, 120, 0)');
    duskWash.addColorStop(0.35, `rgba(255, 168, 108, ${warm * 0.14 * (1 - night)})`);
    duskWash.addColorStop(0.7, `rgba(235, 132, 98, ${warm * 0.10 * (1 - night)})`);
    duskWash.addColorStop(1, `rgba(120, 68, 88, ${warm * 0.06 * (1 - night)})`);
    ctx.fillStyle = duskWash;
    ctx.fillRect(0, 0, worldW, HW);
  }

  drawBarn(m,night);if(window.DBD_ENV_RENDERER)window.DBD_ENV_RENDERER.drawForegroundFraming(ctx,worldW,HW,curBiome().countryCode,tNow);drawAmbient(night);drawCoins();drawTexts();drawCursor();ctx.restore();
  if(dawnFade>0){ctx.fillStyle=`rgba(20,35,50,${dawnFade*.65})`;ctx.fillRect(0,0,worldW,HW);}
}
function drawBarn(m,night){
  if(night<.05)return;const bs=worldW<430?.83:1.08,bx=Math.max(75,worldW*.21),x=bx-11*bs,y=211-61*bs;
  ctx.fillStyle=radial(ctx,x,y,1,x,y,26*bs,`rgba(255,215,125,${night*.42})`,'rgba(255,207,121,0)');circ(ctx,x,y,26*bs);ctx.fillStyle=`rgba(255,224,149,${night*.88})`;ctx.fillRect(x-5*bs,y-4*bs,10*bs,8*bs);
  if(worldW>420){const hx=worldW*.76,hy=207;ctx.fillStyle=`rgba(255,218,143,${night*.7})`;ctx.fillRect(hx-19,hy-24,8,9);ctx.fillRect(hx+14,hy-24,8,9);}
}

/* ================= UI ================= */
const el = {
  hFarm: $('#hFarm'), hDay: $('#hDay'), hCash: $('#hCash'), hGrit: $('#hGrit'), btnSound: $('#btnSound'),
  hud: $('#hud'), hudEarn: $('#hudEarn'), hudCombo: $('#hudCombo'), hudLight: $('#hudLight'), dlText: $('#dlText'), dlFill: $('#dlFill'),
  overlay: $('#overlay'), toast: $('#toast'), notice: $('#notice'), shedList: $('#shedList'), shedTag: $('#shedTag'), shedHint: $('#shedHint'),
  perkList: $('#perkList'), heirList: $('#heirList'), gritTag: $('#gritTag'), heirHint: $('#heirHint'), modal: $('#modal'), btnReset: $('#btnReset'),
};
let toastTimer = 0;
function toast(msg, ms){ el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms || 2600); }

function renderAll(){ renderHeader(); renderNotice(); renderShed(); renderPerks(); renderHeir(); renderCard(); el.hud.hidden = !(mode === 'day' || mode === 'dusk'); }
function renderHeader(){
  setText(el.hFarm, `Farm No. ${farm.no}`); setText(el.hDay, String(farm.day)); setText(el.hCash, fmt$(farm.cash)); setText(el.hGrit, String(meta.grit));
  const hDia = $('#hDiamonds'); if (hDia) setText(hDia, `💎 ${meta.diamonds || 0}`);
  el.btnSound.setAttribute('aria-pressed', String(meta.sound)); setText(el.btnSound, meta.sound ? 'Sound on' : 'Sound off');
  const bm = curBiome(), bBtn = $('#btnBiome'), fSign = $('#fieldSign');
  for (const id of ['btnSkillTree', 'btnSaveTransfer']) { const button = $('#' + id); if (button) button.disabled = mode !== 'idle'; }
  if (bBtn) { setText(bBtn, `🌍 ${bm.short}`); bBtn.disabled = mode !== 'idle'; }
  if (fSign) setText(fSign, `${bm.countryName.toUpperCase()} · ${bm.city.toUpperCase()} · v0.7.0`);
}
let lastStampKey = '';
function renderNotice(){
  const st = billStatus(), b = st.b, can = farm.cash >= b.amt, pct = clamp(farm.cash / b.amt, 0, 1);
  let due, stamp, stampCls = '';
  if (st.tonight){ due = 'Due tonight. Pay before you sleep.'; stamp = 'Due tonight'; }
  else if (st.left === 1){ due = `Due at sunset tomorrow, day ${farm.due}.`; stamp = 'Final notice'; }
  else { due = `Due at sunset on day ${farm.due}, in ${st.left} days.`; stamp = 'Notice'; stampCls = 'muted'; }
  let proj, projCls = '';
  if (can){ proj = st.tonight ? 'You have enough. Pay it now.' : 'You could pay this now and pick a perk.'; projCls = 'ok'; }
  else if (st.tonight){ proj = `You're ${fmt$(Math.ceil(b.amt - farm.cash))} short.`; projCls = 'bad'; }
  else if (!farm.played){ proj = 'Your first day will show your pace.'; }
  else { const est = farm.cash + farm.lastEarn * st.left; proj = `At yesterday's pace you'll have about ${fmt$(est)} by then.`; projCls = est >= b.amt ? 'ok' : 'bad'; }
  const next = farm.bill + 1 < BILLS.length ? billObj(farm.bill + 1) : null;
  const key = farm.bill + ':' + stamp;
  const pop = key !== lastStampKey && lastStampKey !== '' ? ' pop' : ''; lastStampKey = key;
  el.notice.innerHTML =
    `<div class="n-lh"><strong>Grumble &amp; Sons</strong> Savings &amp; Loan</div>` +
    `<div class="n-lh">Acct 0047-FARM · Notice ${farm.bill + 1} of ${BILLS.length}</div>` +
    `<div class="n-name">${b.name}</div>` +
    `<p class="n-note">${b.note}</p>` +
    `<div class="n-amtrow"><div class="n-amt">$${b.amt.toLocaleString('en-US')}<small>.00</small></div><span class="stamp ${stampCls}${pop}">${stamp}</span></div>` +
    `<div class="n-due${st.tonight ? ' hot' : ''}">${due}</div>` +
    `<div class="meter${can ? ' full' : ''}" id="nMeter" role="img" aria-label="Cash covers ${Math.round(pct * 100)}% of this bill"><span><i id="nBar" style="width:${(pct * 100).toFixed(1)}%"></i></span></div>` +
    `<div class="n-cash"><span id="nCash">Cash on hand ${fmt$(farm.cash)}</span><span id="nPct">${Math.round(pct * 100)}%</span></div>` +
    `<p class="n-proj ${projCls}">${proj}</p>` +
    `<div class="n-actions"><button class="btn money" type="button" id="btnPay" ${can && mode === 'idle' ? '' : 'disabled'}>Pay ${fmt$(b.amt)}</button>` +
    `<span class="n-next">${next ? `After this: ${lc(next.name)}, ${fmt$(next.amt)}.` : 'This is the last one.'}</span></div>`;
}
function guardTonight(cost){ const st = billStatus(); return st.tonight && farm.cash - cost < st.b.amt; }
function renderShed(){
  const open = mode === 'idle';
  el.shedTag.textContent = open ? 'Open' : 'Closed until sunset'; el.shedTag.classList.toggle('closed', !open);
  const st = billStatus();
  el.shedHint.textContent = open && st.tonight && farm.cash >= st.b.amt ? "Tonight's bill comes first. Pay it, then shop." : 'Upgrades last until the bank takes this farm.';
  const s = stats();
  el.shedList.innerHTML = SHED.map(def => {
    const lvl = farm.shed[def.id], c = shedCost(def, lvl);
    const pips = `<span class="pips" aria-hidden="true">${Array.from({ length: def.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
    let fx, btn;
    if (c == null){ fx = `${def.show(s)} · maxed`; btn = `<button class="buy max" type="button" disabled>Maxed</button>`; }
    else {
      fx = `${def.show(s)} → ${def.show(statsWith(def.id))}`;
      const ok = open && farm.cash >= c && !guardTonight(c);
      btn = `<button class="buy${ok ? ' can' : ''}" type="button" data-buy="${def.id}" ${ok ? '' : 'disabled'} aria-label="Buy ${def.name} for ${fmt$(c)}">${fmt$(c)}</button>`;
    }
    return `<div class="row"><div class="r-name">${def.name} ${pips}</div><div class="r-fx">${fx}</div><div class="r-btn">${btn}</div></div>`;
  }).join('');
}
function renderPerks(){
  if (!farm.perks.length){ el.perkList.innerHTML = '<p class="empty">None yet. Each bill you pay lets you pick one.</p>'; return; }
  const counts = {}; farm.perks.forEach(p => counts[p] = (counts[p] || 0) + 1);
  el.perkList.innerHTML = '<div class="perks">' + Object.keys(counts).map(id => { const p = PERKS.find(x => x.id === id); return `<span class="perk" title="${p.line}">${p.name}${counts[id] > 1 ? ` <small>×${counts[id]}</small>` : ''}</span>`; }).join('') + '</div>';
}
function renderHeir(){
  setText(el.gritTag, `${meta.grit} Grit`);
  const any = HEIR_IDS.some(k => meta.heir[k] > 0);
  el.heirHint.textContent = (meta.grit === 0 && !any)
    ? 'Every lost farm leaves you stronger: Grit rewards payments (with diminishing returns), 3 per bill, days survived and saved cash. Heirlooms stay with you forever.'
    : 'Heirlooms stay with you on every farm.';
  const open = mode === 'idle';
  el.heirList.innerHTML = HEIRS.map(def => {
    const lvl = meta.heir[def.id], c = heirCost(def, lvl);
    const pips = `<span class="pips" aria-hidden="true">${Array.from({ length: def.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
    const ok = c != null && open && meta.grit >= c;
    const btn = c == null ? `<button class="buy max" type="button" disabled>Maxed</button>` : `<button class="buy${ok ? ' can' : ''}" type="button" data-heir="${def.id}" ${ok ? '' : 'disabled'} aria-label="Buy ${def.name} for ${c} Grit">${c} Grit</button>`;
    return `<div class="row"><div class="r-name">${def.name} ${pips}</div><div class="r-fx">${def.line(lvl)}</div><div class="r-btn">${btn}</div></div>`;
  }).join('');
}
function renderCard(){
  if (mode !== 'idle' || !el.modal.hidden && farm.pendingPerks){ el.overlay.innerHTML = ''; return; }
  const st = billStatus(), b = st.b;
  let title, body, btn;
  const startBtn = `<button class="btn" type="button" data-act="start">Start day ${farm.day}</button>`;
  if (st.tonight && farm.cash < b.amt){
    title = 'The bank comes tonight.';
    body = `You're ${fmt$(Math.ceil(b.amt - farm.cash))} short on the ${lc(b.name)}. Grumble &amp; Sons will take the farm. You keep your heirlooms and earn Grit.`;
    btn = `<button class="btn money" type="button" data-act="bank">Face the bank</button>`;
  } else if (st.tonight){
    title = 'Pay before you sleep.';
    body = `The ${lc(b.name)} is due tonight, and you have the money.`;
    btn = `<button class="btn money" type="button" data-act="pay">Pay ${fmt$(b.amt)}</button>`;
  } else if (!farm.played){
    title = farm.no === 1 ? 'Harvest before the sun goes down.' : 'A fresh farm. A fresh loan.';
    body = `Sweep your scythe over the crops. Each one sells the moment you cut it. The bank wants ${fmt$(b.amt)} by sunset on day ${farm.due}.`;
    btn = startBtn;
  } else {
    title = `Yesterday: ${farm.lastCount} ${farm.lastCount === 1 ? 'crop' : 'crops'}, ${fmt$(farm.lastEarn)}.`;
    body = (farm.day === 2 ? 'Open ⚙ to buy equipment before your next harvest. Equipment and perks last for this farm; heirlooms and skills are permanent. ' : '') + (st.left === 1 ? `The ${lc(b.name)} (${fmt$(b.amt)}) is due at sunset tomorrow.` : `The ${lc(b.name)} (${fmt$(b.amt)}) is due in ${st.left} days.`);
    btn = startBtn;
  }
  rollDailyEvent();
  const foot = `📰 COUNTY GAZETTE: ${dailyEvent.title} — ${dailyEvent.desc}`;
  el.overlay.innerHTML = `<div class="card"><p class="eyebrow">${curBiome().city} · Farm No. ${farm.no} · Day ${farm.day}</p><h2 class="ctitle">${title}</h2><p class="cbody">${body}</p><div class="cact">${btn}</div><p class="cfoot">${foot}</p></div>`;
}
function updateHud(){
  const optionalText = (id, value) => { const node = $('#' + id); if (node) setText(node, value); };
  const bill = billStatus();
  optionalText('hCash', fmt$(farm.cash));
  optionalText('billHudAmount', fmt$(bill.b.amt));
  optionalText('billHudDue', bill.tonight ? 'Due tonight' : `Day ${farm.due} · ${bill.left} days left`);
  setText(el.hCash, fmt$(farm.cash));
  syncPause();
  if (mode !== 'day' && mode !== 'dusk') return;
  const amt = billObj(farm.bill).amt, pct = clamp(farm.cash / amt, 0, 1), nCash = $('#nCash');
  if (nCash){
    setText(nCash, `Cash on hand ${fmt$(farm.cash)}`); setText($('#nPct'), `${Math.round(pct * 100)}%`);
    $('#nBar').style.width = (pct * 100).toFixed(1) + '%'; $('#nMeter').classList.toggle('full', farm.cash >= amt);
  }
  setText(el.hudEarn, fmt$(today.earned));
  el.dlFill.style.transform = `scaleX(${clamp(time / dayLen, 0, 1)})`;
  setText(el.dlText, time.toFixed(1) + ' s');
  el.hudLight.classList.toggle('low', mode === 'day' && time < 3);
  setText(el.hudCombo, combo >= 2 ? `${combo} crop chain` : 'Sweep. Chain. Cash in.');
  optionalText('multiplierValue', '×' + incomeMultiplier());
  optionalText('chainCount', combo ? `${combo} in a row` : 'Keep harvesting');
  optionalText('rushLabel', rushTimer > 0 ? `RUSH · ${rushTimer.toFixed(1)}s` : `${rushCharge}/${RUSH_GOAL} TO RUSH`);
  optionalText('eventLabel', rushTimer > 0 ? 'HARVEST RUSH · ×1.5 INCOME' : (dailyEvent ? `${dailyEvent.title} · Hold, then release to Cleave` : 'Lucky crops sparkle · ×2 value'));
  optionalText('bestChain', String(today.best));
  const chainBar = $('#chainFill'), rushBar = $('#rushFill');
  if (chainBar) chainBar.style.transform = `scaleX(${clamp(comboTimer / cur.chainGrace, 0, 1)})`;
  if (rushBar) rushBar.style.transform = `scaleX(${rushTimer > 0 ? rushTimer / RUSH_DURATION : rushCharge / RUSH_GOAL})`;
  stage.classList.toggle('rushing', rushTimer > 0 && mode === 'day');
}

/* actions */
function payBill(){
  if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
  const b = billObj(farm.bill); if (farm.cash < b.amt) return;
  Sound.init(); Sound.stamp();
  farm.cash -= b.amt; farm.paidTotal += b.amt; farm.billsPaid += 1;
  arthurAngerTimer = 3.0;
  if (farm.billsPaid % 2 === 0) {
    meta.diamonds = (meta.diamonds || 0) + 1;
    toast('Bill milestone! Earned +1 💎 Diamond for the Skill Tree!', 3200);
  }
  if (farm.bill === BILLS.length - 1){ win(); return; }
  farm.bill += 1; farm.due = (farm.day - 1) + BILLS[farm.bill].days;
  const pool = shuffle(PERKS.filter(p => (!p.req || p.req(farm)) && (!p.once || !farm.perks.includes(p.id))).map(p => p.id));
  farm.pendingPerks = pool.slice(0, 3);
  cur = stats(); fillIdle(); save(); renderAll(); openPerkModal();
}
function openPerkModal(){
  const paid = billObj(farm.bill - 1), nextB = billObj(farm.bill), unlock = UNLOCKS[farm.billsPaid];
  openModal(
    `<div class="mtop"><p class="eyebrow">Notice ${farm.bill} of ${BILLS.length} · ${paid.name}</p><span class="stamp ok pop">Paid</span></div>` +
    `<h3 class="mtitle" id="mTitle">Bill paid. Pick a perk for this farm.</h3>` +
    `<div class="perkgrid">${farm.pendingPerks.map(id => { const p = PERKS.find(x => x.id === id); return `<button class="perkcard" type="button" data-perk="${p.id}"><span class="pn">${p.name}</span><span class="pl">${p.line}</span></button>`; }).join('')}</div>` +
    (unlock ? `<p class="unlock"><strong>New on the farm:</strong> ${unlock}</p>` : '') +
    `<p class="hint" style="margin-top:12px">A little less debt. A little more freedom. Next up: ${lc(nextB.name)}, ${fmt$(nextB.amt)}, due at sunset on day ${farm.due}.</p>`
  );
}
function choosePerk(id){
  if (!farm.pendingPerks || !farm.pendingPerks.includes(id)) return;
  farm.perks.push(id); farm.pendingPerks = null; closeModal();
  cur = stats(); Sound.click(); save(); renderAll();
  const p = PERKS.find(x => x.id === id); toast(`${p.name}. ${p.line}`);
}
function buyShed(id){
  if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
  const def = SHED.find(d => d.id === id), c = shedCost(def, farm.shed[id]);
  if (c == null || farm.cash < c || guardTonight(c)) return;
  farm.cash -= c; farm.shed[id] += 1; cur = stats(); Sound.click(); save(); renderAll();
}
function buyHeir(id){
  if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden) return;
  const def = HEIRS.find(d => d.id === id), c = heirCost(def, meta.heir[id]);
  if (c == null || meta.grit < c) return;
  meta.grit -= c; meta.heir[id] += 1;
  if (id === 'almanac' && !farm.played && farm.billsPaid === 0) farm.cash = Math.max(farm.cash, ALMANAC[meta.heir.almanac]);
  cur = stats(); Sound.click(); save(); renderAll();
}
function foreclose(){
  if (mode !== 'idle' || farm.pendingPerks || !el.modal.hidden || !billStatus().tonight || farm.cash >= billObj(farm.bill).amt) return;
  const old = farm, b = billObj(old.bill), short = Math.ceil(b.amt - old.cash), g = gritFor(old);
  meta.grit += g.total; meta.lost += 1; meta.best = Math.max(meta.best, old.billsPaid);
  farm = newFarm(); cur = stats(); mode = 'idle'; goat = null; fillIdle(); lastStampKey = '';
  save(); renderAll(); Sound.sad();
  openModal(
    `<div class="letter"><p class="eyebrow">Grumble &amp; Sons Savings &amp; Loan</p>` +
    `<h3 class="mtitle" id="mTitle">The bank took the farm.</h3>` +
    `<p>Dear farmer,</p><p>Regarding your ${lc(b.name)}: you were ${fmt$(short)} short. The farm, the tractor and the goat now belong to us. The goat is already a problem.</p>` +
    `<p>You keep your heirlooms, learned skills, Diamonds and Grit. Try upgrading damage or crop prices before your next harvest.</p><p class="sig">A. Grumble, Junior Loan Officer</p></div>` +
    `<dl class="tally"><div><dt>Days survived</dt><dd>${old.day - 1}</dd></div><div><dt>Bills paid</dt><dd>${old.billsPaid} of ${BILLS.length}</dd></div><div><dt>Paid to the bank</dt><dd>${fmt$(old.paidTotal)}</dd></div></dl>` +
    `<p class="gritline">Grit earned: <b>${g.total}</b> <span>(${g.a} from payments, ${g.b} for bills, ${g.c} for days, ${g.d} from saved cash)</span></p>` +
    `<div class="mact"><button class="btn" type="button" data-close>Start farm No. ${farm.no}</button></div>`
  );
}
function win(){
  if (farm.bill !== BILLS.length - 1 || farm.billsPaid !== BILLS.length) return;
  const old = farm, g = gritFor(old), bonus = 25;
  meta.grit += g.total + bonus; meta.owned += 1; meta.best = BILLS.length;
  if (!meta.cityOwned) meta.cityOwned = {};
  meta.cityOwned[curCity().id] = true;
  meta.diamonds = (meta.diamonds || 0) + 2;
  sceneryKey = ''; buildFieldLayer();
  farm = newFarm(); cur = stats(); mode = 'idle'; goat = null; fillIdle(); lastStampKey = '';
  save(); renderAll(); Sound.fanfare();
  openModal(
    `<div class="letter"><div class="mtop"><p class="eyebrow">Grumble &amp; Sons Savings &amp; Loan</p><span class="stamp ok pop">Paid in full</span></div>` +
    `<h3 class="mtitle" id="mTitle">The farm is yours.</h3>` +
    `<p>Dear former customer,</p><p>Enclosed is the deed. We are, frankly, upset. The scarecrow sends his regards and has withdrawn his lawsuit.</p><p class="sig">A. Grumble, Junior Loan Officer</p></div>` +
    `<dl class="tally"><div><dt>Days</dt><dd>${old.day - 1}</dd></div><div><dt>Crops cut</dt><dd>${old.harvested.toLocaleString('en-US')}</dd></div><div><dt>Earned</dt><dd>${fmt$(old.earned)}</dd></div></dl>` +
    `<p class="gritline">Grit earned: <b>${g.total + bonus}</b> <span>(including ${bonus} for owning the farm outright)</span></p>` +
    `<div class="mact"><button class="btn" type="button" data-close>Buy another run-down farm</button></div>`
  );
}
let atlasView = 'world'; // 'world' | 'country'
let atlasCountryCode = 'CA';
let atlasCityId = 'ca_toronto';
let selectedSkillId = 'core_awakening';
let treeZoom = 1.0, treePanX = 0, treePanY = 0;
let arthurStudioTimer = 0, arthurStudioState = 'demand';

function openWorldMapModal(viewMode, cCode){
  if (mode === 'day') setPaused(true);
  atlasView = viewMode || 'world';
  atlasCountryCode = cCode || meta.country || 'CA';
  const cObj = GEO.countries[atlasCountryCode] || GEO.countries.CA;
  if (!cObj.cities.some(ct => ct.id === atlasCityId)) atlasCityId = (meta.country === atlasCountryCode && meta.cityId) ? meta.cityId : cObj.cities[0].id;
  const selCity = cObj.cities.find(ct => ct.id === atlasCityId) || cObj.cities[0];

  let svgHtml = '';
  let inspectorHtml = '';

  if (atlasView === 'world') {
    // WORLD MAP VIEW (viewBox 0 0 1000 500)
    const gridLines = [];
    for (let gx = 100; gx < 1000; gx += 100) gridLines.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="500" stroke="rgba(30,58,138,0.10)" stroke-dasharray="4 4"/>`);
    for (let gy = 100; gy < 500; gy += 100) gridLines.push(`<line x1="0" y1="${gy}" x2="1000" y2="${gy}" stroke="rgba(30,58,138,0.10)" stroke-dasharray="4 4"/>`);

    const lockedPaths = GEO.lockedCountries.map(lc =>
      `<g class="locked-group" data-locked-country="${lc.name}">
        <path class="country-locked" d="${lc.path}"><title>${lc.name} (Coming Soon)</title></path>
        <text x="${lc.labelX}" y="${lc.labelY}" text-anchor="middle" font-size="9" font-family="Courier Prime, monospace" fill="#475569" pointer-events="none">${lc.name}</text>
      </g>`
    ).join('');

    const playablePaths = Object.values(GEO.countries).map(pc => {
      const isSel = pc.code === atlasCountryCode;
      const ownedCnt = pc.cities.filter(ct => ownsCity(ct.id)).length;
      return `<g class="playable-country-group" data-open-country="${pc.code}">
        <path class="country-playable${isSel ? ' selected' : ''}" d="${pc.worldPath}"/>
        <rect x="${pc.worldLabelX - 46}" y="${pc.worldLabelY - 12}" width="92" height="22" rx="6" fill="#0f172a" stroke="#facc15" stroke-width="1.3" style="cursor:pointer"/>
        <text x="${pc.worldLabelX}" y="${pc.worldLabelY + 2}" text-anchor="middle" font-size="10.5" font-weight="700" font-family="Figtree, sans-serif" fill="#fef08a" pointer-events="none">${pc.flag} ${pc.name} (${ownedCnt}/${pc.cities.length})</text>
      </g>`;
    }).join('');

    svgHtml = `<svg class="atlas-svg" viewBox="0 0 1000 500" aria-label="Geographical World Map">
      ${gridLines.join('')}
      ${lockedPaths}
      ${playablePaths}
    </svg>`;

    inspectorHtml = `<div class="atlas-inspector">
      <div class="atlas-info">
        <h4>🌍 World Agricultural Atlas · Click Any Highlighted Country</h4>
        <p>Select a playable country on the geographical world map (<strong>Canada</strong>, <strong>Brazil</strong>, <strong>France</strong>, or <strong>Japan</strong>) to inspect its regional map and cities. Grey countries are marked Coming Soon.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${Object.values(GEO.countries).map(pc => `<button class="chipbtn" type="button" data-open-country="${pc.code}">${pc.flag} ${pc.name} →</button>`).join('')}
      </div>
    </div>`;
  } else {
    // COUNTRY DETAIL VIEW (viewBox 0 0 800 520) with geographically positioned cities!
    const featHtml = (cObj.geographicFeatures || []).map(f => {
      if (f.type === 'water') return `<path d="${f.path}" fill="#93c5fd" stroke="#3b82f6" stroke-width="1.2" opacity="0.85"/>${f.lx ? `<text x="${f.lx}" y="${f.ly}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e3a8a" font-family="Courier Prime, monospace">${f.name}</text>` : ""}`;
      if (f.type === 'river') return `<path d="${f.path}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>`;
      return `<path d="${f.path}" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="5 5"/>`;
    }).join('');

    const cityPins = cObj.cities.map(ct => {
      const isCur = ct.id === selCity.id;
      const isOwned = ownsCity(ct.id);
      const pinCol = isCur ? '#ef4444' : (isOwned ? '#eab308' : '#16a34a');
      return `<g class="city-pin" data-pick-city="${ct.id}" transform="translate(${ct.x},${ct.y})">
        <circle class="pin-outer" cx="0" cy="0" r="${isCur ? 11 : 8}" fill="${pinCol}" stroke="#ffffff" stroke-width="2.2"/>
        <circle cx="0" cy="0" r="3.2" fill="#ffffff"/>
        <rect x="-68" y="-30" width="136" height="18" rx="5" fill="${isCur ? '#1e293b' : 'rgba(255,253,242,0.92)'}" stroke="${pinCol}" stroke-width="1.2"/>
        <text x="0" y="-18" text-anchor="middle" font-size="10" font-weight="700" font-family="Figtree, sans-serif" fill="${isCur ? '#fde047' : '#0f172a'}">${isOwned ? '👑 ' : ''}${ct.name}</text>
      </g>`;
    }).join('');

    svgHtml = `<svg class="atlas-svg" viewBox="0 0 800 520" aria-label="${cObj.name} Regional Map">
      <path d="${cObj.countryOutline}" fill="#dcfce7" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/>
      ${featHtml}
      ${cityPins}
    </svg>`;

    const bestRec = (meta.cityRecords && meta.cityRecords[selCity.id]) || 0;
    const isOwned = ownsCity(selCity.id);
    const cropBadges = (selCity.crops || []).map(ck => `<span class="crop-badge">${CROP[ck] ? CROP[ck].name : ck}</span>`).join('');

    inspectorHtml = `<div class="atlas-inspector">
      <div class="atlas-info">
        <h4>${cObj.flag} ${selCity.name} <small style="font-size:12px;color:#64748b">(${selCity.province} · Bills ×${selCity.mul})</small></h4>
        <p>${selCity.desc}</p>
        <p style="font-family:var(--font-type);font-size:11px;color:#0f172a">
          <strong>${isOwned ? '👑 DEED OWNED BY YOU' : `Rival Holder: ${selCity.rival} (Record: $${selCity.record}/day)`}</strong>
          · Your Best: $${bestRec}/day · Regional Tribute: <span style="color:#15803d">${selCity.buff}</span>
        </p>
        <div class="crop-badges">${cropBadges}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <button class="btn" type="button" data-enter-city="${selCity.id}" ${mode !== 'idle' ? 'disabled' : ''}>Enter ${selCity.name} Farm →</button>
        <button class="chipbtn" type="button" data-back-world="1">← Back to World Map</button>
      </div>
    </div>`;
  }

  lastFocus = document.activeElement;
  el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">${atlasView === 'world' ? 'GLOBAL AGRICULTURAL ATLAS · STEP 1 OF 2' : `${cObj.flag} ${cObj.name.toUpperCase()} REGIONAL MAP · STEP 2 OF 2`}</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 8px">${atlasView === 'world' ? 'Select a Country on the World Map' : `${cObj.name} — Select a City & Agricultural Region`}</h3>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${atlasView === 'country' ? `<button class="chipbtn" type="button" data-back-world="1">🌍 ← World Map</button>` : ''}
        <button class="chipbtn" type="button" data-close>Close</button>
      </div>
    </div>
    <div class="atlas-Viewport">${svgHtml}</div>
    ${inspectorHtml}
  </div>`;
  el.modal.hidden = false; renderCard();
}

function openSkillTreeModal(){
  if (mode === 'day') setPaused(true);
  const selNode = SKILL_NODES.find(n => n.id === selectedSkillId) || SKILL_NODES[0];
  const nodeMap = {};
  SKILL_NODES.forEach(n => nodeMap[n.id] = n);

  // Build directed edges between prerequisite nodes and child nodes
  const edgesSvg = [];
  for (const n of SKILL_NODES) {
    for (const reqId of (n.reqs || [])) {
      const pNode = nodeMap[reqId];
      if (!pNode) continue;
      const bothLearned = hasSkill(n.id) && hasSkill(reqId);
      const avail = hasSkill(reqId) && !hasSkill(n.id);
      const stroke = bothLearned ? '#facc15' : (avail ? '#38bdf8' : 'rgba(148,163,184,0.28)');
      const sw = bothLearned ? 3.5 : (avail ? 2.5 : 1.8);
      const dash = avail ? 'stroke-dasharray="6 5"' : '';
      const mx = (pNode.x + n.x) * 0.5, my = (pNode.y + n.y) * 0.5 - 14;
      edgesSvg.push(`<path d="M ${pNode.x},${pNode.y} Q ${mx},${my} ${n.x},${n.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" ${dash}/>`);
    }
  }

  const branchColors = {
    core: '#fde047',
    reap: '#f87171',
    soil: '#4ade80',
    gold: '#fbbf24'
  };

  const nodesSvg = SKILL_NODES.map(n => {
    const learned = hasSkill(n.id);
    const avail = !learned && skillPrereqsMet(n);
    const isSel = n.id === selNode.id;
    const bCol = branchColors[n.branch] || '#fde047';
    const fill = learned ? '#facc15' : (avail ? '#0f172a' : '#1e293b');
    const stroke = isSel ? '#ffffff' : (learned ? '#fef08a' : (avail ? '#38bdf8' : '#475569'));
    const textCol = learned ? '#0f172a' : '#f8fafc';
    return `<g class="tree-node-g" data-select-skill="${n.id}" transform="translate(${n.x},${n.y})" style="cursor:pointer">
      ${isSel ? `<circle cx="0" cy="0" r="34" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-dasharray="4 4"/>` : ''}
      <circle cx="0" cy="0" r="26" fill="${fill}" stroke="${stroke}" stroke-width="${isSel ? 3.2 : 2.2}"/>
      <text x="0" y="5" text-anchor="middle" font-size="18" fill="${textCol}" pointer-events="none">${n.icon}</text>
      <rect x="-64" y="29" width="128" height="17" rx="4" fill="rgba(6,14,12,0.88)" stroke="${bCol}" stroke-width="0.9"/>
      <text x="0" y="40" text-anchor="middle" font-size="9.5" font-weight="700" font-family="Figtree, sans-serif" fill="${learned ? '#fde047' : '#e2e8f0'}" pointer-events="none">${n.name} ${learned ? '✓' : ''}</text>
    </g>`;
  }).join('');

  const selLearned = hasSkill(selNode.id);
  const selAvail = !selLearned && skillPrereqsMet(selNode);
  const canAfford = selAvail && (meta.diamonds || 0) >= 1 && mode === 'idle';
  const reqNames = (selNode.reqs || []).map(rid => {
    const rn = nodeMap[rid];
    const ok = hasSkill(rid);
    return `${rn ? rn.name : rid} (${ok ? '✓ Learned' : 'Locked'})`;
  });
  const reqLabel = !reqNames.length
    ? 'Prerequisites: None (Root Node)'
    : `Prerequisites (${selNode.reqMode === 'any' ? 'Either path' : 'Required'}): ${reqNames.join(selNode.reqMode === 'any' ? ' OR ' : ', ')}`;

  lastFocus = document.activeElement;
  el.modal.innerHTML = `<div class="sheet tree-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">SPATIAL SKILL CODEX · 1 💎 DIAMOND PER NODE (GRIT UNCHANGED: ${meta.grit} GRIT)</p>
        <h3 class="mtitle" id="mTitle" style="color:#fde047;margin:2px 0 6px">The Harvester's Branching Skill Tree</h3>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="stamp ok" style="color:#38bdf8;border-color:#38bdf8">💎 ${meta.diamonds || 0} Diamonds</span>
        <button class="chipbtn" type="button" data-close>Close</button>
      </div>
    </div>
    <div class="tree-viewport" id="treeViewport">
      <div class="tree-controls">
        <button type="button" data-tree-zoom="in">Zoom +</button>
        <button type="button" data-tree-zoom="out">Zoom −</button>
        <button type="button" data-tree-zoom="reset">Reset View</button>
      </div>
      <svg id="treeSvg" class="atlas-svg" viewBox="${200 - treePanX} ${60 - treePanY} ${Math.round(600 / treeZoom)} ${Math.round(460 / treeZoom)}" aria-label="Branching Skill Tree">
        <text x="160" y="55" font-size="13" font-weight="800" fill="#fca5a5" font-family="Big Shoulders Stencil, sans-serif">I · WAY OF THE REAP (SPEED / CLEAVE)</text>
        <text x="515" y="28" font-size="13" font-weight="800" fill="#86efac" font-family="Big Shoulders Stencil, sans-serif">II · WAY OF THE SOIL (ABUNDANCE / SOLSTICE)</text>
        <text x="615" y="565" font-size="13" font-weight="800" fill="#fde047" font-family="Big Shoulders Stencil, sans-serif">III · WAY OF FORTUNE (COUNSEL / HERD)</text>
        ${edgesSvg.join('')}
        ${nodesSvg}
      </svg>
    </div>
    <div class="tree-inspector">
      <div style="flex:1;min-width:240px">
        <h4>${selNode.icon} ${selNode.name} <small style="font-size:13px;color:#38bdf8">· Cost: 1 💎 Diamond</small></h4>
        <p>${selNode.desc}</p>
        <p class="tree-reqline">${reqLabel} · <em>Earn Diamonds every 2nd bill paid (+1 💎), by beating a City Rival (+1 💎), or paying a Deed (+2 💎).</em></p>
      </div>
      <div>
        <button class="btn" type="button" data-learn-skill="${selNode.id}" ${canAfford ? '' : 'disabled'} style="background:${selLearned ? '#15803d' : '#0284c7'};color:#fff">
          ${selLearned ? 'Learned ✓' : (selAvail ? 'Learn Skill (1 💎)' : 'Locked (Needs Prereq)')}
        </button>
      </div>
    </div>
  </div>`;
  el.modal.hidden = false; renderCard();
  updateTreeViewBox();
  bindTreeDrag();
}

function updateTreeViewBox(){
  const svg = $('#treeSvg');
  if (!svg) return;
  const w = Math.round(1000 / treeZoom), h = Math.round(580 / treeZoom);
  const vx = Math.round((1000 - w) * 0.5 - treePanX);
  const vy = Math.round((580 - h) * 0.5 - treePanY);
  svg.setAttribute('viewBox', `${vx} ${vy} ${w} ${h}`);
}

function bindTreeDrag(){
  const vp = $('#treeViewport');
  if (!vp) return;
  let dragging = false, sx = 0, sy = 0;
  vp.onpointerdown = e => {
    if (e.target.closest('button') || e.target.closest('.tree-node-g')) return;
    dragging = true; sx = e.clientX; sy = e.clientY;
    try { vp.setPointerCapture(e.pointerId); } catch(err){}
  };
  vp.onpointermove = e => {
    if (!dragging) return;
    treePanX += (e.clientX - sx) / treeZoom;
    treePanY += (e.clientY - sy) / treeZoom;
    sx = e.clientX; sy = e.clientY;
    updateTreeViewBox();
  };
  vp.onpointerup = () => { dragging = false; };
}

function learnSkillNode(id){
  if (mode !== 'idle') return;
  const node = SKILL_NODES.find(n => n.id === id);
  if (!node || hasSkill(id) || !skillPrereqsMet(node)) return;
  if ((meta.diamonds || 0) < 1) return;
  meta.diamonds -= 1; // Spends exactly 1 Diamond; leaves meta.grit 100% unchanged!
  if (!Array.isArray(meta.learnedSkills)) meta.learnedSkills = [];
  meta.learnedSkills.push(id);
  cur = stats();
  Sound.init(); Sound.fanfare();
  save(); renderAll(); openSkillTreeModal();
  toast(`Learned ${node.name} (−1 💎 Diamond, Grit unchanged)!`);
}

function openArthurStudioModal(stateOverride){
  if (mode === 'day') setPaused(true);
  if (stateOverride) arthurStudioState = stateOverride;
  const states = [
    ['idle', '1. Idle (Watch Check)'],
    ['smug', '2. Smug Anticipation'],
    ['demand', '3. Demanding Payment'],
    ['anger', '4. Furious Anger'],
    ['shock', '5. Shocked Defeat']
  ];
  lastFocus = document.activeElement;
  el.modal.innerHTML = `<div class="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">
    <div class="mtop">
      <div>
        <p class="eyebrow">AUTHORED CHARACTER &amp; SKELETAL RIG SHOWCASE</p>
        <h3 class="mtitle" id="mTitle" style="margin:2px 0 6px">Arthur Grumble — Gameplay Size (1×) &amp; Enlarged (3.6×)</h3>
      </div>
      <button class="chipbtn" type="button" data-close>Close Studio</button>
    </div>
    <canvas id="arthurStudioCanvas" class="arthur-studio-canvas" width="840" height="320"></canvas>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:space-between;align-items:center">
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${states.map(([stKey, label]) => `<button class="chipbtn" type="button" data-arthur-state="${stKey}" style="${arthurStudioState === stKey ? 'background:#1e293b;color:#fde047;border-color:#1e293b' : ''}">${label}</button>`).join('')}
      </div>
      <span style="font-family:var(--font-type);font-size:11px;color:#475569">Sculpted jowls · Articulated jaw &amp; 4-fingered hands · Coat-tail physics</span>
    </div>
  </div>`;
  el.modal.hidden = false; renderCard();
  startArthurStudioLoop();
}

function startArthurStudioLoop(){
  cancelAnimationFrame(arthurStudioTimer);
  const c = $('#arthurStudioCanvas');
  if (!c || el.modal.hidden) return;
  const g = c.getContext('2d');
  const step = (now) => {
    if (!document.body.contains(c) || el.modal.hidden) return;
    const t = now / 1000;
    g.clearRect(0, 0, c.width, c.height);
    // Background studio comparison labels (placed to the left of the enlarged rig so his top hat never overlaps!)
    g.fillStyle = 'rgba(15, 23, 42, 0.68)';
    g.fillRect(24, 16, 225, 26);
    g.fillRect(275, 16, 240, 44);
    g.fillStyle = '#fef08a';
    g.font = 'bold 11.5px "Courier Prime", monospace';
    g.fillText('GAMEPLAY SCALE (1.0×)', 36, 33);
    g.fillText('ENLARGED AUTHORED RIG (3.2×)', 287, 33);
    g.fillStyle = '#38bdf8';
    g.fillText(`STATE: ${arthurStudioState.toUpperCase()}`, 287, 50);

    // Fence reference line behind 1x Arthur
    g.strokeStyle = '#785638'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(40, 235); g.lineTo(220, 235); g.stroke();

    const phaserScene = (window as any).__PHASER_FARM_SCENE;
    if (phaserScene && phaserScene.textures.exists('arthur')) {
      const frameIdx = Math.floor(t * (arthurStudioState === 'anger' ? 14 : 10)) % 6;
      const frameName = `${arthurStudioState}_${frameIdx}`;
      const tex = phaserScene.textures.get('arthur');
      const fData = tex.frames[frameName] || tex.frames['idle_0'];
      if (fData) {
        const { cutX: sx, cutY: sy, cutWidth: sw, cutHeight: sh } = fData;
        // 1. Normal gameplay size (0.27x = 86x113 px)
        const norm = 320 / sw; const gw = sw * 0.27 * norm, gh = sh * 0.27 * norm;
        g.drawImage(tex.getSourceImage(), sx, sy, sw, sh, 130 - gw * 0.5, 255 - gh * 0.95, gw, gh);
        // 2. Enlarged 0.74x inspection size (237x311 px — 2.75x gameplay size!)
        const ew = sw * 0.74 * norm, eh = sh * 0.74 * norm;
        g.drawImage(tex.getSourceImage(), sx, sy, sw, sh, 635 - ew * 0.5, 312 - eh * 0.95, ew, eh);
      }
    }
    arthurStudioTimer = requestAnimationFrame(step);
  };
  arthurStudioTimer = requestAnimationFrame(step);
}

function askWipe(){
  openModal(
    `<h3 class="mtitle" id="mTitle">Wipe your save?</h3><p>This deletes your farm, your Grit and every heirloom in this browser. It can't be undone.</p>` +
    `<div class="mact"><button class="btn" type="button" data-close>Keep my save</button><button class="btn money" type="button" data-wipe>Wipe everything</button></div>`
  );
}
function wipe(){
  const fresh = SaveSystem.resetToDefaults(meta.sound);
  meta = fresh.meta; farm = fresh.farm; dayCheckpoint = null;
  cur = stats(); mode = 'idle'; paused = false; goat = null;
  stage.classList.remove('playing'); keys.clear(); pointer.active = false; pointer.down = false;
  syncPause(); fillIdle(); lastStampKey = ''; closeModal(); renderAll();
  toast(SaveSystem.getStatus().state === 'saved' ? 'Fresh farm saved. Previous progress erased.' : 'Fresh farm started for this session. Storage is unavailable; old progress may return on restart.', 5000);
}

let lastFocus = null;
function openModal(html){
  if (mode === 'day') setPaused(true);
  lastFocus = document.activeElement;
  el.modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mTitle">${html}</div>`;
  el.modal.hidden = false; renderCard();
  const b = el.modal.querySelector('button'); if (b) b.focus();
}
function closeModal(){
  el.modal.hidden = true; el.modal.innerHTML = ''; renderCard();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

/* events */
el.overlay.addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const act = b.dataset.act; Sound.init(); Sound.click();
  if (act === 'start') startDay(); else if (act === 'pay') payBill(); else if (act === 'bank') foreclose(); else if (act === 'map') openWorldMapModal('world'); else if (act === 'skills') openSkillTreeModal(); else if (act === 'arthur') openArthurStudioModal('demand');
});
el.notice.addEventListener('click', e => { if (e.target.closest('#btnPay')) payBill(); });
el.shedList.addEventListener('click', e => { const b = e.target.closest('button[data-buy]'); if (b) buyShed(b.dataset.buy); });
el.heirList.addEventListener('click', e => { const b = e.target.closest('button[data-heir]'); if (b) buyHeir(b.dataset.heir); });
el.modal.addEventListener('click', e => {
  const countryEl = e.target.closest('[data-open-country]');
  if (countryEl) {
    Sound.click();
    openWorldMapModal('country', countryEl.dataset.openCountry);
    return;
  }
  const lockedEl = e.target.closest('[data-locked-country]');
  if (lockedEl) {
    Sound.click();
    toast(`${lockedEl.dataset.lockedCountry} is marked Coming Soon. Select Canada, Brazil, France, or Japan!`);
    return;
  }
  const cityPin = e.target.closest('[data-pick-city]');
  if (cityPin) {
    Sound.click();
    atlasCityId = cityPin.dataset.pickCity;
    openWorldMapModal('country', atlasCountryCode);
    return;
  }
  const skillG = e.target.closest('[data-select-skill]');
  if (skillG) {
    Sound.click();
    selectedSkillId = skillG.dataset.selectSkill;
    openSkillTreeModal();
    return;
  }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.perk) choosePerk(b.dataset.perk);
  else if (b.dataset.backWorld) { Sound.click(); openWorldMapModal('world'); }
  else if (b.dataset.enterCity) {
    if (mode === 'idle') {
      meta.country = atlasCountryCode;
      meta.cityId = b.dataset.enterCity;
      sceneryKey = ''; buildFieldLayer();
      cur = stats(); fillIdle();
      Sound.click(); closeModal(); save(); renderAll();
      toast(`Entered ${curCity().name}, ${curCountry().name} (${curCity().province})`);
    }
  }
  else if (b.dataset.learnSkill) learnSkillNode(b.dataset.learnSkill);
  else if (b.dataset.treeZoom) {
    const zAct = b.dataset.treeZoom;
    if (zAct === 'in') treeZoom = Math.min(2.2, treeZoom * 1.25);
    else if (zAct === 'out') treeZoom = Math.max(0.75, treeZoom / 1.25);
    else { treeZoom = 1.0; treePanX = 0; treePanY = 0; }
    updateTreeViewBox();
  }
  else if (b.dataset.saveAct) {
    const act = b.dataset.saveAct;
    if (act === 'copy') {
      const box = document.getElementById('exportSaveBox') as HTMLTextAreaElement | null;
      if (box && navigator.clipboard) navigator.clipboard.writeText(box.value).catch(() => {});
      toast('Save JSON copied to clipboard!');
    } else if (act === 'download') {
      const json = SaveSystem.exportSaveJson(meta, farm);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `due_by_dusk_save_day${farm.day}.json`;
      a.click();
      toast('Downloaded save file!');
    } else if (act === 'backup') {
      const bk = SaveSystem.getBackupJson() || '{}';
      const blob = new Blob([bk], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'due_by_dusk_v1_backup.json';
      a.click();
      toast('Downloaded pre-migration backup!');
    } else if (act === 'import') {
      const box = document.getElementById('importSaveBox') as HTMLTextAreaElement | null;
      try {
        const res = SaveSystem.importSaveJson(box ? box.value : '', meta, farm);
        meta = res.meta;
        farm = res.farm;
        mode = 'idle'; dayCheckpoint = null; paused = false;
        keys.clear(); pointer.active = false; pointer.down = false;
        crops = []; parts = []; texts = []; goat = null;
        stage.classList.remove('playing'); syncPause();
        sceneryKey = '';
        buildFieldLayer();
        cur = stats();
        fillIdle();
        renderAll();
        const rep = res.migrationReport;
        const msg = rep && rep.gritRefundedFromLegacySkills > 0
          ? `Imported & migrated save! Refunded +${rep.gritRefundedFromLegacySkills} Grit from legacy skills.`
          : `Imported save! Loaded Farm No. ${farm.no}, Day ${farm.day}, ${meta.grit} Grit, 💎 ${meta.diamonds}.`;
        openSaveTransferModal(msg);
        toast(msg, 3800);
      } catch (err: any) {
        openSaveTransferModal('Import error: ' + (err && err.message ? err.message : String(err)));
      }
    }
  }
  else if (b.dataset.arthurState) {
    Sound.click();
    openArthurStudioModal(b.dataset.arthurState);
  }
  else if (b.dataset.wipe !== undefined) wipe();
  else if (b.dataset.close !== undefined){ Sound.click(); closeModal(); }
});
el.modal.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !farm.pendingPerks){ closeModal(); return; }
  if (e.key !== 'Tab') return;
  const f = [...el.modal.querySelectorAll('button')]; if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
});
el.btnSound.addEventListener('click', () => { meta.sound = !meta.sound; Sound.on = meta.sound; if (meta.sound){ Sound.init(); Sound.click(); } save(); renderHeader(); });
const biomeBtn = $('#btnBiome'), skillTreeBtn = $('#btnSkillTree');
if (biomeBtn) biomeBtn.addEventListener('click', () => {
  if (mode !== 'idle') return;
  Sound.init(); Sound.click();
  openWorldMapModal();
});
if (skillTreeBtn) skillTreeBtn.addEventListener('click', () => {
  if (mode !== 'idle') return;
  Sound.init(); Sound.click();
  openSkillTreeModal();
});
const saveTransferBtn = $('#btnSaveTransfer');
if (saveTransferBtn) saveTransferBtn.addEventListener('click', () => {
  if (mode !== 'idle') return;
  Sound.init(); Sound.click();
  openSaveTransferModal();
});
const arthurBtn = $('#btnArthurStudio');
if (arthurBtn) arthurBtn.addEventListener('click', () => {
  if (mode !== 'idle') return;
  Sound.init(); Sound.click();
  openArthurStudioModal('demand');
});
el.btnReset.addEventListener('click', askWipe);
const pauseButton = $('#btnPause'), resumeButton = $('#btnResume');
if (pauseButton) pauseButton.addEventListener('click', () => setPaused(!paused));
if (resumeButton) resumeButton.addEventListener('click', () => setPaused(false));
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'day') setPaused(true); });

function toWorld(e){
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale - (e.pointerType === 'touch' ? playerSettings.touchOffset / scale : 0)];
}
canvas.addEventListener('pointermove', e => {
  const [x, y] = toWorld(e);
  pointer.vx = (x - pointer.x) * 30;
  pointer.vy = (y - pointer.y) * 30;
  pointer.x = x; pointer.y = y; pointer.placed = true;
  if (e.pointerType === 'mouse'){ pointer.active = true; pointer.kind = 'mouse'; } else if (pointer.down) pointer.active = true;
});
canvas.addEventListener('pointerdown', e => {
  const [x, y] = toWorld(e);
  pointer.x = x; pointer.y = y; pointer.placed = true; pointer.down = true; pointer.active = true; pointer.kind = e.pointerType;
  if (e.pointerType !== 'mouse' && mode === 'day'){ try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
});
const pUp = e => {
  if (e.type !== 'pointercancel' && mode === 'day' && !paused && chargeT >= .72) unleashChargeCleave();
  chargeT = 0; chargeReady = false; pointer.down = false;
  if (e.pointerType !== 'mouse') pointer.active = false;
};
canvas.addEventListener('pointerup', pUp); canvas.addEventListener('pointercancel', pUp);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.active = false; });
const MOVE_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' '];
addEventListener('keydown', e => {
  if (mode !== 'day') return;
  const k = e.key.toLowerCase();
  if ((k === 'p' || k === 'escape') && el.modal.hidden){ e.preventDefault(); setPaused(!paused); return; }
  if (paused || !MOVE_KEYS.includes(k)) return;
  e.preventDefault(); keys.add(k);
  if (!pointer.placed || pointer.kind !== 'key'){ pointer.kind = 'key'; if (!pointer.placed){ pointer.x = worldW / 2; pointer.y = (FIELD_TOP + HW) / 2; pointer.placed = true; } }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); pointer.active = false; pointer.down = false; });

/* loop */
let last = 0;
function frame(now){
  const elapsed = last ? Math.max(0, (now - last) / 1000) : 0; last = now;
  if (elapsed > 3.5 && mode === 'day' && !paused) setPaused(true);
  let remaining = Math.min(elapsed, 0.75);
  while (remaining > 0){ const step = Math.min(1 / 60, remaining); update(step); remaining -= step; }
  draw(); updateHud();
  requestAnimationFrame(frame);
}

/* Paper ledger tabs: keep the field in view while planning the next day. */
function showLedgerPage(name){
  document.querySelectorAll('.ledger-tab').forEach(b => { const selected = b.dataset.page === name; b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1; });
  document.querySelectorAll('.ledger-page').forEach(p => p.hidden = p.id !== 'page-' + name);
}
document.querySelectorAll('.ledger-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('click', () => { showLedgerPage(tab.dataset.page); Sound.click(); });
  tab.addEventListener('keydown', e => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; showLedgerPage(tabs[next].dataset.page); tabs[next].focus(); });
});

export class FarmScene extends Phaser.Scene {
  public arthurSprite: any = null;
  public sceneRenderObj: any = null;

  constructor() {
    super({ key: 'FarmScene' });
  }

  public create(): void {
    (window as any).__PHASER_FARM_SCENE = this;
    const saved = (window as any).__DBD_INITIAL_SAVE || loadSavedState();
    if (saved) {
      meta = saved.meta;
      farm = saved.farm;
    } else {
      farm = newFarm();
    }
    Sound.on = meta.sound;

    // Create Arthur Grumble Sprite GameObject backed by the 30-frame Phaser Texture Atlas!
    this.arthurSprite = this.add.sprite(0, 0, 'arthur', 'idle_0');
    this.arthurSprite.setOrigin(0.5, 0.95);
    this.arthurSprite.setVisible(false); // Rendered in scene depth pass alongside fence & speech bubble
    this.arthurSprite.play('arthur_idle');

    cur = stats();
    buildSprites();
    resize();
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => resize()).observe(stage);
    } else {
      addEventListener('resize', resize);
    }
    fillIdle();
    renderAll();
    if (farm.pendingPerks) openPerkModal();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('800 24px "Big Shoulders Stencil"').catch(() => {});
    }

    // Expose programmatic test hooks for automated headless verification
    if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') (window as any).__DBD_TEST = {
      getScene: () => this,
      getState: () => ({ mode, meta, farm, time, dayLen, paused, chargeT, cleaveRingCount: parts.filter(p => p.k === 'ring' && p.c === '#38bdf8').length, cropsCount: crops.length }),
      openArthurStudio: (st: string) => { mode = 'idle'; openArthurStudioModal(st); },
      openWorldMap: () => { mode = 'idle'; openWorldMapModal('world'); },
      openCountryMap: (cc: string) => { mode = 'idle'; openWorldMapModal('country', cc); },
      openSkillTree: () => { mode = 'idle'; openSkillTreeModal(); },
      openSaveTransfer: () => { mode = 'idle'; openSaveTransferModal(); },
      testSaveMigration: (rawJson: string) => SaveSystem.importSaveJson(rawJson, meta, farm),
      hasBackup: () => !!SaveSystem.getBackupJson(),
      startPlayableDay: (cc: string, cityId: string, arthurOverride?: string) => {
        closeModal();
        meta.country = cc as any;
        meta.cityId = cityId;
        farm.billsPaid = 4;
        farm.bill = 4;
        farm.shed.soil = 4;
        sceneryKey = '';
        buildFieldLayer();
        cur = stats();
        startDay();
        dawnFade = 0;
        if (arthurOverride === 'shock') {
          farm.cash = billObj(farm.bill).amt + 100;
          time = 5.5;
        } else if (arthurOverride === 'demand') {
          farm.cash = 25;
          time = 3.8;
        } else if (arthurOverride === 'anger') {
          arthurAngerTimer = 5.0;
          time = 8.0;
        } else if (arthurOverride === 'smug') {
          farm.cash = 10;
          time = 7.2;
        } else {
          time = dayLen * 0.48;
        }
        const allowed = curCity().crops;
        crops.forEach((c: any, idx: number) => {
          const tp = allowed[idx % allowed.length];
          c.type = tp;
          c.r = CROP[tp].r;
          c.age = 1.5;
          c.stage = 3;
          c.frosted = false;
          c.eye = idx === 1 ? 0.9 : 0;
          if (tp === 'pumpkin') { c.hatProgress = 1; c.scarfProgress = 1; }
        });
        pointer.active = true;
        pointer.x = worldW * 0.48;
        pointer.y = FIELD_TOP + 180;
        swing();
      }
    };
  }

  public update(_timeMs: number, deltaMs: number): void {
    if (deltaMs > 1500 && mode === 'day') setPaused(true);
    const elapsed = Math.min(deltaMs / 1000, .1);
    let remaining = elapsed;
    while (remaining > 0) {
      const step = Math.min(1 / 60, remaining);
      update(step);
      remaining -= step;
    }
    draw();
    // Apply Phaser Camera 2D flash overlay if active
    if (this.cameras && this.cameras.main && this.cameras.main.flashTimer > 0) {
      const fa = (this.cameras.main.flashTimer / this.cameras.main.flashDuration) * 0.35;
      ctx.save();
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.fillStyle = `rgba(${this.cameras.main.flashColor},${fa})`;
      ctx.fillRect(0, 0, worldW, HW);
      ctx.restore();
    }
    updateHud();
  }
}



window.addEventListener('dbd:management', e => { if (e.detail.open) setPaused(true); });
window.addEventListener('dbd:pause', () => { setPaused(true); save(); if (Sound.ctx) void Sound.ctx.suspend(); });
window.addEventListener('dbd:back', e => {
  if (!el.modal.hidden) { closeModal(); e.preventDefault(); }
  else if (mode === 'day' && !paused) { setPaused(true); e.preventDefault(); }
});
window.addEventListener('pagehide', () => { setPaused(true); save(); });
window.addEventListener('dbd:settings', e => {
  Object.assign(playerSettings, e.detail);
  reduceMotion = playerSettings.reducedEffects || motionPreference.matches;
  setHapticsEnabled(playerSettings.haptics);
  if (!storeSettings(playerSettings)) toast('Settings could not be saved on this device.');
});
