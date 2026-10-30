// Rival farmers (v0.11): each city's best day belongs to a rival, and now the rival has a face (Navid, 30 Oct:
// "who is Captain Arsenault? how can I beat it?"). The face rides on the field's HUD at the record and gets knocked
// off when the player's day passes it. Faces are drawn from the name, so every rival keeps the same one.

const INK = '#2B1708';
const SKIN = ['#F2C29B', '#D9A066', '#B57A48', '#F5D0B5', '#8A5A35'];

const HATS: Array<(c: string) => string> = [
  // captain's cap
  () =>
    `<path d="M8 17 Q9 6 20 6 Q31 6 32 17 Z" fill="#2F4A7A" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 17 H34 Q34 20.5 30.5 20.5 H9.5 Q6 20.5 6 17 Z" fill="#1E3358" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="12" r="2.6" fill="#FFC23D" stroke="${INK}" stroke-width="1.4"/>`,
  // toque with a pompom
  c =>
    `<path d="M8 19 Q8 6 20 6 Q32 6 32 19 Z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><rect x="7" y="15.5" width="26" height="5" rx="2.5" fill="#FFF4DC" stroke="${INK}" stroke-width="2"/><circle cx="20" cy="5" r="3.2" fill="#FFF4DC" stroke="${INK}" stroke-width="2"/>`,
  // cowboy hat
  () =>
    `<path d="M3 18.5 Q20 23 37 18.5 Q35 15 30.5 16 L28.5 7.5 Q20 4.5 11.5 7.5 L9.5 16 Q5 15 3 18.5 Z" fill="#A86B3C" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M10.5 14.5 Q20 17 29.5 14.5" fill="none" stroke="${INK}" stroke-width="2"/>`,
  // beret
  c =>
    `<path d="M5 15.5 Q6 7.5 18 7.5 Q32 7.5 33 13.5 Q30 17 18 17 Q8 17 5 15.5 Z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M19 7.5 L20 4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  // straw hat
  () =>
    `<ellipse cx="20" cy="17" rx="17" ry="4.5" fill="#F2D27A" stroke="${INK}" stroke-width="2.2"/><path d="M11 16 Q12 6 20 6 Q28 6 29 16 Z" fill="#F2D27A" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M11.6 13 H28.4" stroke="#E5484D" stroke-width="2.6"/>`,
  // flat cap
  c =>
    `<path d="M8 18 Q8 8.5 20 8.5 Q30 8.5 33 14.5 L36.5 16.5 Q30 19 8 18 Z" fill="${c}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
];
const HAT_COLOURS = ['#E5484D', '#4E7D45', '#3A3F58', '#7A4FA0', '#2F7A9A'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A rival's face (the same one every time for the same name). Captains wear a captain's cap. */
export function rivalFace(name: string, size = 28): string {
  const h = hash(name);
  const hat = /captain/i.test(name) ? HATS[0] : HATS[1 + (h % (HATS.length - 1))];
  const skin = SKIN[(h >>> 4) % SKIN.length];
  const col = HAT_COLOURS[(h >>> 8) % HAT_COLOURS.length];
  const tache = (h >>> 12) % 3 !== 0;
  const mouth = tache
    ? `<path d="M13.5 29.2 Q17 26.6 20 28.6 Q23 26.6 26.5 29.2 Q23 31.2 20 30 Q17 31.2 13.5 29.2 Z" fill="#6B4A2E" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`
    : `<path d="M16 29.5 Q20.5 31.8 24.5 28.4" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="24.5" r="11.5" fill="${skin}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M13.6 20.4 L18 21.3 M22 21.3 L26.4 20.4" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="16" cy="24" r="1.8" fill="${INK}"/><circle cx="24" cy="24" r="1.8" fill="${INK}"/>
    ${mouth}${hat(col)}
  </svg>`;
}
