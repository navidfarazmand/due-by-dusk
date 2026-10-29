// Every image the shell shows. Vite turns these imports into asset URLs.
import menuUrl from '../art/menu_dusk.svg';
import worldUrl from '../art/world_map.webp';
import cloudUrl from '../art/cloud.svg';
import avignonPreview from '../art/avignon_preview.webp';

const sprites = import.meta.glob('../art/sprites/*_idle.webp', { eager: true, import: 'default' }) as Record<string, string>;
const maps = import.meta.glob('../art/maps/*_map.webp', { eager: true, import: 'default' }) as Record<string, string>;
const nodes = import.meta.glob('../art/maps/*_nodes.json', { eager: true, import: 'default' }) as Record<
  string,
  Record<string, { x: number; y: number }>
>;
const bands = import.meta.glob('../art/bands/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const previews = import.meta.glob('../art/previews/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

function byName(rec: Record<string, string>, re: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(rec)) {
    const m = path.match(re);
    if (m) out[m[1]] = url;
  }
  return out;
}

export const ART = {
  menu: menuUrl,
  world: worldUrl,
  cloud: cloudUrl,
};

/** Crop id -> idle sprite URL. */
export const SPRITE = byName(sprites, /\/([a-z_]+)_idle\.webp$/);
/** Country code (lower case) -> map URL, and its city node positions in 844×390 space. */
export const MAP = byName(maps, /\/([a-z]{2})_map\.webp$/);
export const NODES: Record<string, Record<string, { x: number; y: number }>> = {};
for (const [path, json] of Object.entries(nodes)) {
  const m = path.match(/\/([a-z]{2})_nodes\.json$/);
  if (m) NODES[m[1]] = json;
}
/** Band key (a city id like fr_avignon, or a country code like ca) -> skyline band URL. */
export const BAND = byName(bands, /\/([a-z_]+)\.webp$/);
/** City id -> preview image (the farm with its band). */
export const PREVIEW: Record<string, string> = { fr_avignon: avignonPreview, ...byName(previews, /\/([a-z_]+)\.webp$/) };

export function spriteImg(type: string, h: number, alt = ''): string {
  const u = SPRITE[type];
  return u ? `<img src="${u}" alt="${alt}" style="height: ${h}px" draggable="false">` : '';
}

/** The band image for a city: its own, else its country's. */
export function bandFor(cityId: string, country: string): string | undefined {
  return BAND[cityId] || BAND[country.toLowerCase()];
}
