// ============================================================================
// Due by Dusk · v0.6.00 — Versioned Save & Migration System (`src/systems/SaveSystem.ts`)
//
// Features:
// 1. Versioned Save Schema (`schemaVersion: 2`, stored under `due-by-dusk-v2`).
// 2. Automatic Pre-Migration Backup: Before transforming any legacy `due-by-dusk-v1`
//    save or user-imported JSON payload, stores an untouched verbatim copy in
//    `due-by-dusk-v1-backup` (and downloadable backup slot).
// 3. Idempotent Migration (`migrateToV2`): Safe to run multiple times on the same
//    save without duplicating Diamonds, double-refunding Grit, or resetting progress.
// 4. Legacy Grit-Funded Skill Handling (`v0.4.01` `meta.skills`):
//    - Maps legacy Grit skill IDs (`reap_1..3`, `soil_1..3`, `gold_1..3`) to their
//      corresponding v0.6.00 spatial skill tree IDs (`reap_swift`, `reap_vortex`,
//      `reap_exec`, `soil_dew`, `soil_twin`, `soil_bounty`, `gold_lawyer`,
//      `gold_herd`, `gold_midas`, plus `core_awakening`).
//    - Refunds 100% of the Grit originally spent on those legacy skills
//      (`reap_1/soil_1/gold_1` = 3 Grit, `*_2` = 6 Grit, `*_3` = 12 Grit) back into
//      `meta.grit` so Grit is never lost when moving to the 1-Diamond skill tree!
// 5. Export Save / Import Save Route: Allows transferring saves across `file://`
//    and `http://localhost` origins via JSON file download/upload or clipboard paste.
// ============================================================================

import { FarmState, MetaState, MigrationReport, SavePayloadV2 } from '../types/game';
import { GEOGRAPHY } from '../data/geography';
import { SKILL_TREE_NODES } from '../data/skillTree';
import { ALMANAC, BILLS, HEIR_IDS, HEIRS, PERKS, SHED, SHED_IDS } from '../data/crops';

export const SAVE_KEY_V2 = 'due-by-dusk-v2';
export const SAVE_KEY_V1 = 'due-by-dusk-v1';
export const BACKUP_KEY_V1 = 'due-by-dusk-v1-backup';
export const BACKUP_KEYS_V2 = ['due-by-dusk-v2-backup-1', 'due-by-dusk-v2-backup-2'] as const;
export const RECOVERY_ORIGINAL_KEY = 'due-by-dusk-v2-recovery-original';
export const SAVE_STORAGE_KEYS = [SAVE_KEY_V2, SAVE_KEY_V1, BACKUP_KEY_V1, ...BACKUP_KEYS_V2, RECOVERY_ORIGINAL_KEY];

