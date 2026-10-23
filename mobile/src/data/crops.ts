import { CropDef } from '../types/game';

// ============================================================================
// Due by Dusk · v0.5.01 — Baseline & Researched Regional Crop Data
// Includes 8 upgraded baseline vegetables + 6 country-authentic regional crops
// ============================================================================

export const CROPS: Record<string, CropDef> = {
  // 8 Baseline Crops
  radish:   { name:'Runaway radish',    hp:3,  val:5,  r:16, top:38, color:'#e11d48', light:'#fda4af', shade:'#881337', flesh:'#fff1f2', leaf:'#4ade80', leafDark:'#15803d', juice:'#fb7185', origin:'All Regions' },
  carrot:   { name:'Carrot',            hp:1,  val:1,  r:19, top:42, color:'#f97316', light:'#fdba74', shade:'#9a3412', flesh:'#ffedd5', leaf:'#4ade80', leafDark:'#166534', juice:'#fb923c', origin:'All Regions' },
  golden:   { name:'Bearded sweet corn',hp:6,  val:18, r:22, top:46, color:'#facc15', light:'#fef08a', shade:'#a16207', flesh:'#fef9c3', leaf:'#22c55e', leafDark:'#15803d', juice:'#fde047', origin:'Americas & Hokkaido' },
  onion:    { name:'Drama-queen onion', hp:7,  val:7,  r:24, top:46, color:'#a855f7', light:'#e9d5ff', shade:'#581c87', flesh:'#faf5ff', leaf:'#4ade80', leafDark:'#15803d', juice:'#c084fc', origin:'Roscoff & Holland Marsh' },
  berry:    { name:'Briar-berry twins', hp:9,  val:13, r:25, top:46, color:'#4f46e5', light:'#c7d2fe', shade:'#312e81', flesh:'#eef2ff', leaf:'#22c55e', leafDark:'#166534', juice:'#818cf8', origin:'Okanagan & Loire' },
  cabbage:  { name:'Lord cabbage',      hp:4,  val:3,  r:28, top:44, color:'#4ade80', light:'#dcfce7', shade:'#14532d', flesh:'#f0fdf4', leaf:'#86efac', leafDark:'#166534', juice:'#86efac', origin:'Temperate Regions' },
  potato:   { name:'Couch potato',      hp:32, val:22, r:36, top:58, color:'#d99b52', light:'#fae1b8', shade:'#6e4219', flesh:'#fef3c7', leaf:'#84cc16', leafDark:'#3f6212', juice:'#fde047', origin:'Temperate Highlands' },
  pumpkin:  { name:'Grandma pumpkin',   hp:12, val:9,  r:44, top:64, color:'#ff7a00', light:'#ffbe4f', shade:'#c2410c', flesh:'#ffedd5', leaf:'#65a30d', leafDark:'#365314', juice:'#fb923c', origin:'North America & Hokkaido' },

  // 6 Country-Authentic Regional Crops (Researched per country/region)
  canola: {
    name: 'Prairie canola',
    hp: 5, val: 6, r: 22, top: 52,
    color: '#eab308', light: '#fef08a', shade: '#854d0e', flesh: '#fef9c3', leaf: '#16a34a', leafDark: '#14532d', juice: '#fde047',
    origin: 'Canada (Prairies & Ontario/Quebec)',
    unlockBill: 1
  },
  pei_russet: {
    name: 'PEI red-clay russet',
    hp: 16, val: 14, r: 30, top: 50,
    color: '#b45309', light: '#fcd34d', shade: '#78350f', flesh: '#fffbeb', leaf: '#65a30d', leafDark: '#365314', juice: '#f59e0b',
    origin: 'Canada (Prince Edward Island & Maritimes)',
    unlockBill: 2
  },
  abacaxi: {
    name: 'Pérola pineapple',
    hp: 14, val: 15, r: 29, top: 58,
    color: '#f59e0b', light: '#fde68a', shade: '#92400e', flesh: '#fef3c7', leaf: '#10b981', leafDark: '#047857', juice: '#fbbf24',
    origin: 'Brazil (Petrolina, São Paulo & Cerrado)',
    unlockBill: 1
  },
  mandioca: {
    name: 'Amazonian cassava',
    hp: 10, val: 11, r: 26, top: 50,
    color: '#92400e', light: '#d6b37c', shade: '#451a03', flesh: '#ffffff', leaf: '#22c55e', leafDark: '#14532d', juice: '#fef3c7',
    origin: 'Brazil (Belém Amazon & Mato Grosso)',
    unlockBill: 2
  },
  lavender: {
    name: 'Provence lavandin',
    hp: 6, val: 10, r: 23, top: 52,
    color: '#8b5cf6', light: '#ddd6fe', shade: '#4c1d95', flesh: '#f5f3ff', leaf: '#64748b', leafDark: '#334155', juice: '#a78bfa',
    origin: 'France (Provence, Burgundy & Loire) & Furano',
    unlockBill: 1
  },
  daikon: {
    name: 'Sumo white daikon',
    hp: 11, val: 12, r: 27, top: 56,
    color: '#f8fafc', light: '#ffffff', shade: '#64748b', flesh: '#ffffff', leaf: '#22c55e', leafDark: '#15803d', juice: '#e2e8f0',
    origin: 'Japan (Shizuoka, Kyoto, Aomori & Sakurajima)',
    unlockBill: 1
  }
};


