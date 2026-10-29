// v3 screens and farm HUD markup (generated from Claude's v3 one-day test; art comes in as Vite asset URLs).
import menuUrl from '../art/menu_dusk.svg';
import worldUrl from '../art/world_map.webp';
import franceUrl from '../art/france_map.webp';
import cloudUrl from '../art/cloud.svg';
import previewUrl from '../art/avignon_preview.webp';
import spr_artichaut from '../art/sprites/artichaut_idle.webp';
import spr_carrot from '../art/sprites/carrot_idle.webp';
import spr_echalote from '../art/sprites/echalote_idle.webp';
import spr_golden from '../art/sprites/golden_idle.webp';
import spr_lavender from '../art/sprites/lavender_idle.webp';
import spr_pumpkin from '../art/sprites/pumpkin_idle.webp';

export const A = { MENU: menuUrl, WORLD: worldUrl, FRANCE: franceUrl, CLOUD: cloudUrl, PREVIEW: previewUrl };
export const S: Record<string, string> = { artichaut: spr_artichaut, carrot: spr_carrot, echalote: spr_echalote, golden: spr_golden, lavender: spr_lavender, pumpkin: spr_pumpkin };

export const HUD_HTML = `<div id="dbdHud" hidden>
  <div class="grp tl">
    <div class="st-chip hb-bank" id="dbdBank">
      <div class="hb-cash" id="dbdCash">$0</div>
      <div class="hb-bar"><i id="dbdBillFill"></i></div>
      <div class="hb-bill"><span id="dbdBillName">Seed loan</span> <b id="dbdBillAmt">$20</b></div>
      <svg class="hb-jar" id="dbdJar" viewBox="0 0 30 34" aria-hidden="true">
        <defs><clipPath id="dbdJarClip"><path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z"/></clipPath></defs>
        <rect x="8" y="3.5" width="14" height="5" rx="2" fill="#B9824B" stroke="#2B1708" stroke-width="2.2"/>
        <path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z" fill="#DDF2FA"/>
        <g clip-path="url(#dbdJarClip)"><g id="dbdJarGold" transform="translate(0 22)"><rect x="2" y="9" width="26" height="24" fill="#FFC23D"/>
          <circle cx="6.5" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="13" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="19.5" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="26" cy="9.5" r="3.4" fill="#E3961C"/></g></g>
        <path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z" fill="none" stroke="#2B1708" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M6.5 21 L6.5 13.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <button type="button" class="hb-badge" id="dbdBadge" hidden aria-label="Today's event">🐐</button>
    <div class="hb-chain" id="dbdChain">
      <span class="hb-mult" id="dbdMult">×1</span><span class="hb-clbl" id="dbdChainLbl">Chain 0</span>
      <span class="hb-cbar"><i id="dbdChainFill"></i></span><span class="hb-next" id="dbdNext">×1.25 at 8</span><i class="hb-ctimer" id="dbdChainTimer"></i>
    </div>
  </div>
  <div class="grp tc">
    <svg class="hb-dial" viewBox="0 0 160 70" aria-hidden="true">
      <path d="M40 60 A40 40 0 0 1 120 60 Z" fill="#FFF4DC" stroke="#2B1708" stroke-width="3" stroke-linejoin="round"/>
      <path d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#2B1708" stroke-width="13" stroke-linecap="round"/>
      <path d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#FFF4DC" stroke-width="7" stroke-linecap="round"/>
      <path id="dbdArc" d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#FFC23D" stroke-width="7" stroke-linecap="round" stroke-dasharray="157.1" stroke-dashoffset="157.1"/>
      <circle id="dbdSun" cx="30" cy="58" r="10" fill="#FFD45C" stroke="#2B1708" stroke-width="3"/>
    </svg>
    <div class="hb-secs" id="dbdSecs">18s</div>
  </div>
  <div class="grp tr">
    <div class="st-chip hb-rush" id="dbdRush"><span class="rl" id="dbdRushLbl">RUSH</span><span class="rn" id="dbdRushN">0/22</span><span class="rbar"><i id="dbdRushFill"></i></span></div>
    <button type="button" class="st-btn st-sq hb-sound" id="dbdSound" aria-label="Sound">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#2B1708"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M15.5 9.5l5 5M20.5 9.5l-5 5" style="display:none"/></svg>
    </button>
    <button type="button" class="st-btn st-sq hb-pause" id="dbdPause" aria-label="Pause">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="2.5" width="4.5" height="15" rx="1.6" fill="#2B1708"/><rect x="12" y="2.5" width="4.5" height="15" rx="1.6" fill="#2B1708"/></svg>
    </button>
  </div>
  <div class="hb-bwrap"><div class="hb-banner" id="dbdBanner" hidden><span class="bic" id="dbdBannerIc">🐐</span><span class="btx"><span class="bt" id="dbdBannerT">Pasture stampede</span><span class="bd" id="dbdBannerD"></span></span></div></div>
</div>`;