export interface SaveStatus {
  state: 'ready' | 'saved' | 'recovered' | 'warning';
  message: string;
  persistent: boolean;
  recoveredFrom?: string;
  savedAt?: string;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Legacy v0.4.01 Grit skill mapping & original Grit costs for full refund
const LEGACY_SKILL_MAP: Record<string, { newId: string; gritCost: number }> = {
  reap_1: { newId: 'reap_swift',  gritCost: 3 },
  reap_2: { newId: 'reap_vortex', gritCost: 6 },
  reap_3: { newId: 'reap_exec',   gritCost: 12 },
  soil_1: { newId: 'soil_dew',    gritCost: 3 },
  soil_2: { newId: 'soil_twin',   gritCost: 6 },
  soil_3: { newId: 'soil_bounty', gritCost: 12 },
  gold_1: { newId: 'gold_lawyer', gritCost: 3 },
  gold_2: { newId: 'gold_herd',   gritCost: 6 },
  gold_3: { newId: 'gold_midas',  gritCost: 12 },
};

// Legacy v0.4.01 4-biome index -> v0.6.00 Country & City mapping
const LEGACY_BIOME_MAP: Array<{ country: 'CA' | 'BR' | 'FR' | 'JP'; cityId: string }> = [
  { country: 'CA', cityId: 'ca_toronto' },
  { country: 'BR', cityId: 'br_petrolina' },
  { country: 'FR', cityId: 'fr_avignon' },
  { country: 'JP', cityId: 'jp_shizuoka' },
];

function num(v: unknown, def = 0): number {
  return typeof v === 'number' && isFinite(v) ? v : def;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function blankMap(ids: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  ids.forEach(k => (o[k] = 0));
  return o;
}

export function createDefaultMeta(): MetaState {
  return {
    grit: 0,
    diamonds: 2,
    learnedSkills: [],
    heir: blankMap(HEIR_IDS),
    lost: 0,
    owned: 0,
    best: 0,
    sound: true,
    country: 'CA',
    cityId: 'ca_toronto',
    cityRecords: {},
    cityOwned: {},
  };
}

export function createNewFarm(meta: MetaState): FarmState {
  return {
    no: meta.lost + meta.owned + 1,
    day: 1,
    cash: ALMANAC[meta.heir.almanac] || 0,
    shed: blankMap(SHED_IDS),
    perks: [],
    bill: 0,
    due: BILLS[0].days,
    paidTotal: 0,
    billsPaid: 0,
    lastEarn: 0,
    lastCount: 0,
    played: false,
    earned: 0,
    harvested: 0,
    pendingPerks: null,
    lastBest: 0,
    lastBonus: 0,
    bestChain: 0,
  };
}

export class SaveSystem {
  private static lastMigrationReport: MigrationReport | null = null;
  private static memoryStore: Record<string, string> = {};
  private static sessionOnlyKeys = new Set<string>();
  private static writesBlocked = false;
  private static status: SaveStatus = { state: 'ready', message: '', persistent: true };
  private static statusListeners = new Set<(status: SaveStatus) => void>();
  private static persistedListeners = new Set<(entry: { key: string; value: string }) => void>();

  /** A write is durable only after reading the exact bytes back from storage. */
  private static setItem(key: string, val: string): boolean {
    this.memoryStore[key] = val;
    try {
      localStorage.setItem(key, val);
      if (localStorage.getItem(key) !== val) throw new Error('Save verification failed');
      this.sessionOnlyKeys.delete(key);
      for (const listener of this.persistedListeners) {
        try { listener({ key, value: val }); } catch { /* A bridge must not interrupt saving. */ }
      }
      return true;
    } catch {
      this.sessionOnlyKeys.add(key);
      return false;
    }
  }

  private static getItem(key: string): string | null {
    if (this.sessionOnlyKeys.has(key)) return this.memoryStore[key] ?? null;
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch (_e) {}
    return this.memoryStore[key] ?? null;
  }

  public static getStatus(): SaveStatus { return { ...this.status }; }

  public static subscribeStatus(listener: (status: SaveStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }

  /** Native mirrors subscribe here; the game itself retains a synchronous save API. */
  public static subscribePersisted(listener: (entry: { key: string; value: string }) => void): () => void {
    this.persistedListeners.add(listener);
    return () => { this.persistedListeners.delete(listener); };
  }

  private static publishStatus(status: SaveStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      try { listener(this.getStatus()); } catch { /* UI observers must not interrupt saving. */ }
    }
  }

  private static parseSave(raw: string | null): SavePayloadV2 | null {
    if (!raw) return null;
    const previousReport = this.lastMigrationReport;
    try { return this.migrateToV2(JSON.parse(raw)); } catch { return null; }
    finally { this.lastMigrationReport = previousReport; }
  }

  /** Keep the first damaged primary verbatim, including invalid JSON. Never replace it. */
  private static preserveDamagedPrimary(raw: string): boolean {
    const original = this.getItem(RECOVERY_ORIGINAL_KEY);
    // A confirmed reset writes a healthy placeholder into all slots. The first
    // later corruption may replace that placeholder with actual recovery evidence.
    if (original !== null && !this.parseSave(original)) return !this.sessionOnlyKeys.has(RECOVERY_ORIGINAL_KEY)
      || this.setItem(RECOVERY_ORIGINAL_KEY, original);
    return this.setItem(RECOVERY_ORIGINAL_KEY, raw);
  }

  public static getLastMigrationReport(): MigrationReport | null {
    return this.lastMigrationReport;
  }

  /**
   * Preserves a verbatim backup of raw save JSON before any migration or import transformation.
   */
  public static writeBackup(rawJson: string): void {
    if (!this.setItem(BACKUP_KEY_V1, rawJson)) this.publishStatus({
      state: 'warning', persistent: false,
      message: 'A backup could not be saved on this device. Export your progress before closing the game.',
    });
  }

  public static getBackupJson(): string | null {
    try {
      return this.getItem(BACKUP_KEY_V1);
    } catch (_e) {
      return null;
    }
  }

  /** Explicit, confirmed player reset. Replace every recovery slot too, so an old
   * farm cannot reappear after a later corruption or native cache restoration. */
  public static resetToDefaults(sound = true): SavePayloadV2 {
    const meta = createDefaultMeta();
    meta.sound = sound;
    const payload: SavePayloadV2 = {
      schemaVersion: 2,
      migrationId: `reset_v2_${Date.now()}`,
      meta,
      farm: createNewFarm(meta),
    };
    const json = JSON.stringify(payload);
    this.lastMigrationReport = null;
    this.writesBlocked = false;
    let allVerified = true;
    let primaryVerified = false;
    for (const key of SAVE_STORAGE_KEYS) {
      const verified = this.setItem(key, json);
      if (key === SAVE_KEY_V2) primaryVerified = verified;
      allVerified = allVerified && verified;
    }
    this.publishStatus(allVerified
      ? { state: 'saved', persistent: true, message: '', savedAt: new Date().toISOString() }
      : { state: 'warning', persistent: primaryVerified,
          message: 'The reset could not replace every saved copy. Export the fresh farm and free device storage before closing.' });
    return payload;
  }

  /**
   * Idempotent migration from any v1 (v0.3 / v0.4.01 / v0.5.01) or v2 save object
   * into a validated SavePayloadV2 object.
   * Running migrateToV2(migrateToV2(raw)) produces the exact same state without
   * duplicating Diamonds or re-refunding Grit.
   */
  public static migrateToV2(raw: any): SavePayloadV2 | null {
    if (!isRecord(raw) || !isRecord(raw.meta) || !isRecord(raw.farm)
      || (raw.schemaVersion !== undefined && raw.schemaVersion !== 1 && raw.schemaVersion !== 2)
      || !['day', 'cash', 'no'].some(key => typeof raw.farm[key] === 'number')) {
      return null;
    }

    const alreadyV2 = raw.schemaVersion === 2 && typeof raw.migrationId === 'string';
    const rawMeta = raw.meta;
    const rawFarm = raw.farm;

    let grit = Math.max(0, Math.floor(num(rawMeta.grit, 0)));
    let gritRefunded = 0;
    const legacyConverted: string[] = [];
    const notes: string[] = [];

    // 1. Collect valid learned skills
    const skillSet = new Set<string>();
    if (Array.isArray(rawMeta.learnedSkills)) {
      for (const id of rawMeta.learnedSkills) {
        if (SKILL_TREE_NODES.some(n => n.id === id)) {
          skillSet.add(id);
        }
      }
    }

    // 2. If migrating from v1 with legacy Grit-funded `meta.skills`, convert skills AND refund Grit once!
    if (!alreadyV2 && Array.isArray(rawMeta.skills) && rawMeta.skills.length > 0) {
      skillSet.add('core_awakening');
      for (const oldId of new Set(rawMeta.skills)) {
        const mapped = typeof oldId === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_SKILL_MAP, oldId) ? LEGACY_SKILL_MAP[oldId] : undefined;
        if (mapped) {
          skillSet.add(mapped.newId);
          gritRefunded += mapped.gritCost;
          legacyConverted.push(`${oldId} -> ${mapped.newId} (+${mapped.gritCost} Grit refunded)`);
        }
      }
      if (gritRefunded > 0) {
        grit += gritRefunded;
        notes.push(`Refunded ${gritRefunded} Grit from ${legacyConverted.length} legacy v0.4 skill(s) and mapped them to the v0.6 skill tree.`);
      }
    }

    // 3. Determine Diamonds balance (idempotent: never re-adds milestone diamonds if already present)
    let diamonds = 2;
    let diamondsGranted = 0;
    if (typeof rawMeta.diamonds === 'number' && isFinite(rawMeta.diamonds)) {
      diamonds = Math.max(0, Math.floor(rawMeta.diamonds));
    } else {
      const billsPaid = clamp(Math.floor(num(rawFarm.billsPaid, 0)), 0, BILLS.length);
      const ownedCount = Math.max(0, Math.floor(num(rawMeta.owned, 0)));
      diamondsGranted = 2 + Math.floor(billsPaid / 2) + ownedCount * 2;
      diamonds = diamondsGranted;
      notes.push(`Initialized ${diamonds} Diamonds from progression (${billsPaid} bills paid, ${ownedCount} farms owned).`);
    }

    // 4. Preserve & migrate geographical Country, City, Records & Deeds
    let country: 'CA' | 'BR' | 'FR' | 'JP' = 'CA';
    if (typeof rawMeta.country === 'string' && Object.prototype.hasOwnProperty.call(GEOGRAPHY.countries, rawMeta.country)) {
      country = rawMeta.country as MetaState['country'];
    } else if (typeof rawMeta.biome === 'number' && Number.isFinite(rawMeta.biome)) {
      const bIdx = clamp(Math.floor(rawMeta.biome), 0, 3);
      country = LEGACY_BIOME_MAP[bIdx].country;
    }

    const countryObj = GEOGRAPHY.countries[country];
    let cityId = countryObj.cities[0].id;
    if (rawMeta.cityId && countryObj.cities.some((c: { id: string }) => c.id === rawMeta.cityId)) {
      cityId = rawMeta.cityId;
    }

    const cityRecords: Record<string, number> = {};
    const cityOwned: Record<string, boolean> = {};
    for (const nation of Object.values(GEOGRAPHY.countries) as Array<{ cities: Array<{ id: string }> }>) {
      for (const city of nation.cities) {
        const record = rawMeta.cityRecords?.[city.id];
        if (typeof record === 'number' && Number.isFinite(record) && record >= 0) cityRecords[city.id] = Math.floor(record);
        if (rawMeta.cityOwned?.[city.id] === true) cityOwned[city.id] = true;
      }
    }

    // Map v0.4.01 `ownedWorlds` and `bestDaily` arrays if present
    if (!alreadyV2) {
      if (Array.isArray(rawMeta.ownedWorlds)) {
        rawMeta.ownedWorlds.forEach((owned: boolean, idx: number) => {
          if (owned && LEGACY_BIOME_MAP[idx]) {
            cityOwned[LEGACY_BIOME_MAP[idx].cityId] = true;
          }
        });
      }
      if (Array.isArray(rawMeta.bestDaily)) {
        rawMeta.bestDaily.forEach((rec: number, idx: number) => {
          if (rec > 0 && LEGACY_BIOME_MAP[idx]) {
            const cid = LEGACY_BIOME_MAP[idx].cityId;
            cityRecords[cid] = Math.max(cityRecords[cid] || 0, Math.floor(num(rec, 0)));
          }
        });
      }
    }

    // 5. Sanitize Heirlooms
    const heir = blankMap(HEIR_IDS);
    HEIRS.forEach(h => {
      heir[h.id] = clamp(Math.floor(num(rawMeta.heir && rawMeta.heir[h.id], 0)), 0, h.max);
    });

    const meta: MetaState = {
      grit,
      diamonds,
      learnedSkills: Array.from(skillSet),
      heir,
      lost: Math.max(0, Math.floor(num(rawMeta.lost, 0))),
      owned: Math.max(0, Math.floor(num(rawMeta.owned, 0))),
      best: Math.max(0, Math.floor(num(rawMeta.best, 0))),
      sound: rawMeta.sound !== false,
      country,
      cityId,
      cityRecords,
      cityOwned,
    };

    // 6. Sanitize Farm state
    const shed = blankMap(SHED_IDS);
    SHED.forEach(s => {
      shed[s.id] = clamp(Math.floor(num(rawFarm.shed && rawFarm.shed[s.id], 0)), 0, s.max);
    });

    const pendingPerks = Array.isArray(rawFarm.pendingPerks)
      ? Array.from(new Set<string>(rawFarm.pendingPerks.filter((p: string) => PERKS.some(x => x.id === p))))
      : null;

    const farm: FarmState = {
      no: Math.max(1, Math.floor(num(rawFarm.no, 1))),
      day: Math.max(1, Math.floor(num(rawFarm.day, 1))),
      cash: Math.max(0, num(rawFarm.cash, 0)),
      shed,
      // Most perks stack once per bill; repeated IDs are earned progression.
      perks: Array.isArray(rawFarm.perks) ? rawFarm.perks.filter((p: string) => PERKS.some(x => x.id === p)) : [],
      bill: clamp(Math.floor(num(rawFarm.bill, 0)), 0, BILLS.length - 1),
      due: Math.max(0, Math.floor(num(rawFarm.due, BILLS[0].days))),
      paidTotal: Math.max(0, num(rawFarm.paidTotal, 0)),
      billsPaid: clamp(Math.floor(num(rawFarm.billsPaid, 0)), 0, BILLS.length),
      lastEarn: Math.max(0, num(rawFarm.lastEarn, 0)),
      lastCount: Math.max(0, Math.floor(num(rawFarm.lastCount, 0))),
      played: !!rawFarm.played,
      earned: Math.max(0, num(rawFarm.earned, 0)),
      harvested: Math.max(0, Math.floor(num(rawFarm.harvested, 0))),
      pendingPerks: pendingPerks && pendingPerks.length ? pendingPerks : null,
      lastBest: Math.max(0, Math.floor(num(rawFarm.lastBest, 0))),
      lastBonus: Math.max(0, num(rawFarm.lastBonus, 0)),
      bestChain: Math.max(0, Math.floor(num(rawFarm.bestChain, 0))),
    };

    const savedReport = raw.migrationReport;
    const report: MigrationReport = alreadyV2 && isRecord(savedReport)
      ? {
          fromVersion: savedReport.fromVersion === 1 ? 1 : 2,
          toVersion: 2,
          migratedAt: typeof savedReport.migratedAt === 'string' ? savedReport.migratedAt : new Date().toISOString(),
          gritRefundedFromLegacySkills: Math.max(0, num(savedReport.gritRefundedFromLegacySkills)),
          legacySkillsConverted: Array.isArray(savedReport.legacySkillsConverted) ? savedReport.legacySkillsConverted.filter((value: unknown) => typeof value === 'string') : [],
          diamondsGrantedFromMilestones: Math.max(0, num(savedReport.diamondsGrantedFromMilestones)),
          backupKey: BACKUP_KEY_V1,
          notes: Array.isArray(savedReport.notes) ? savedReport.notes.filter((value: unknown) => typeof value === 'string') : [],
        }
      : {
          fromVersion: alreadyV2 ? 2 : 1,
          toVersion: 2,
          migratedAt: new Date().toISOString(),
          gritRefundedFromLegacySkills: gritRefunded,
          legacySkillsConverted: legacyConverted,
          diamondsGrantedFromMilestones: diamondsGranted,
          backupKey: BACKUP_KEY_V1,
          notes: notes.length ? notes : ['Migrated save schema to v2 cleanly with all progress preserved.'],
        };

    this.lastMigrationReport = report;

    return {
      schemaVersion: 2,
      migrationId: alreadyV2 ? raw.migrationId : `mig_v2_${Date.now()}`,
      migrationReport: report,
      meta,
      farm,
    };
  }

  /**
   * Loads `due-by-dusk-v2` if available; otherwise backs up and migrates `due-by-dusk-v1`.
   */
  public static loadOrMigrate(): SavePayloadV2 {
    this.writesBlocked = false;
    const primaryRaw = this.getItem(SAVE_KEY_V2);
    const primary = this.parseSave(primaryRaw);
    if (primary) {
      this.lastMigrationReport = primary.migrationReport ?? null;
      return primary;
    }

    let preservationSucceeded = true;
    if (primaryRaw !== null) preservationSucceeded = this.preserveDamagedPrimary(primaryRaw);
    // Each candidate is parsed independently: one damaged slot cannot hide later backups.
    const candidates = [...BACKUP_KEYS_V2, SAVE_KEY_V1, BACKUP_KEY_V1];
    let foundDamagedData = primaryRaw !== null;
    for (const key of candidates) {
      const raw = this.getItem(key);
      if (raw === null) continue;
      const recovered = this.parseSave(raw);
      if (!recovered) { foundDamagedData = true; continue; }
      this.lastMigrationReport = recovered.migrationReport ?? null;
      this.writesBlocked = !preservationSucceeded;
      if (!foundDamagedData && key === SAVE_KEY_V1) {
        this.writeBackup(raw);
        this.save(recovered.meta, recovered.farm, recovered.migrationId, recovered.migrationReport);
      } else {
        this.publishStatus({
          state: preservationSucceeded ? 'recovered' : 'warning',
          persistent: preservationSucceeded,
          recoveredFrom: key,
          message: preservationSucceeded
            ? 'Progress was restored from a backup. Your original save has been kept. Export a copy for safekeeping.'
            : 'Progress was restored, but this device cannot preserve the damaged save. Export your progress before closing the game.',
        });
      }
      return recovered;
    }

    // Do not let an automatic save replace unrecoverable progress with a blank game.
    this.writesBlocked = foundDamagedData;
    if (foundDamagedData) this.publishStatus({
      state: 'warning', persistent: false,
      message: 'Saved progress could not be read. The original files are untouched. Import a backup to recover; new progress will stay in this session only.',
    });

    const meta = createDefaultMeta();
    const farm = createNewFarm(meta);
    return {
      schemaVersion: 2,
      migrationId: `fresh_v2_${Date.now()}`,
      meta,
      farm,
    };
  }

  /**
   * Saves both `due-by-dusk-v2` and a backward-compatible `due-by-dusk-v1` mirror.
   */
  public static save(
    meta: MetaState,
    farm: FarmState,
    migrationId = 'live_v2',
    migrationReport?: MigrationReport
  ): SavePayloadV2 {
    const payload: SavePayloadV2 = {
      schemaVersion: 2,
      migrationId,
      migrationReport: migrationReport || this.lastMigrationReport || undefined,
      meta,
      farm,
    };
    try {
      const json = JSON.stringify(payload);
      if (this.writesBlocked) {
        // Keep the playable session alive while retaining all recovery evidence on disk.
        this.memoryStore[SAVE_KEY_V2] = json;
        this.publishStatus({ state: 'warning', persistent: false,
          message: 'Automatic saving is paused to protect unreadable progress. Export this session or import a backup before closing.' });
        return payload;
      }
      const previous = this.getItem(SAVE_KEY_V2);
      let backupsVerified = true;
      if (previous && previous !== json && this.parseSave(previous)) {
        const older = this.getItem(BACKUP_KEYS_V2[0]);
        if (older && this.parseSave(older)) backupsVerified = this.setItem(BACKUP_KEYS_V2[1], older);
        if (backupsVerified) backupsVerified = this.setItem(BACKUP_KEYS_V2[0], previous);
      }
      // Preserve the last working primary if its backup cannot be verified.
      const primaryVerified = backupsVerified && this.setItem(SAVE_KEY_V2, json);
      const mirrorVerified = primaryVerified && this.setItem(SAVE_KEY_V1, json);
      if (!primaryVerified) {
        this.memoryStore[SAVE_KEY_V2] = json;
        this.sessionOnlyKeys.add(SAVE_KEY_V2);
      }
      this.publishStatus(primaryVerified && mirrorVerified
        ? { state: 'saved', persistent: true, message: '', savedAt: new Date().toISOString() }
        : { state: 'warning', persistent: primaryVerified,
            message: primaryVerified
              ? 'Your main save is safe, but its extra copy could not be written. Export a backup before closing.'
              : 'Progress could not be saved on this device. Export your progress before closing the game.' });
    } catch {
      this.publishStatus({ state: 'warning', persistent: false,
        message: 'Progress could not be saved. Export your progress before closing the game.' });
    }
    return payload;
  }

  /**
   * Exports the current v2 save as a formatted JSON string for file download or clipboard transfer.
   */
  public static exportSaveJson(meta: MetaState, farm: FarmState): string {
    const payload: SavePayloadV2 = {
      schemaVersion: 2,
      migrationId: `export_v2_${Date.now()}`,
      migrationReport: this.lastMigrationReport || undefined,
      meta,
      farm,
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Imports a raw JSON string (from v0.3, v0.4.01, v0.5.01, or v0.6.00), backs up both
   * the current save and the raw imported string to `due-by-dusk-v1-backup`, and runs
   * idempotent migration to v2.
   */
  public static importSaveJson(rawJsonText: string, currentMeta?: MetaState, currentFarm?: FarmState): SavePayloadV2 {
    if (!rawJsonText || !rawJsonText.trim()) {
      throw new Error('Save JSON is empty.');
    }
    let parsed: any;
    try {
      parsed = JSON.parse(rawJsonText);
    } catch (_e) {
      throw new Error('Invalid JSON format. Please paste a valid Due by Dusk save file.');
    }

    const migrated = this.migrateToV2(parsed);
    if (!migrated) {
      throw new Error('Save JSON is missing valid `meta` or `farm` properties, or uses an unsupported save version.');
    }

    // Store pre-transform backup of the raw imported data (plus current state if present)
    const backupBundle = JSON.stringify({
      backedUpAt: new Date().toISOString(),
      previousActiveState: currentMeta && currentFarm ? { meta: currentMeta, farm: currentFarm } : null,
      rawImportedPayload: parsed,
      rawImportedJson: rawJsonText,
    });
    this.writeBackup(backupBundle);

    // An explicit valid import may replace an unreadable primary only once preserved.
    const primary = this.getItem(SAVE_KEY_V2);
    if (primary && !this.parseSave(primary) && !this.preserveDamagedPrimary(primary)) {
      throw new Error('The original save could not be preserved. Free device storage and try importing again.');
    }
    this.writesBlocked = false;
    this.save(migrated.meta, migrated.farm, migrated.migrationId, migrated.migrationReport);
    return migrated;
  }
}
