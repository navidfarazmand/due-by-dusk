import { afterEach, describe, expect, test } from 'vitest';
import { LANGS, deviceLang, lang, setLang, t, tn, tx, type Lang } from '../src/i18n/i18n';
import fr from '../src/i18n/fr';
import es from '../src/i18n/es';
import pt from '../src/i18n/pt';
import de from '../src/i18n/de';
import { BRANCHES, TREE } from '../src/game/tree';

/** What the tree's tricks draw on the field (addText in the engine), as the dictionaries key them. */
const FIELD_WORDS = [
  'MARKET DAY +30%', 'EARLY BIRD ×2', 'HARVEST MOON ×2', 'PIGEON POST', 'FIRST ×5', 'BULK ×3', 'BULK ×5', 'BATTED AWAY', 'SECOND WIND', 'STREAK ×5',
  'HOO!', 'WOOF!', 'CASHBACK +${n}', 'GOAT MILK +${n}', 'TIP +${n}', 'EGG +${n}', 'BOUNTY {n}',
];

const DICTS: Record<string, Record<string, string>> = { fr, es, pt, de };

afterEach(() => setLang('en'));

describe('languages', () => {
  test('English is the source: text comes back as written, with its {placeholders} filled', () => {
    setLang('en');
    expect(t('Start day {day}', { day: 3 })).toBe('Start day 3');
    expect(tn(1, '{n} day', '{n} days')).toBe('1 day');
    expect(tn(4, '{n} day', '{n} days')).toBe('4 days');
    expect(t('Something nobody translated')).toBe('Something nobody translated');
  });

  test('five languages, each named in itself', () => {
    expect(LANGS.map(l => l.id)).toEqual(['en', 'fr', 'es', 'pt', 'de']);
    expect(LANGS.find(l => l.id === 'de')!.name).toBe('Deutsch');
  });

  test('every translation keeps the same {placeholders} as its English text', () => {
    for (const [code, d] of Object.entries(DICTS)) {
      for (const [en, tr] of Object.entries(d)) {
        const a = (en.match(/\{\w+\}/g) || []).sort().join(',');
        const b = (tr.match(/\{\w+\}/g) || []).sort().join(',');
        expect(`${code}: ${b}`).toBe(`${code}: ${a}`);
      }
    }
  });

  test('a language with translations changes the text, and untranslated text stays English', () => {
    for (const code of ['fr', 'es', 'pt', 'de'] as Lang[]) {
      const d = DICTS[code];
      const key = Object.keys(d)[0];
      if (!key) continue;
      setLang(code);
      expect(lang()).toBe(code);
      expect(t(key)).toBe(d[key]);
      expect(t('Something nobody translated')).toBe('Something nobody translated');
    }
  });

  test('words drawn on the field: exact, in capitals, or with a number in them', () => {
    setLang('en');
    expect(tx('SHOO CROW! +$5')).toBe('SHOO CROW! +$5');
    for (const code of ['fr', 'es', 'pt', 'de'] as Lang[]) {
      const d = DICTS[code];
      setLang(code);
      if (d['SHOO CROW! +${n}']) expect(tx('SHOO CROW! +$12')).toBe(d['SHOO CROW! +${n}'].replace('{n}', '12'));
      if (d['KNOCKED OUT!']) expect(tx('KNOCKED OUT!')).toBe(d['KNOCKED OUT!']);
      // a boss name is drawn in capitals on the field
      if (d['King Russet']) expect(tx('KING RUSSET')).toBe(d['King Russet'].toUpperCase());
    }
  });

  test('the upgrade tree is translated: every node name and effect, the branches, and the words its tricks draw on the field', () => {
    // node texts reach t() as variables, so `npm run i18n:check` can't see them: this test does
    expect(TREE).toHaveLength(103);
    const texts = new Set<string>();
    for (const n of TREE) {
      texts.add(n.name);
      texts.add(n.effect);
    }
    for (const b of BRANCHES) texts.add(b.name);
    for (const w of FIELD_WORDS) texts.add(w);
    for (const [code, d] of Object.entries(DICTS)) {
      const missing = [...texts].filter(k => !d[k] || !d[k].trim());
      expect(`${code}: ${missing.join(' | ')}`).toBe(`${code}: `);
    }
    // a number in a field word is kept, and the money patterns are found
    for (const code of ['fr', 'es', 'pt', 'de'] as Lang[]) {
      setLang(code);
      const d = DICTS[code];
      expect(tx('TIP +$1,250')).toBe(d['TIP +${n}'].replace('{n}', '1,250'));
      expect(tx('CASHBACK +$17')).toBe(d['CASHBACK +${n}'].replace('{n}', '17'));
      expect(tx('GOAT MILK +$8')).toBe(d['GOAT MILK +${n}'].replace('{n}', '8'));
      expect(tx('EGG +$9')).toBe(d['EGG +${n}'].replace('{n}', '9'));
      expect(tx('BULK ×3')).toBe(d['BULK ×3']);
      expect(d['BULK ×5']).toContain('×5');
      expect(d['MARKET DAY +30%']).toContain('+30%');
      // a node's name and effect come back translated
      expect(t('Storm rod')).toBe(d['Storm rod']);
      expect(t('Crits throw lightning at a crop nearby.')).not.toBe('Crits throw lightning at a crop nearby.');
    }
  });

  test("the phone's language is used when it is one of ours", () => {
    const nav = globalThis.navigator as unknown as { languages?: string[] } | undefined;
    if (!nav) return;
    const orig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(nav), 'languages');
    try {
      Object.defineProperty(nav, 'languages', { value: ['pt-BR', 'en-US'], configurable: true });
      expect(deviceLang()).toBe('pt');
      Object.defineProperty(nav, 'languages', { value: ['ja-JP'], configurable: true });
      expect(deviceLang()).toBe('en');
    } finally {
      delete (nav as Record<string, unknown>).languages;
      if (orig) Object.defineProperty(Object.getPrototypeOf(nav), 'languages', orig);
    }
  });
});