export const SCREENS_HTML = `<div id="dbdScreens">
  <!-- ===== main menu ===== -->
  <section class="scr scr-menu" data-scr="menu" hidden>
    <div class="bg cover">
      <img class="art" src="${A.MENU}" alt="">
      <img class="bob2" src="${S.lavender}" alt="Diva Lavande" style="position: absolute; left: 96px; top: 230px; height: 70px">
      <img class="bob" src="${S.echalote}" alt="Monsieur Échalote" style="position: absolute; left: 168px; top: 268px; height: 100px">
      <img class="bob2" src="${S.carrot}" alt="Carrot" style="position: absolute; left: 566px; top: 238px; height: 62px">
      <img class="bob" src="${S.artichaut}" alt="Chevalier Artichaut" style="position: absolute; left: 460px; top: 280px; height: 100px">
      <img class="bob2" src="${S.golden}" alt="Golden corn" style="position: absolute; left: 640px; top: 252px; height: 72px">
      <img class="bob" src="${S.pumpkin}" alt="Pumpkin" style="position: absolute; left: 706px; top: 220px; height: 104px">
    </div>
    <div class="grp tc" style="width: 600px; height: 380px">
      <div style="position: absolute; left: 0; right: 0; top: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px">
        <h1 class="ink-title" style="font-size: 66px; line-height: .9; letter-spacing: .5px; text-shadow: 0 6px 0 #2B1708">Due by Dusk</h1>
        <p class="pill-dark" style="margin: 0; padding: 5px 14px; font-size: 13px; letter-spacing: .4px">A little farm. A very big debt.</p>
      </div>
      <div style="position: absolute; left: 0; right: 0; top: 160px; display: flex; flex-direction: column; align-items: center; gap: 8px">
        <button type="button" class="st-btn gold" data-go="world" style="height: 62px; padding: 0 34px; border-radius: 20px; box-shadow: 0 5px 0 #2B1708; font-size: 32px">
          <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true"><path d="M4 3 L21 13 L4 23 Z" fill="#2B1708" stroke="#2B1708" stroke-width="3" stroke-linejoin="round"/></svg>Play</button>
        <button type="button" data-go="france" style="background: #FFF4DC; border: 2.5px solid #2B1708; border-radius: 999px; padding: 3px 12px; font: 800 13px var(--ui-body); color: #2B1708; cursor: pointer">Continue · Farm 1 · Avignon</button>
      </div>
    </div>
    <div class="grp bl" style="width: 110px; height: 64px">
      <div style="position: absolute; left: 0; bottom: 16px; display: flex; gap: 10px">
        <button type="button" class="st-btn st-sq" data-open="settings" aria-label="Settings"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/></svg></button>
        <button type="button" class="st-btn st-sq" data-sound aria-label="Sound"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M15.5 9.5l5 5M20.5 9.5l-5 5" style="display:none"/></svg></button>
      </div>
    </div>
    <div class="grp br" style="width: 190px; height: 64px">
      <button type="button" class="st-btn blue" data-open="crowns" style="position: absolute; right: 0; bottom: 16px; height: 44px; padding: 0 16px; font-size: 19px">
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true"><path d="M2 6 L7 11 L12 3 L17 11 L22 6 L20 17 L4 17 Z" fill="#FFC23D" stroke="#2B1708" stroke-width="2.4" stroke-linejoin="round"/></svg>City crowns</button>
    </div>
  </section>

  <!-- ===== world map ===== -->
  <section class="scr scr-world" data-scr="world" hidden>
    <div class="bg fit">
      <img class="art" id="dbdWorldArt" src="${A.WORLD}" alt="World map with the farm route">
      <button type="button" class="pin" data-country="CA" aria-label="Canada, not in this test yet" style="left: 184px; top: 58px"><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#FFFFFF" stroke="#2B1708" stroke-width="1.5"></rect><rect x="0.75" y="0.75" width="6.5" height="16.5" rx="2" fill="#E2473B"></rect><rect x="18.75" y="0.75" width="6.5" height="16.5" rx="2" fill="#E2473B"></rect><path d="M13 3.5 L14.4 6.4 L16.6 5.6 L15.8 8.8 L17.6 9.4 L13.6 12.4 L13.6 14.6 L12.4 14.6 L12.4 12.4 L8.4 9.4 L10.2 8.8 L9.4 5.6 L11.6 6.4 Z" fill="#E2473B"></path></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span><span class="lbl">Canada · 0/6</span></button>
      <button type="button" class="pin" data-country="US" aria-label="United States, not in this test yet" style="left: 156px; top: 104px"><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#FFFFFF" stroke="#2B1708" stroke-width="1.5"></rect><path d="M1 3.5H25M1 8.5H25M1 13.5H25" stroke="#E2473B" stroke-width="2.4"></path><rect x="0.75" y="0.75" width="11" height="9" rx="2" fill="#3D5BA9"></rect></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span><span class="lbl">USA · 0/3</span></button>
      <button type="button" class="pin" data-country="BR" aria-label="Brazil, not in this test yet" style="left: 256px; top: 234px"><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#3FA34D" stroke="#2B1708" stroke-width="1.5"></rect><path d="M13 3 L22 9 L13 15 L4 9 Z" fill="#FFD23D"></path><circle cx="13" cy="9" r="3.6" fill="#3D5BA9"></circle></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span><span class="lbl">Brazil · 0/5</span></button>
      <button type="button" class="pin open" data-country="FR" aria-label="France, 5 farms, open" style="left: 383px; top: 80px"><span class="flag"><svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#FFFFFF" stroke="#2B1708" stroke-width="1.5"></rect><rect x="1.5" y="1.5" width="7.5" height="15" fill="#3D5BA9"></rect><rect x="17" y="1.5" width="7.5" height="15" fill="#E2473B"></rect></svg></span><span class="lbl" id="dbdFrLbl">France · 0/5</span></button>
      <button type="button" class="pin" data-country="MA" aria-label="Morocco, not in this test yet" style="left: 362px; top: 124px"><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#D9443A" stroke="#2B1708" stroke-width="1.5"></rect><path d="M13 4.2 L14.9 10.2 L9.9 6.5 L16.1 6.5 L11.1 10.2 Z" fill="none" stroke="#2F8A4C" stroke-width="1.4" stroke-linejoin="round"></path></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span><span class="lbl">Morocco · 0/3</span></button>
      <button type="button" class="pin" data-country="CN" aria-label="China, not in this test yet" style="left: 530px; top: 120px"><span class="lbl">China · 0/3</span><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#D9443A" stroke="#2B1708" stroke-width="1.5"></rect><path d="M6.5 3.4 L7.6 6.6 L4.4 4.6 L8.6 4.6 L5.4 6.6 Z" fill="#FFD23D"></path><circle cx="11" cy="3.6" r="0.9" fill="#FFD23D"></circle><circle cx="12.4" cy="5.6" r="0.9" fill="#FFD23D"></circle><circle cx="12.4" cy="8" r="0.9" fill="#FFD23D"></circle><circle cx="11" cy="9.8" r="0.9" fill="#FFD23D"></circle></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span></button>
      <button type="button" class="pin" data-country="JP" aria-label="Japan, not in this test yet" style="left: 688px; top: 108px"><span class="flag"><svg style="opacity: .6" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="0.75" y="0.75" width="24.5" height="16.5" rx="3" fill="#FFFFFF" stroke="#2B1708" stroke-width="1.5"></rect><circle cx="13" cy="9" r="4.6" fill="#E2473B"></circle></svg><span class="lock"><svg width="11" height="12" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="#2B1708"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#2B1708" stroke-width="1.8"></path></svg></span></span><span class="lbl">Japan · 0/5</span></button>
      <img class="cloud" data-cloud="a" src="${A.CLOUD}" alt="" style="left: -60px; top: -40px; width: 560px">
      <img class="cloud" data-cloud="b" src="${A.CLOUD}" alt="" style="left: 380px; top: -60px; width: 580px">
      <img class="cloud" data-cloud="c" src="${A.CLOUD}" alt="" style="left: -120px; top: 160px; width: 600px">
      <img class="cloud" data-cloud="d" src="${A.CLOUD}" alt="" style="left: 360px; top: 150px; width: 620px">
    </div>
    <div class="grp tl" style="width: 330px; height: 64px">
      <button type="button" class="st-btn st-sq" data-go="menu" aria-label="Back to menu" style="position: absolute; left: 0; top: 14px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <h2 class="st-chip" style="margin: 0; position: absolute; left: 54px; top: 14px; height: 44px; box-sizing: border-box; display: flex; align-items: center; padding: 0 16px; font: 400 22px var(--ui-display)">World map</h2>
    </div>
    <div class="grp tr" style="width: 140px; height: 64px">
      <div class="st-chip" style="position: absolute; right: 0; top: 14px; height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 14px; font: 400 20px var(--ui-display)" id="dbdCrownCount">
        <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true"><path d="M2 6 L7 11 L12 3 L17 11 L22 6 L20 17 L4 17 Z" fill="#FFC23D" stroke="#2B1708" stroke-width="2.4" stroke-linejoin="round"/></svg><span>0 / 30</span></div>
    </div>
    <div class="grp br" style="width: 300px; height: 190px">
      <div class="st-chip" id="dbdCountryCard" style="position: absolute; right: 0; bottom: 14px; width: 300px; padding: 12px 14px 14px; border-radius: 18px; box-shadow: 0 5px 0 #2B1708; display: flex; flex-direction: column; gap: 8px"></div>
    </div>
  </section>

  <!-- ===== France ===== -->
  <section class="scr scr-france" data-scr="france" hidden>
    <div class="bg fit">
      <img class="art" src="${A.FRANCE}" alt="Map of France with five farms">
      <span class="pulse" aria-hidden="true" style="position: absolute; left: 351.7px; top: 305.2px; width: 48px; height: 48px; box-sizing: border-box; border: 4px solid #FFC23D; border-radius: 50%"></span>
      <button type="button" class="node cur" data-city="fr_avignon" aria-label="Farm 1, Avignon, you are here" style="left: 351.7px; top: 305.2px">1</button>
      <span class="pill-dark" aria-hidden="true" style="position: absolute; left: 333.7px; top: 279.2px; padding: 3px 10px; font-size: 12px; font-weight: 900; white-space: nowrap">You are here</span>
      <button type="button" class="node" data-city="fr_beaune" aria-label="Farm 2, Beaune, locked" style="left: 352.9px; top: 190.0px">2</button>
      <button type="button" class="node" data-city="fr_tours" aria-label="Farm 3, Tours, locked" style="left: 243.3px; top: 176.1px">3</button>
      <button type="button" class="node" data-city="fr_roscoff" aria-label="Farm 4, Roscoff, locked" style="left: 124.9px; top: 118.0px">4</button>
      <button type="button" class="node" data-city="fr_agen" aria-label="Farm 5, Agen, locked" style="left: 238.7px; top: 299.9px">5</button>
    </div>
    <div class="grp tl" style="width: 380px; height: 64px">
      <button type="button" class="st-btn st-sq" data-go="world" aria-label="Back to world map" style="position: absolute; left: 0; top: 14px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="st-chip" style="position: absolute; left: 54px; top: 14px; height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 10px; padding: 0 14px; white-space: nowrap">
        <h2 style="margin: 0; font: 400 22px var(--ui-display)">France</h2><span style="font-weight: 900; font-size: 12px; color: #5A3E2B" id="dbdFranceWon">0 of 5 farms won</span></div>
    </div>
    <div class="grp tr" style="width: 262px; height: 390px">
      <div class="st-chip" id="dbdCityCard" style="position: absolute; right: 0; top: 14px; width: 262px; height: 362px; padding: 11px 14px 13px; border-radius: 18px; box-shadow: 0 5px 0 #2B1708; display: flex; flex-direction: column; gap: 7px"></div>
    </div>
    <div class="grp tl" style="width: 330px; height: 112px">
      <div class="st-chip" style="position: absolute; left: 0; top: 66px; height: 44px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 11px">
        <span style="font-weight: 900; font-size: 11px; letter-spacing: .6px; color: #5A3E2B">TEST</span>
        <div class="seg" role="group" aria-label="Which day to test" style="width: 270px">
          <button type="button" data-setup="1">🌱 Day 1 · fresh</button><button type="button" data-setup="11">⚡ Day 11 · upgraded</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== sundown ===== -->
  <section class="scr scr-sundown" data-scr="sundown" hidden>
    <div class="grp mc" style="width: 430px; height: 350px">
      <div class="st-chip" id="dbdSundownCard" style="position: absolute; left: 0; top: 0; width: 430px; padding: 14px 18px 16px; border-radius: 20px; box-shadow: 0 6px 0 #2B1708; display: flex; flex-direction: column; gap: 10px"></div>
    </div>
  </section>

  <!-- ===== small cards: settings, crowns ===== -->
  <section class="scr scr-modal" data-modal hidden>
    <div class="grp mc" style="width: 360px; height: 300px">
      <div class="st-chip" id="dbdModalCard" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 360px; padding: 14px 18px 16px; border-radius: 20px; box-shadow: 0 6px 0 #2B1708; display: flex; flex-direction: column; gap: 10px"></div>
    </div>
  </section>
</div>`;