export const GAZETTE_EVENTS = [
  { id:'market',  title:'COUNTY MARKET BOOM',   desc:'All crops sell for +25% today. Clear skies.',              weather:'clear', valMul:1.25 },
  { id:'gale',    title:'AUTUMN GALE WINDS',    desc:'Blowing leaves! Hold, then release: Charge Cleave 2× faster.',weather:'wind',  chargeFast:2.0 },
  { id:'rain',    title:'WARM HARVEST SHOWERS', desc:'Summer rain! Crops sprout 35% faster.',                    weather:'rain',  spawnFast:1.35 },
  { id:'frost',   title:'SNAP MORNING FROST',   desc:'Frosty morning! Cracking ice on crops pays +$2 bonus.',    weather:'frost', frost:true },
  { id:'fair',    title:'GRANDMA CROCHET FAIR', desc:'Pumpkins & Drama Onions pay +35% today!',                  weather:'clear', pumpkinBonus:1.35 },
  { id:'stampede',title:'PASTURE STAMPEDE',     desc:'Restless goat day! Clover Treats & Fertilizer spawn more.', weather:'wind',  propBoost:1.8 },
];

export const BILLS = [
  { name:'Seed loan',               amt:20,    days:3, note:'For the carrot seeds. We trust you. Mostly.' },
  { name:'New fence',               amt:60,    days:4, note:'Your goat ate the old one. The goat denies this.' },
  { name:'Tractor transmission',    amt:180,   days:4, note:'It only drives in reverse now. Charming, but no.' },
  { name:'Pond water rights',       amt:500,   days:4, note:'The ducks have retained counsel.' },
  { name:'Barn roof',               amt:1300,  days:4, note:'The pigeons have filed a formal complaint.' },
  { name:"Grandma's pie insurance", amt:3200,  days:5, note:'Required by the county fair. Do not ask why.' },
  { name:'Property tax',            amt:8500,  days:5, note:'The county noticed you are doing well.' },
  { name:"The scarecrow's lawyer",  amt:30000, days:6, note:'He is suing for back pay. He has a point.' },
  { name:'The deed',                amt:90000, days:7, note:'Pay this and the farm is yours. Forever. Probably.' },
];

