// Renderer-independent game rules. Keep legacy balance stable during the mobile migration.
export function calculateStats(shed: Record<string, number>, heir: Record<string, number>, perks: string[], skills: string[], ownedCities: number) {
  const H = heir, P = perks;
  const count = (values: string[], id: string) => values.filter(value => value === id).length;
  const hasSkill = (id: string) => skills.includes(id);
  const ownedBonus = 1 + 0.04 * ownedCities;
  const baseDmg = (1 + shed.scythe + H.calloused + 2 * count(P, 'spite') + (hasSkill('reap_root') ? 2 : 0)) * (hasSkill('core_awakening') ? 1.10 : 1.0);
  const tickRate = (3.2 + 0.55 * shed.hands + 0.45 * H.rooster + 0.85 * count(P, 'coffee')) * (hasSkill('reap_swift') ? 1.18 : 1.0);
  const swingRad = 42 * (1 + 0.13 * shed.swing) * (1 + 0.08 * H.hat) * (1 + 0.18 * count(P, 'elbow')) * (hasSkill('reap_dash') ? 1.12 : 1.0);
  const daySecs = 14 + 1.5 * shed.days + H.boots + 2 * count(P, 'saving') + (hasSkill('core_awakening') ? 1.0 : 0) + (hasSkill('soil_sun') ? 2.0 : 0);
  const maxCrops = 7 + 2 * shed.soil + 3 * count(P, 'hungry') + (hasSkill('soil_root') ? 2 : 0);
  const spawnRate = (0.82 / (1 + 0.24 * shed.soil + 0.08 * count(P, 'hungry'))) / (hasSkill('soil_root') ? 1.12 : 1.0);
  const valMul = (1 + 0.16 * shed.market) * (1 + 0.22 * count(P, 'fever')) * (hasSkill('gold_root') ? 1.15 : 1.0) * ownedBonus;
  return {
    dmg: Math.round(baseDmg * 10) / 10,
    tick: tickRate,
    R: swingRad,
    day: daySecs,
    max: maxCrops,
    spawn: spawnRate,
    vm: valMul,
    cc: Math.min(0.65, 0.04 + 0.04 * shed.clover + 0.03 * H.horseshoe + 0.07 * count(P, 'clover')),
    cm: (count(P, 'heavy') ? 4.5 : 2.8),
    gold: 0.015 + 0.01 * shed.clover + 0.012 * H.horseshoe + 0.035 * count(P, 'gold'),
    comboCap: 2,
    chainGrace: count(P, 'combo') ? 1.45 : 0.90,
    radishSlow: count(P, 'whisper') ? 0.5 : 1,
    radishBonus: count(P, 'whisper') ? 1.5 : 1,
    treaty: count(P, 'treaty') > 0 || hasSkill('gold_treaty') || hasSkill('gold_herd'),
    storm: count(P, 'storm') > 0 || hasSkill('reap_exec'),
    cleaver: count(P, 'cleaver') > 0 || hasSkill('reap_cleave'),
  };
}
export function upgradeCost(def: {base:number; g:number; max:number}, level:number, discount=0): number | null {
  return level >= def.max ? null : Math.round(def.base * Math.pow(def.g, level) * (1 - Math.min(.95, Math.max(0, discount))));
}
export function cropHealthMultiplier(day:number, billsPaid:number):number { return (1 + .13 * (day - 1)) * Math.pow(1.24, billsPaid); }
export function calculateGrit(f: {paidTotal:number; billsPaid:number; played:boolean; day:number; cash:number}) {
  const a = Math.floor(2 * Math.sqrt(Math.max(0, f.paidTotal) / 25));
  const b = 3 * Math.max(0, f.billsPaid);
  const c = Math.max(f.played ? 1 : 0, f.day - 1);
  const d = Math.floor(Math.sqrt(Math.max(0, f.cash) / 50));
  return { a, b, c, d, total:a+b+c+d };
}
