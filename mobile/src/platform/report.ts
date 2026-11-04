// Report a problem (v0.11.2, Navid 3 Nov): one strong shake (one, not two), or Settings → Report a problem. Since
// v0.11.3 nothing is typed inside the game (the keyboard covered half the landscape screen): the phone's email app
// opens with the game's version, the device, the screen, where the player was and the last errors it caught, and the
// player writes what happened there.

import { version } from '../../package.json';

/** Where reports go. Empty: the report is copied for the player to paste anywhere. */
export const REPORT_EMAIL = 'info@khoreh.com';

const errors: string[] = [];
/** The last few errors the game caught, for the report. */
export function watchErrors(): void {
  const keep = (msg: string) => {
    errors.push(new Date().toISOString().slice(11, 19) + ' ' + msg.slice(0, 200));
    if (errors.length > 5) errors.shift();
  };
  window.addEventListener('error', e => keep(String(e.message || e.error || 'error')));
  window.addEventListener('unhandledrejection', e => keep('promise: ' + String((e as PromiseRejectionEvent).reason)));
}

export interface ReportPlace {
  screen: string;
  farm?: string;
  day?: number;
  lang: string;
}

/** The text that goes into the report under the player's own words. */
export function reportDetails(place: ReportPlace): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  const lines = [
    `Game: Due by Dusk ${version}`,
    `Device: ${nav.userAgent}`,
    `Screen: ${screen.width}×${screen.height} (window ${innerWidth}×${innerHeight}, pixel ratio ${devicePixelRatio})`,
    `Where: ${place.screen}${place.farm ? `, ${place.farm}` : ''}${place.day ? `, day ${place.day}` : ''}`,
    `Language: ${place.lang}`,
    `Time: ${new Date().toISOString()}`,
  ];
  if (errors.length) lines.push('Recent errors:', ...errors.map(e => '  ' + e));
  return lines.join('\n');
}

/** Opens the report in the phone's email app (the clipboard when there is no address). `prompt` heads the email so
 *  the player writes there. Resolves how it went. */
export async function sendReport(prompt: string, details: string): Promise<'email' | 'copied' | 'failed'> {
  const body = `${prompt}\n\n\n\n----\n${details}`;
  if (REPORT_EMAIL) {
    const url = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`Due by Dusk ${version}: problem report`)}&body=${encodeURIComponent(body)}`;
    try {
      window.location.href = url;
      return 'email';
    } catch {
      /* fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(body);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** One strong shake calls `onShake` (a single jolt well above a normal swipe; then quiet for a few seconds). */
export function watchShake(onShake: () => void, enabled: () => boolean): void {
  let last = -Infinity;
  const THRESHOLD = 26; // m/s² of shake beyond gravity: a deliberate, forceful shake
  window.addEventListener('devicemotion', e => {
    if (!enabled()) return;
    const a = e.acceleration;
    let mag = 0;
    if (a && a.x != null && a.y != null && a.z != null) mag = Math.hypot(a.x, a.y, a.z);
    else {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;
      mag = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
    }
    const now = performance.now();
    if (mag < THRESHOLD || now - last < 4000) return;
    last = now;
    onShake();
  });
}
