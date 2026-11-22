import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging';
import { track } from './analytics';

/**
 * Notifications (0.17; Navid, 21 Nov: "also can we add a push notificiation?").
 *
 * - Reminders the game sets on the phone itself: the next daily bonus is ready, the Pen is full. They are inexact
 *   (Android may deliver them a few minutes late) so the game never needs the "Alarms & reminders" permission.
 * - Messages from Firebase Cloud Messaging: Navid can send one from the Firebase console to every player (topic "all"),
 *   to one language (topics lang_en, lang_fr, lang_es, lang_pt, lang_de) or to a group Analytics finds.
 * - Android 13 and newer ask the player before any notification shows; the game asks only after a yes on its own card.
 * - In a browser nothing is sent; the reminders the game would set are kept in window.__DBD_REMINDERS for the tests
 *   (window.__DBD_FAKE_NOTIF stands in for the phone's yes).
 */

const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const IDS = { bonus: 101, pen: 102 } as const;
export type Reminder = keyof typeof IDS;
const ICON = 'ic_stat_dbd';
const COLOR = '#FFC23D';

function fake(): boolean {
  return !native && !!(window as unknown as { __DBD_FAKE_NOTIF?: boolean }).__DBD_FAKE_NOTIF;
}
function record(kind: Reminder, v: { at: number; title: string; body: string } | null): void {
  const w = window as unknown as { __DBD_REMINDERS?: Record<string, unknown> };
  (w.__DBD_REMINDERS ||= {})[kind] = v;
}

/** Whether the phone lets the game show notifications. */
export async function notifAllowed(): Promise<boolean> {
  if (fake()) return true;
  if (!native) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

/** Asks the phone (Android 13 and newer show their own prompt); with a yes, sets up the channels and the messages. */
export async function enableNotifications(o: { lang: string; channels: { reminders: string; news: string } }): Promise<boolean> {
  if (fake()) {
    track('notif_permission', { granted: true });
    return true;
  }
  if (!native) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    const ok = p.display === 'granted';
    track('notif_permission', { granted: ok });
    if (!ok) return false;
    await LocalNotifications.createChannel({ id: 'reminders', name: o.channels.reminders, importance: 3 }).catch(() => undefined);
    await FirebaseMessaging.createChannel({ id: 'news', name: o.channels.news, importance: Importance.Default }).catch(() => undefined);
    await registerPush(o.lang);
    return true;
  } catch {
    return false;
  }
}

let pushLang = '';
/** Registers this phone for Firebase messages: every player, and the player's language. */
export async function registerPush(lang: string): Promise<void> {
  if (!native) return;
  try {
    if (!(await notifAllowed())) return;
    await FirebaseMessaging.getToken();
    await FirebaseMessaging.subscribeToTopic({ topic: 'all' });
    if (pushLang && pushLang !== lang) await FirebaseMessaging.unsubscribeFromTopic({ topic: 'lang_' + pushLang }).catch(() => undefined);
    await FirebaseMessaging.subscribeToTopic({ topic: 'lang_' + lang });
    pushLang = lang;
  } catch {
    /* no Google Play services, or offline: messages are optional */
  }
}

/** Turns messages off (Settings): no more topics, no token. */
export async function disablePush(): Promise<void> {
  if (!native) return;
  try {
    await FirebaseMessaging.unsubscribeFromTopic({ topic: 'all' }).catch(() => undefined);
    if (pushLang) await FirebaseMessaging.unsubscribeFromTopic({ topic: 'lang_' + pushLang }).catch(() => undefined);
    await FirebaseMessaging.deleteToken();
  } catch {
    /* nothing to undo */
  }
}

/** Sets one of the game's reminders (a new one replaces the old one of the same kind). */
export async function remind(kind: Reminder, at: Date, title: string, body: string): Promise<void> {
  if (at.getTime() <= Date.now() + 60_000) return;
  if (fake()) {
    record(kind, { at: at.getTime(), title, body });
    return;
  }
  if (!native || !(await notifAllowed())) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: IDS[kind] }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: IDS[kind],
          title,
          body,
          schedule: { at, allowWhileIdle: true },
          isExactNotification: false,
          channelId: 'reminders',
          smallIcon: ICON,
          iconColor: COLOR,
          extra: { kind },
        },
      ],
    });
  } catch {
    /* a reminder is a nicety */
  }
}

/** Takes a reminder back (the bonus was claimed, the Pen was emptied). */
export async function unremind(kind: Reminder): Promise<void> {
  if (fake()) {
    record(kind, null);
    return;
  }
  if (!native) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: IDS[kind] }] });
  } catch {
    /* nothing to cancel */
  }
}

/** Calls back when the player opens the game from a notification: a reminder ("bonus", "pen") or a message ("push"). */
export function onNotificationOpen(fn: (kind: string, extra?: Record<string, unknown>) => void): void {
  if (!native) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', a => {
    const k = (a.notification.extra as { kind?: string } | undefined)?.kind || 'reminder';
    fn(k);
  }).catch(() => undefined);
  void FirebaseMessaging.addListener('notificationActionPerformed', a => {
    const data = (a.notification.data || {}) as Record<string, unknown>;
    fn('push', { id: a.notification.id, title: a.notification.title, ...data });
  }).catch(() => undefined);
}

/** The next good hour for a reminder at or after `t`: between 9:00 and 21:00 the phone's local time. */
export function niceHour(t: Date): Date {
  const d = new Date(t.getTime());
  if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
  else if (d.getHours() >= 21) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}