export const SHED = [
  { id:'scythe', name:'Sharper scythe',  base:8,  g:1.86, max:12, show:(s:any) => `${s.dmg} damage` },
  { id:'swing',  name:'Wider swing',     base:12, g:1.88, max:8,  show:(s:any) => `size ${Math.round(s.R)}` },
  { id:'hands',  name:'Quicker hands',   base:14, g:1.88, max:8,  show:(s:any) => `${s.tick.toFixed(1)} swings/s` },
  { id:'days',   name:'Longer days',     base:18, g:1.90, max:8,  show:(s:any) => `${s.day.toFixed(1).replace(/\.0$/,'')} s of light` },
  { id:'soil',   name:'Richer soil',     base:16, g:1.86, max:8,  show:(s:any) => `${s.max} crops at once` },
  { id:'market', name:"Farmers' market", base:25, g:1.90, max:10, show:(s:any) => `prices ×${s.vm.toFixed(2)}` },
  { id:'clover', name:'Lucky clover',    base:30, g:1.95, max:6,  show:(s:any) => `${Math.round(s.cc*100)}% crit chance` },
];

export const ALMANAC = [0, 30, 120, 400, 1200, 3500];

export const HEIRS = [
  { id:'boots',     name:"Grandpa's boots",        base:4, g:2.1, max:8, line:() => '+1 s of daylight per level' },
  { id:'calloused', name:'Calloused hands',        base:5, g:2.1, max:8, line:() => '+1 damage per level' },
  { id:'hat',       name:'Big straw hat',          base:4, g:2.2, max:6, line:() => 'Swing 8% wider per level' },
  { id:'almanac',   name:"Farmer's almanac",       base:3, g:2.4, max:5, line:(l:number) => l >= 5 ? `Every farm starts with $${ALMANAC[5]}` : `Start each farm with $${ALMANAC[l+1]}` },
  { id:'horseshoe', name:'Lucky horseshoe',        base:6, g:2.2, max:5, line:() => '+3% crit and more golden corn' },
  { id:'rooster',   name:'Loud rooster',           base:5, g:2.2, max:6, line:() => '+0.5 swings per second' },
  { id:'cousin',    name:"Cousin Dale's discount", base:6, g:2.3, max:5, line:() => 'Shed prices 5% lower per level' },
];

export const PERKS = [
  { id:'spite',   name:'Spite-sharpened',  line:'+2 scythe damage.' },
  { id:'coffee',  name:'Second coffee',    line:'+0.85 swings per second.' },
  { id:'elbow',   name:'Elbow room',       line:'Your swing is 18% wider.' },
  { id:'saving',  name:'Daylight saving',  line:'+2 s of daylight.' },
  { id:'fever',   name:'Market fever',     line:'Crop prices +22% per stack.' },
  { id:'clover',  name:'Four-leaf clover', line:'+7 percentage points of crit chance.' },
  { id:'hungry',  name:'Hungry soil',      line:'3 more crops on the field.' },
  { id:'combo',   name:'Combo farmer',     line:'Keep your chain for 1.45 seconds instead of 0.9. One per farm.', once:true },
  { id:'heavy',   name:'Heavy swing',      line:'Crits hit 4.5× instead of 2.8×. One per farm.', once:true },
  { id:'whisper', name:'Radish whisperer', line:'Radishes run half as fast and sell for 50% more.', once:true, req:(f:any) => f.billsPaid >= 3 },
  { id:'treaty',  name:'Goat treaty',      line:'The goat stops headbutting you and tips you instead.', once:true, req:(f:any) => f.billsPaid >= 2 },
  { id:'gold',    name:'Gold fever',       line:'+3.5 percentage points of golden corn chance.', req:(f:any) => f.billsPaid >= 4 },
  { id:'storm',   name:'Storm scythe',     line:'Crits chain golden lightning to 2 nearby crops. One per farm.', once:true },
  { id:'cleaver', name:'Cleaver mastery',  line:'Hold click/Space: Charge Cleave charges 50% faster and hits wider.', once:true },
];

export const SHED_IDS = SHED.map(d => d.id);
export const HEIR_IDS = HEIRS.map(d => d.id);
