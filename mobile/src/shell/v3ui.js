// @ts-nocheck
// Claude's v3 shell (menu, world map, France, Avignon card, farm HUD, sundown), carried over unchanged from the one-day test.
(function () {
  'use strict';
  var T = null;
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var ICON = { market: '💰', gale: '🍂', rain: '🌧️', frost: '❄️', fair: '🧶', stampede: '🐐' };
  // Gemini's bill names, shortened to fit the bank chip (the sundown notice keeps the full name)
  var SHORT = { 'Seed loan': 'Seed loan', 'New fence': 'Fence', 'Tractor transmission': 'Tractor', 'Pond water rights': 'Pond rights', 'Barn roof': 'Barn roof',
    "Grandma's pie insurance": 'Pie cover', 'Property tax': 'Taxes', "The scarecrow's lawyer": 'Lawyer', 'The deed': 'The deed' };
  var touchy = false;
  try { touchy = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}
  var SPR = window.__DBD_SPR || {};
  var PREVIEW = window.__DBD_PREVIEW || '';
  var screens = document.getElementById('dbdScreens');
  var st = {
    scr: 'menu', worldSel: 'FR', citySel: 'fr_avignon',
    setup: LS.get('dbd-oneday-setup', 11), best: LS.get('dbd-oneday-best', 0), crown: LS.get('dbd-oneday-crown', false),
    stats: null, playing: false, ev: null, nextEv: null, cities: [], prev: ''
  };
  function money(v) { return '$' + Math.round(Math.max(0, v)).toLocaleString('en-US'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  var LOCK = '<svg width="16" height="17" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#5A3E2B"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#5A3E2B" stroke-width="1.8"></path></svg>';
  var CROWN = '<svg width="22" height="18" viewBox="0 0 24 20" aria-hidden="true"><path d="M2 6 L7 11 L12 3 L17 11 L22 6 L20 17 L4 17 Z" fill="#FFC23D" stroke="#2B1708" stroke-width="2.4" stroke-linejoin="round"></path></svg>';
  function star(on) { return '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L7 10.1 3.6 11.9l.7-3.8L1.5 5.5l3.8-.5z" fill="' + (on ? '#FFC23D' : '#FFFFFF') + '" stroke="#2B1708" stroke-width="1.4" stroke-linejoin="round"></path></svg>'; }

  // ---------------- layout ----------------
  function layout() {
    // one scale for all the sticker UI: follow the height, but never so big that the HUD's left, centre and right groups meet
    var w = window.innerWidth, h = window.innerHeight, s = clamp(Math.min(h / 390, (w / 2 - 10) / 375), 0.6, 1.7);
    document.documentElement.style.setProperty('--s', String(s));
    // fill the height on phones; on squarer screens crop at most ~4% a side and let the section colour fill above and below
    var k = Math.max(w / 844, Math.min(h / 390, w / (844 * 0.92)));
    screens.querySelectorAll('.bg').forEach(function (bg) { bg.style.transform = 'translate(-50%, -50%) scale(' + k + ')'; });
    screens.classList.toggle('lb', k * 390 < h - 2);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });

  // ---------------- data ----------------
  var COUNTRIES = {
    FR: { name: 'France', farms: '5 farms', blurb: 'Lavender hills, Loire castles and Breton fields.', open: true },
    CA: { name: 'Canada', farms: '6 farms', blurb: 'First snow, maple shacks and red-clay potatoes.' },
    US: { name: 'United States', farms: '3 farms', blurb: 'Ranches, corn country and BBQ pits.' },
    BR: { name: 'Brazil', farms: '5 farms', blurb: 'Tropical rain, red soil and the Amazon delta.' },
    MA: { name: 'Morocco', farms: '3 farms', blurb: 'Oasis gardens and olive groves on the edge of the desert.' },
    CN: { name: 'China', farms: '3 farms', blurb: 'Karst peaks, West Lake and the Sichuan basin.' },
    JP: { name: 'Japan', farms: '5 farms', blurb: 'Rice terraces under Mt. Fuji.' }
  };
  var ORDER = ['fr_avignon', 'fr_beaune', 'fr_tours', 'fr_roscoff', 'fr_agen'];
  function city(id) { for (var i = 0; i < st.cities.length; i++) if (st.cities[i].id === id) return st.cities[i]; return { id: id, name: id, rival: '', record: 0, desc: '' }; }
  function prep() { if (!T) return; T.claudePrep(st.setup); try { st.nextEv = T.claudeEvent(); } catch (e) { st.nextEv = null; } }
  function starsFor(best, record) { return [best >= record * 0.5, best >= record, best >= record * 1.5]; }

  // ---------------- screens ----------------
  function show(name) {
    st.prev = st.scr; st.scr = name;
    screens.querySelectorAll('[data-scr]').forEach(function (el) { el.hidden = el.getAttribute('data-scr') !== name; });
    screens.style.display = name === 'farm' ? 'none' : '';
    document.body.classList.toggle('dbd-onscr', name !== 'farm');
    closeModal();
    if (name === 'world') openWorld();
    if (name === 'france') renderFrance();
    if (name === 'sundown') renderSundown();
    syncSound();
    layout();
  }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var cloudT = 0;
  function openWorld() {
    var sec = screens.querySelector('[data-scr="world"]'), art = $('dbdWorldArt'), clouds = screens.querySelectorAll('[data-cloud]');
    var to = { a: 'translate(-640px, -160px)', b: 'translate(640px, -160px)', c: 'translate(-680px, 160px)', d: 'translate(680px, 180px)' };
    function parted() { art.style.transform = 'scale(1)'; clouds.forEach(function (c) { c.style.transform = to[c.getAttribute('data-cloud')]; }); }
    clearTimeout(cloudT);
    sec.classList.add('snap');
    if (st.prev === 'menu' && !reduceMotion) {
      art.style.transform = 'scale(1.12)';
      clouds.forEach(function (c) { c.style.transform = 'translate(0, 0)'; });
      void sec.offsetWidth; sec.classList.remove('snap');
      cloudT = setTimeout(parted, 400);
    } else { parted(); void sec.offsetWidth; sec.classList.remove('snap'); }
    renderWorld();
  }
  function renderWorld() {
    screens.querySelectorAll('[data-country]').forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-country') === st.worldSel); });
    $('dbdCrownCount').querySelector('span').textContent = (st.crown ? 1 : 0) + ' / 30';
    var fl = $('dbdFrLbl'); if (fl) fl.textContent = 'France · ' + (st.crown ? 1 : 0) + '/5';
    var c = COUNTRIES[st.worldSel], h = '';
    h += '<div style="display: flex; align-items: center; gap: 8px"><span style="font: 400 26px var(--ui-display); line-height: 1">' + esc(c.name) + '</span>' +
      '<span class="pill-dark" style="margin-left: auto; padding: 3px 10px; font-size: 12px; font-weight: 900">' + c.farms + '</span></div>';
    h += '<p style="margin: 0; font-weight: 800; font-size: 13px; line-height: 1.35; color: #5A3E2B">' + esc(c.blurb) + '</p>';
    if (c.open) {
      h += '<div style="display: flex; align-items: flex-end; gap: 10px"><img src="' + SPR.lavender + '" alt="Diva Lavande" style="height: 48px"><img src="' + SPR.echalote + '" alt="Monsieur Échalote" style="height: 46px">' +
        '<img src="' + SPR.artichaut + '" alt="Chevalier Artichaut" style="height: 46px"><button type="button" class="st-btn gold" data-go="france" style="margin-left: auto; height: 44px; padding: 0 16px; font-size: 20px">Enter</button></div>';
    } else {
      h += '<div style="display: flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; padding: 0 12px; border: 2.5px dashed #8A7A66; border-radius: 12px; font-weight: 900; font-size: 13px; color: #5A3E2B">' + LOCK + 'Not in this test yet</div>';
    }
    $('dbdCountryCard').innerHTML = h;
  }
  function renderFrance() {
    var won = st.crown ? 1 : 0;
    $('dbdFranceWon').textContent = won + ' of 5 farms won';
    screens.querySelectorAll('[data-city]').forEach(function (b) {
      var id = b.getAttribute('data-city');
      b.classList.toggle('sel', id === st.citySel);
      if (id === 'fr_avignon') { b.classList.toggle('won', !!st.crown); b.innerHTML = st.crown ? CROWN : '1'; }
    });
    var c = city(st.citySel), n = ORDER.indexOf(st.citySel) + 1, cur = st.citySel === 'fr_avignon', h = '';
    var stars = cur ? starsFor(st.best, c.record) : [false, false, false];
    h += '<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-weight: 900; font-size: 12px; letter-spacing: .8px; color: #5A3E2B">FARM ' + n + ' OF 5</span>' +
      '<span style="display: flex; gap: 3px">' + stars.map(star).join('') + '</span></div>';
    h += '<h3 style="margin: 0; font: 400 21px var(--ui-display); line-height: 1.05">' + esc(c.name) + '</h3>';
    if (cur) {
      h += '<img src="' + PREVIEW + '" alt="The Avignon farm: lavender, a windmill and Mont Ventoux" style="width: 100%; height: 64px; object-fit: cover; object-position: 50% 30%; border: 3px solid #2B1708; border-radius: 12px; box-sizing: border-box; flex: none">';
      var ev = st.nextEv;
      if (ev) {
        var d = touchy ? String(ev.desc).replace(/Hold click\/Space:?/i, 'Hold still:') : ev.desc;
        h += '<div style="display: flex; gap: 7px; align-items: flex-start"><span style="font-size: 16px; line-height: 1.1">' + (ICON[ev.id] || '📰') + '</span>' +
          '<p style="margin: 0; font-weight: 800; font-size: 12.5px; line-height: 1.3"><b style="font-weight: 900">' + esc(cap(ev.title)) + '.</b> ' + esc(d) + '</p></div>';
      }
    } else {
      var prev = city(ORDER[n - 2]);
      h += '<div style="height: 64px; flex: none; box-sizing: border-box; border: 2.5px dashed #8A7A66; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 900; font-size: 13px; color: #5A3E2B">' +
        LOCK + 'Win ' + esc(shortName(prev.name)) + ' to open</div>';
      h += '<p style="margin: 0; font-weight: 800; font-size: 11.5px; line-height: 1.3; color: #5A3E2B">' + esc(c.desc || '') + '</p>';
    }
    h += '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px">' +
      '<div class="statbox"><div class="k">CITY RECORD</div><div class="v">' + money(c.record) + '</div></div>' +
      '<div class="statbox"><div class="k">CITY CROWN</div><div class="v">' + (cur && st.crown ? 'Yours!' : 'Unclaimed') + '</div></div></div>';
    if (cur && st.best > 0) h += '<p style="margin: -2px 0 0; font-weight: 900; font-size: 12px; color: #5A3E2B">Your best day here: <span style="color: #2B1708">' + money(st.best) + '</span></p>';
    h += '<div style="display: flex; align-items: flex-end; gap: 6px; font-weight: 900; font-size: 11px; color: #5A3E2B"><img src="' + SPR.lavender + '" alt="Diva Lavande" style="height: 32px">' +
      '<img src="' + SPR.echalote + '" alt="Monsieur Échalote" style="height: 30px"><img src="' + SPR.artichaut + '" alt="Chevalier Artichaut" style="height: 30px">' +
      '<span style="margin-left: auto; text-align: right; line-height: 1.25">Rival<br><span style="color: #2B1708">' + esc(c.rival) + '</span></span></div>';
    if (cur) {
      h += '<button type="button" class="st-btn gold" data-play style="margin-top: auto; height: 44px; flex: none; font-size: 22px">Farm here</button>';
    } else {
      h += '<button type="button" disabled class="st-btn" style="margin-top: auto; height: 44px; flex: none; background: #E4DACA; color: #5A3E2B; font-size: 19px; box-shadow: none; cursor: default">Locked</button>';
    }
    $('dbdCityCard').innerHTML = h;
    screens.querySelectorAll('[data-setup]').forEach(function (b) { var on = +b.getAttribute('data-setup') === st.setup; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  function cap(t) { t = String(t).toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function shortName(n) { return String(n).replace(/\s*\(.*\)\s*$/, ''); }
  function renderSundown() {
    var s = st.stats || { earned: 0, count: 0, best: 0 }, h = T ? T.claudeHud() : null, c = city('fr_avignon');
    var bill = h && h.bill ? h.bill : { name: 'Seed loan', amt: 20 }, paid = h && h.cash >= bill.amt;
    var rec = c.record || 550, beat = s.earned >= rec;
    var html = '<div style="display: flex; align-items: baseline; justify-content: space-between"><h2 style="margin: 0; font: 400 34px var(--ui-display); line-height: 1">Sundown!</h2>' +
      '<span style="font-weight: 900; font-size: 12px; letter-spacing: .6px; color: #5A3E2B">AVIGNON · DAY ' + st.setup + '</span></div>';
    html += '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">' +
      '<div class="statbox" style="padding: 6px 8px"><div class="k">CROPS CUT</div><div class="v" style="font-size: 24px">' + s.count + '</div></div>' +
      '<div class="statbox" style="padding: 6px 8px"><div class="k">BEST CHAIN</div><div class="v" style="font-size: 24px">×' + s.best + '</div></div>' +
      '<div class="statbox" style="padding: 6px 8px"><div class="k">EARNED</div><div class="v" style="font-size: 24px; color: #2F7A3A">' + money(s.earned) + '</div></div></div>';
    var amtTxt = money(bill.amt) + '.00', dots = ' ' + new Array(Math.max(2, 31 - bill.name.length - amtTxt.length)).join('.') + ' ';
    html += '<div style="position: relative; border: 2.5px solid #2B1708; border-radius: 12px; padding: 8px 128px 8px 10px; background: #FFFDF4; font-family: \'Courier Prime\', monospace; font-weight: 700; font-size: 12.5px; line-height: 1.45">' +
      '<div>GRUMBLE &amp; SONS · NOTICE ' + ((h && h.billNo) || 1) + ' OF ' + ((h && h.billTotal) || 9) + '</div><div>' + esc(bill.name) + dots + amtTxt + '</div>' +
      (paid ? '<span class="stamp" style="position: absolute; right: 12px; top: 13px; transform: rotate(-10deg); border: 3px solid #2F7A3A; border-radius: 8px; padding: 1px 8px; color: #2F7A3A; font: 400 19px var(--ui-display); letter-spacing: 1px">COVERED</span>'
        : '<span class="stamp" style="position: absolute; right: 12px; top: 14px; transform: rotate(-10deg); border: 3px solid #C9473A; border-radius: 8px; padding: 1px 8px; color: #C9473A; font: 400 17px var(--ui-display); letter-spacing: 1px; white-space: nowrap">SHORT ' + money(bill.amt - (h ? h.cash : 0)) + '</span>') + '</div>';
    var pct = Math.round(s.earned / rec * 100);
    html += '<div style="display: flex; flex-direction: column; gap: 4px"><div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12px">' +
      '<span>' + (beat ? '👑 You beat ' + esc(c.rival) + '. Avignon is yours!' : 'Avignon record: ' + money(s.earned) + ' of ' + money(rec)) + '</span><span>' + pct + '%</span></div>' +
      '<div style="height: 10px; border: 2.5px solid #2B1708; border-radius: 999px; background: #FFFFFF; overflow: hidden"><div style="width: ' + clamp(pct, 0, 100) + '%; height: 100%; background: #FFC23D"></div></div></div>';
    html += '<div style="display: flex; gap: 10px"><button type="button" class="st-btn blue" data-go="france" style="flex: 1; height: 46px; font-size: 20px">Map</button>' +
      '<button type="button" class="st-btn gold" data-play style="flex: 1; height: 46px; font-size: 20px">Play again</button></div>';
    $('dbdSundownCard').innerHTML = html;
  }
  function openModal(kind) {
    var m = screens.querySelector('[data-modal]'), card = $('dbdModalCard'), h = '';
    if (kind === 'settings') {
      h += '<h2 style="margin: 0; font: 400 28px var(--ui-display); line-height: 1">Settings</h2>';
      h += '<label class="toggle-row"><input type="checkbox" data-opt="day11"' + (st.setup === 11 ? ' checked' : '') + '> Start farms on Day 11 (upgraded test)</label>';
      h += '<label class="toggle-row"><input type="checkbox" data-opt="sound"' + (soundOn() ? ' checked' : '') + '> Sound</label>';
    } else {
      var c = city('fr_avignon');
      h += '<h2 style="margin: 0; display: flex; align-items: center; gap: 8px; font: 400 28px var(--ui-display); line-height: 1">' + CROWN + 'City crowns</h2>';
      h += '<p style="margin: 0; font-weight: 800; font-size: 13px; line-height: 1.35; color: #5A3E2B">Beat a city’s best day to take its crown from the rival who holds it.</p>';
      h += '<div class="statbox" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px"><div style="flex: 1"><div class="k">AVIGNON · ' + esc(c.rival).toUpperCase() + '</div>' +
        '<div class="v">' + money(c.record) + (st.best ? ' <span style="font: 800 12px var(--ui-body); color: #5A3E2B">your best ' + money(st.best) + '</span>' : '') + '</div></div>' +
        '<div style="font: 400 18px var(--ui-display)">' + (st.crown ? '👑 Yours' : 'Unclaimed') + '</div></div>';
      h += '<p style="margin: 0; font-weight: 800; font-size: 12px; color: #5A3E2B">The other 29 crowns arrive with their farms.</p>';
    }
    h += '<button type="button" class="st-btn gold" data-close style="height: 44px; font-size: 20px">Done</button>';
    card.innerHTML = h; m.hidden = false;
  }
  function closeModal() { var m = screens.querySelector('[data-modal]'); if (m) m.hidden = true; }

  // ---------------- sound ----------------
  function soundOn() { try { return !!T.getState().meta.sound; } catch (e) { return true; } }
  function toggleSound() { var b = $('btnSound'); if (b) b.click(); syncSound(); }
  function syncSound() {
    var on = soundOn();
    document.querySelectorAll('[data-sound], #dbdSound').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
      var w = b.querySelector('.w'), x = b.querySelector('.x'); if (w) w.style.display = on ? '' : 'none'; if (x) x.style.display = on ? 'none' : '';
    });
  }

  // ---------------- play ----------------
  function play() {
    if (!T) return;
    st.stats = null; st.playing = true;
    show('farm');
    if (!T.claudePlay(st.setup)) { st.playing = false; show('france'); }
  }

  // ---------------- clicks ----------------
  screens.addEventListener('click', function (e) {
    var t = e.target.closest('button, label, input'); if (!t) return;
    if (t.hasAttribute('data-go')) { show(t.getAttribute('data-go')); return; }
    if (t.hasAttribute('data-play')) { play(); return; }
    if (t.hasAttribute('data-open')) { openModal(t.getAttribute('data-open')); return; }
    if (t.hasAttribute('data-close')) { closeModal(); return; }
    if (t.hasAttribute('data-sound')) { toggleSound(); return; }
    if (t.hasAttribute('data-country')) { st.worldSel = t.getAttribute('data-country'); renderWorld(); return; }
    if (t.hasAttribute('data-city')) { st.citySel = t.getAttribute('data-city'); renderFrance(); return; }
    if (t.hasAttribute('data-setup')) { st.setup = +t.getAttribute('data-setup'); LS.set('dbd-oneday-setup', st.setup); prep(); renderFrance(); return; }
    if (t.getAttribute && t.getAttribute('data-opt') === 'day11') { st.setup = t.checked ? 11 : 1; LS.set('dbd-oneday-setup', st.setup); prep(); return; }
    if (t.getAttribute && t.getAttribute('data-opt') === 'sound') { toggleSound(); t.checked = soundOn(); return; }
  });

  // ---------------- farm HUD ----------------
  var hud = null, E = {}, shown = 0, lastCash = 0, lastTier = 0, lastT = 0, bannerT = 0;
  function mountHud() {
    var tpl = $('dbdHudTpl');
    $('stage').appendChild(tpl.content.cloneNode(true));
    hud = $('dbdHud');
    ['Bank', 'Cash', 'BillFill', 'BillName', 'BillAmt', 'Jar', 'JarGold', 'Badge', 'Chain', 'Mult', 'ChainLbl', 'ChainFill', 'Next', 'ChainTimer', 'Arc', 'Sun', 'Secs',
      'Rush', 'RushLbl', 'RushN', 'RushFill', 'Sound', 'Pause', 'Banner', 'BannerIc', 'BannerT', 'BannerD'].forEach(function (k) { E[k] = $('dbd' + k); });
    E.Pause.addEventListener('click', function () { var b = $('btnPause'); if (b) b.click(); });
    E.Sound.addEventListener('click', toggleSound);
    E.Badge.addEventListener('click', function () { showBanner(false); });
  }
  function fmtMult(m) { return '×' + String(Math.round(m * 100) / 100); }
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016; lastT = now;
    if (!T || !hud) return;
    var h = T.claudeHud();
    if (st.scr === 'farm' && st.playing && h.mode === 'idle' && st.stats) { st.playing = false; show('sundown'); }
    var on = st.scr === 'farm' && (h.mode === 'day' || h.mode === 'dusk');
    if (hud.hidden === on) hud.hidden = !on;
    if (!on) return;
    lastCash = h.cash;
    if (h.cash < shown) shown = h.cash;
    else shown += (h.cash - shown) * Math.min(1, dt * 0.9);
    if (Math.abs(h.cash - shown) < 0.5) shown = h.cash;
    E.Cash.textContent = money(shown);
    var amt = h.bill ? h.bill.amt : 1, prog = clamp(shown / amt, 0, 1), covered = shown >= amt;
    E.BillFill.style.width = (prog * 100).toFixed(1) + '%';
    E.JarGold.setAttribute('transform', 'translate(0 ' + (22 * (1 - prog)).toFixed(2) + ')');
    E.Bank.classList.toggle('covered', covered);
    E.BillName.textContent = h.bill ? (SHORT[h.bill.name] || h.bill.name) : '';
    E.BillAmt.textContent = covered ? '✓' : money(amt);
    var tiers = h.tiers, ti = 0;
    for (var i = 0; i < tiers.length; i++) if (h.combo >= tiers[i].count) ti = i;
    var last = tiers.length - 1, next = tiers[Math.min(ti + 1, last)];
    E.Chain.classList.toggle('on', h.combo > 0);
    E.Chain.classList.toggle('rush', h.rushT > 0);
    E.Mult.textContent = fmtMult(h.mult);
    E.ChainLbl.textContent = 'Chain ' + h.combo;
    var fill = ti === last ? 1 : clamp((h.combo - tiers[ti].count) / Math.max(1, next.count - tiers[ti].count), 0, 1);
    E.ChainFill.style.width = (fill * 100).toFixed(1) + '%';
    E.Next.textContent = h.rushT > 0 ? 'RUSH!' : ti === last ? 'max!' : '×' + next.mul + ' at ' + next.count;
    E.ChainTimer.style.width = (242 * clamp(h.comboT / Math.max(0.01, h.grace), 0, 1)).toFixed(1) + 'px';
    if (ti > lastTier) { E.Chain.classList.remove('bump'); void E.Chain.offsetWidth; E.Chain.classList.add('bump'); }
    lastTier = ti;
    var f = clamp(1 - h.time / Math.max(0.01, h.dayLen), 0, 1), ang = Math.PI + f * Math.PI, late = h.mode === 'day' && h.time < 5;
    E.Arc.setAttribute('stroke-dashoffset', (157.1 * (1 - f)).toFixed(2));
    E.Arc.setAttribute('stroke', late ? '#F26B3A' : '#FFC23D');
    E.Sun.setAttribute('cx', (80 + 50 * Math.cos(ang)).toFixed(2));
    E.Sun.setAttribute('cy', (58 + 50 * Math.sin(ang)).toFixed(2));
    E.Sun.setAttribute('fill', late ? '#FF9A3D' : '#FFD45C');
    E.Secs.textContent = Math.ceil(Math.max(0, h.time)) + 's';
    E.Secs.classList.toggle('late', late);
    var rushing = h.rushT > 0;
    E.Rush.classList.toggle('on', rushing);
    E.RushLbl.textContent = rushing ? 'RUSH!' : 'RUSH';
    E.RushN.textContent = rushing ? h.rushT.toFixed(1) + 's' : h.rushCharge + '/' + h.rushGoal;
    E.RushFill.style.width = ((rushing ? h.rushT / h.rushDur : h.rushCharge / h.rushGoal) * 100).toFixed(1) + '%';
  }
  window.__dbdCoin = function () {
    shown += Math.max(1, (lastCash - shown) * 0.35);
    if (shown > lastCash) shown = lastCash;
    if (E.Jar) { E.Jar.classList.remove('bump'); void E.Jar.getBoundingClientRect(); E.Jar.classList.add('bump'); }
  };
  function showBanner(first) {
    if (!st.ev || !E.Banner) return;
    clearTimeout(bannerT);
    var ev = st.ev, icon = ICON[ev.id] || '📰';
    E.BannerIc.textContent = icon; E.Badge.textContent = icon;
    E.BannerT.textContent = cap(ev.title);
    E.BannerD.textContent = touchy ? String(ev.desc).replace(/Hold click\/Space:?/i, 'Hold still:') : ev.desc;
    E.Banner.getAnimations().forEach(function (a) { a.cancel(); });
    E.Banner.hidden = false;
    E.Banner.animate([{ opacity: 0, transform: 'translateY(12px) scale(.92)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 220, easing: 'ease-out' });
    if (first) E.Badge.hidden = true;
    bannerT = setTimeout(shrink, first ? 2600 : 1800);
  }
  function shrink() {
    if (!E.Banner || E.Banner.hidden) return;
    E.Badge.hidden = false; E.Badge.style.visibility = 'hidden';
    var b = E.Badge.getBoundingClientRect(), r = E.Banner.getBoundingClientRect();
    var s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    var dx = ((b.left + b.width / 2) - (r.left + r.width / 2)) / s, dy = ((b.top + b.height / 2) - (r.top + r.height / 2)) / s;
    var k = Math.max(0.12, b.width / Math.max(1, r.width));
    var a = E.Banner.animate([{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }, { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + k + ')', opacity: 0.25 }],
      { duration: 460, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' });
    a.onfinish = function () { E.Banner.hidden = true; a.cancel(); E.Badge.style.visibility = ''; E.Badge.classList.remove('pop'); void E.Badge.offsetWidth; E.Badge.classList.add('pop'); };
  }
  window.__odCard = function () { return ''; };
  window.__odDayStart = function (e) {
    st.ev = e; st.stats = null; st.playing = true;
    if (hud) hud.hidden = false;
    try { var h = T.claudeHud(); shown = h.cash; lastCash = h.cash; } catch (err) {}
    lastTier = 0;
    setTimeout(function () { showBanner(true); }, 30);
  };
  window.__odDayEnded = function (t) {
    st.stats = t; clearTimeout(bannerT);
    if (E.Banner) E.Banner.hidden = true;
    var c = city('fr_avignon');
    if (t.earned > st.best) { st.best = Math.round(t.earned); LS.set('dbd-oneday-best', st.best); }
    if (t.earned >= (c.record || 550) && !st.crown) { st.crown = true; LS.set('dbd-oneday-crown', true); }
  };

  // ---------------- boot ----------------
  try { if (document.fonts && document.fonts.load) { document.fonts.load('400 24px "Lilita One"'); document.fonts.load('900 12px "Nunito"'); document.fonts.load('800 12px "Nunito"'); document.fonts.load('800 24px "Big Shoulders Stencil"'); document.fonts.load('700 12px "Courier Prime"'); } } catch (e) {}
  layout(); show('menu');
  requestAnimationFrame(frame);
  var boot = setInterval(function () {
    var t = window.__DBD_TEST; if (!t || !t.claudeHud) return;
    var s; try { s = t.getState(); } catch (e) { return; }
    if (!s || s.mode !== 'idle') return;
    clearInterval(boot);
    T = t;
    try { st.cities = T.claudeCities(); } catch (e) {}
    mountHud();
    prep();
    syncSound();
    if (st.scr === 'france') renderFrance();
  }, 60);
})();
