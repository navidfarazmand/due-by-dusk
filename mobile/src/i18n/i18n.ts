// Languages (v0.11; Navid, 30 Oct: "can you add multiple languages? so people from different countries can select
// their language" — French, Spanish, Portuguese and German). English is the source: each other language maps the
// English text to its translation, so anything not translated yet shows in English. `{name}` placeholders are
// filled by t(). The engine's floating words go through tx() (window.__DBD_T).

import fr from './fr';
import es from './es';
import pt from './pt';
import de from './de';

export type Lang = 'en' | 'fr' | 'es' | 'pt' | 'de';

export const LANGS: ReadonlyArray<{ id: Lang; name: string }> = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
  { id: 'de', name: 'Deutsch' },
];

const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { fr, es, pt, de };

let cur: Lang = 'en';
let dict: Record<string, string> = {};
/** Upper-case English → key, for the engine's shouted words (KNOCKED OUT!, KING RUSSET). */
let upper: Map<string, string> = new Map();

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'fr' || v === 'es' || v === 'pt' || v === 'de';
}

export function setLang(l: Lang): void {
  cur = l;
  dict = l === 'en' ? {} : DICTS[l];
  upper = new Map();
  for (const k of Object.keys(dict)) upper.set(k.toUpperCase(), k);
  try {
    document.documentElement.lang = l;
  } catch {
    /* no document (tests) */
  }
}

export function lang(): Lang {
  return cur;
}

function fill(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** The text in the player's language. */
export function t(s: string, vars?: Record<string, string | number>): string {
  return fill(dict[s] ?? s, vars);
}

/** Singular or plural: t1(n, '{n} day', '{n} days'). */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : many, { n, ...vars });
}

/** Words the engine draws on the field: exact text, the same text in capitals, or a pattern with a number in it. */
const PATTERNS: Array<[RegExp, string]> = [
  [/^SHOO CROW! \+\$([\d,.]+)$/, 'SHOO CROW! +${n}'],
  [/^CLOVER TREAT! \+\$([\d,.]+)$/, 'CLOVER TREAT! +${n}'],
  [/^Good goat \+\$([\d,.]+)$/, 'Good goat +${n}'],
  [/^CHAIN ×([\d.]+)$/, 'CHAIN ×{n}'],
  [/^BOUNTY (.+)$/, 'BOUNTY {n}'],
];

export function tx(s: string): string {
  if (cur === 'en' || !s) return s;
  if (dict[s] != null) return dict[s];
  const k = upper.get(s);
  if (k != null) return (dict[k] ?? k).toUpperCase();
  for (const [re, key] of PATTERNS) {
    const m = re.exec(s);
    if (m && dict[key] != null) return fill(dict[key], { n: m[1] });
  }
  return s;
}

/** The device's language, if it is one of ours (English otherwise). */
export function deviceLang(): Lang {
  try {
    for (const l of navigator.languages || [navigator.language]) {
      const two = String(l || '').slice(0, 2).toLowerCase();
      if (isLang(two)) return two;
    }
  } catch {
    /* no navigator */
  }
  return 'en';
}
