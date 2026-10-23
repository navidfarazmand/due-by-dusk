import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class DeviceStorage {
  data = new Map<string, string>();
  failWrites = false;
  silentlyDropWrites = false;
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Storage full');
    if (!this.silentlyDropWrites) this.data.set(key, value);
  }
}

let device: DeviceStorage;
beforeEach(() => {
  vi.resetModules();
  device = new DeviceStorage();
  vi.stubGlobal('localStorage', device);
  vi.stubGlobal('window', {});
});
afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const api = await import('../src/systems/SaveSystem');
  const meta = api.createDefaultMeta();
  return { ...api, meta, farm: api.createNewFarm(meta) };
}

describe('durable progress and recovery', () => {
  it('rotates the two previous verified generations and restores the newest healthy one', async () => {
    const { SaveSystem, SAVE_KEY_V2, BACKUP_KEYS_V2, RECOVERY_ORIGINAL_KEY, meta, farm } = await setup();
    for (const cash of [10, 20, 30]) SaveSystem.save(meta, { ...farm, cash });
    expect(JSON.parse(device.getItem(BACKUP_KEYS_V2[0])!).farm.cash).toBe(20);
    expect(JSON.parse(device.getItem(BACKUP_KEYS_V2[1])!).farm.cash).toBe(10);
    device.setItem(SAVE_KEY_V2, '{broken primary');
    const recovered = SaveSystem.loadOrMigrate();
    expect(recovered.farm.cash).toBe(20);
    expect(SaveSystem.getStatus().state).toBe('recovered');
    expect(device.getItem(SAVE_KEY_V2)).toBe('{broken primary');
    expect(device.getItem(RECOVERY_ORIGINAL_KEY)).toBe('{broken primary');
    SaveSystem.save(recovered.meta, { ...recovered.farm, cash: 25 });
    expect(JSON.parse(device.getItem(SAVE_KEY_V2)!).farm.cash).toBe(25);
    expect(device.getItem(RECOVERY_ORIGINAL_KEY)).toBe('{broken primary');
  });

  it('continues past damaged backup slots to the compatible mirror', async () => {
    const { SaveSystem, SAVE_KEY_V2, BACKUP_KEYS_V2, meta, farm } = await setup();
    SaveSystem.save(meta, { ...farm, cash: 42 });
    device.setItem(SAVE_KEY_V2, 'invalid');
    device.setItem(BACKUP_KEYS_V2[0], '{"meta":{},"farm":{}}');
    device.setItem(BACKUP_KEYS_V2[1], 'also invalid');
    expect(SaveSystem.loadOrMigrate().farm.cash).toBe(42);
    expect(SaveSystem.getStatus().recoveredFrom).toBe('due-by-dusk-v1');
  });

  it('protects an unrecoverable primary from automatic fresh-game saves', async () => {
    const { SaveSystem, SAVE_KEY_V2 } = await setup();
    device.setItem(SAVE_KEY_V2, '{broken');
    const fresh = SaveSystem.loadOrMigrate();
    SaveSystem.save(fresh.meta, { ...fresh.farm, cash: 100 });
    expect(device.getItem(SAVE_KEY_V2)).toBe('{broken');
    expect(SaveSystem.getStatus()).toMatchObject({ state: 'warning', persistent: false });
  });

  it('reports quota failures and keeps session progress available for export', async () => {
    const { SaveSystem, SAVE_KEY_V2, meta, farm } = await setup();
    SaveSystem.save(meta, { ...farm, cash: 5 });
    device.failWrites = true;
    const observer = vi.fn();
    const unsubscribe = SaveSystem.subscribeStatus(observer);
    SaveSystem.save(meta, { ...farm, cash: 99 });
    expect(JSON.parse(device.getItem(SAVE_KEY_V2)!).farm.cash).toBe(5);
    expect(SaveSystem.getStatus()).toMatchObject({ state: 'warning', persistent: false });
    expect(observer).toHaveBeenCalled();
    expect(SaveSystem.loadOrMigrate().farm.cash).toBe(99);
    expect(JSON.parse(SaveSystem.exportSaveJson(meta, { ...farm, cash: 99 })).farm.cash).toBe(99);
    unsubscribe();
  });

  it('detects silently discarded writes and emits no successful persistence event', async () => {
    const { SaveSystem, meta, farm } = await setup();
    const persisted = vi.fn();
    SaveSystem.subscribePersisted(persisted);
    device.silentlyDropWrites = true;
    SaveSystem.save(meta, farm);
    expect(SaveSystem.getStatus().persistent).toBe(false);
    expect(persisted).not.toHaveBeenCalled();
  });

  it('permits explicit valid import after preserving unreadable progress', async () => {
    const { SaveSystem, SAVE_KEY_V2, RECOVERY_ORIGINAL_KEY, meta, farm } = await setup();
    device.setItem(SAVE_KEY_V2, 'broken');
    SaveSystem.loadOrMigrate();
    SaveSystem.importSaveJson(JSON.stringify({ meta, farm: { ...farm, cash: 67 } }));
    expect(JSON.parse(device.getItem(SAVE_KEY_V2)!).farm.cash).toBe(67);
    expect(device.getItem(RECOVERY_ORIGINAL_KEY)).toBe('broken');
  });

  it('leaves damaged primary untouched when recovery preservation cannot be verified', async () => {
    const { SaveSystem, SAVE_KEY_V2, meta, farm } = await setup();
    SaveSystem.save(meta, { ...farm, cash: 33 });
    device.setItem(SAVE_KEY_V2, 'damaged progress');
    device.failWrites = true;
    const recovered = SaveSystem.loadOrMigrate();
    expect(recovered.farm.cash).toBe(33);
    SaveSystem.save(recovered.meta, { ...recovered.farm, cash: 44 });
    expect(device.getItem(SAVE_KEY_V2)).toBe('damaged progress');
    expect(SaveSystem.getStatus().persistent).toBe(false);
    expect(() => SaveSystem.importSaveJson(JSON.stringify({ meta, farm }))).toThrow('could not be preserved');
  });

  it('isolates failing observers so native/UI errors cannot stop saving', async () => {
    const { SaveSystem, SAVE_KEY_V2, meta, farm } = await setup();
    SaveSystem.subscribePersisted(() => { throw new Error('Bridge problem'); });
    SaveSystem.subscribeStatus(() => { throw new Error('UI problem'); });
    expect(() => SaveSystem.save(meta, farm)).not.toThrow();
    expect(device.getItem(SAVE_KEY_V2)).not.toBeNull();
    expect(SaveSystem.getStatus().state).toBe('saved');
  });

  it('explicitly resets even blocked progress and replaces every recovery slot and native mirror event', async () => {
    const { SaveSystem, SAVE_KEY_V2, SAVE_STORAGE_KEYS } = await setup();
    for (const key of SAVE_STORAGE_KEYS) device.setItem(key, 'unreadable old farm');
    SaveSystem.loadOrMigrate();
    const mirrored = vi.fn();
    SaveSystem.subscribePersisted(mirrored);
    const reset = SaveSystem.resetToDefaults(false);
    expect(reset.meta.sound).toBe(false);
    expect(reset.farm.day).toBe(1);
    expect(reset.farm.cash).toBe(0);
    for (const key of SAVE_STORAGE_KEYS) expect(device.getItem(key)).toBe(JSON.stringify(reset));
    expect(mirrored).toHaveBeenCalledTimes(SAVE_STORAGE_KEYS.length);
    expect(SaveSystem.getStatus()).toMatchObject({ state: 'saved', persistent: true });
    // Even a subsequent damaged primary can only recover the fresh reset farm.
    device.setItem(SAVE_KEY_V2, '{damaged again');
    expect(SaveSystem.loadOrMigrate().farm.cash).toBe(0);
  });

  it('warns honestly if an explicit reset cannot replace durable copies', async () => {
    const { SaveSystem, SAVE_KEY_V2 } = await setup();
    device.setItem(SAVE_KEY_V2, 'old farm');
    device.failWrites = true;
    SaveSystem.resetToDefaults();
    expect(device.getItem(SAVE_KEY_V2)).toBe('old farm');
    expect(SaveSystem.getStatus()).toMatchObject({ state: 'warning', persistent: false });
  });

  it('rejects an invalid import without replacing the previous import backup', async () => {
    const { SaveSystem, BACKUP_KEY_V1 } = await setup();
    device.setItem(BACKUP_KEY_V1, 'precious old backup');
    expect(() => SaveSystem.importSaveJson('{"meta":[],"farm":{}}')).toThrow();
    expect(device.getItem(BACKUP_KEY_V1)).toBe('precious old backup');
  });

  it('does not replace an imported migration report while rotating the previous farm', async () => {
    const { SaveSystem, meta, farm } = await setup();
    SaveSystem.save(meta, farm);
    const imported = SaveSystem.importSaveJson(JSON.stringify({ meta: { ...meta, skills: ['soil_1'] }, farm }));
    expect(imported.migrationReport!.gritRefundedFromLegacySkills).toBe(3);
    expect(SaveSystem.getLastMigrationReport()).toEqual(imported.migrationReport);
    SaveSystem.save(imported.meta, imported.farm);
    expect(SaveSystem.getLastMigrationReport()).toEqual(imported.migrationReport);
  });
});

describe('legacy migration and validation', () => {
  it('starts fresh and explicitly reset games with zero permanent skill points', async () => {
    const { SaveSystem, createDefaultMeta } = await setup();
    expect(createDefaultMeta().diamonds).toBe(0);
    expect(SaveSystem.loadOrMigrate().meta.diamonds).toBe(0);
    expect(SaveSystem.resetToDefaults().meta.diamonds).toBe(0);
  });

  it('preserves saved point balances and learned skills when adopting completion-only rewards', async () => {
    const { SaveSystem, meta, farm } = await setup();
    for (const diamonds of [0, 2, 11]) {
      const old = { schemaVersion: 2, migrationId: 'existing',
        meta: { ...meta, diamonds, owned: 1, learnedSkills: ['core_awakening', 'reap_root'] }, farm };
      const migrated = SaveSystem.migrateToV2(old)!;
      expect(migrated.meta.diamonds).toBe(diamonds);
      expect(migrated.meta.learnedSkills).toEqual(old.meta.learnedSkills);
      expect(SaveSystem.migrateToV2(migrated)).toEqual(migrated);
    }
  });

  it('initializes missing legacy points using owned farms without bill or record bonuses', async () => {
    const { SaveSystem, meta, farm } = await setup();
    const { diamonds: _previousBalance, ...legacyMeta } = meta;
    for (const owned of [0, 1, 4]) {
      const migrated = SaveSystem.migrateToV2({ meta: { ...legacyMeta, owned,
        cityRecords: { ca_toronto: 900 }, cityOwned: { ca_toronto: true } },
        farm: { ...farm, billsPaid: 8 } })!;
      expect(migrated.meta.diamonds).toBe(owned);
      expect(migrated.migrationReport!.diamondsGrantedFromMilestones).toBe(owned);
      expect(SaveSystem.migrateToV2(migrated)).toEqual(migrated);
    }
  });

  it('refunds each legacy skill once and stays idempotent across repeat migration', async () => {
    const { SaveSystem, SAVE_KEY_V1, BACKUP_KEY_V1, meta, farm } = await setup();
    const raw = JSON.stringify({ meta: { ...meta, grit: 4, skills: ['reap_1', 'reap_1', 'soil_2'] }, farm });
    device.setItem(SAVE_KEY_V1, raw);
    const migrated = SaveSystem.loadOrMigrate();
    expect(migrated.meta.grit).toBe(13);
    expect(migrated.meta.learnedSkills).toEqual(['core_awakening', 'reap_swift', 'soil_twin']);
    expect(SaveSystem.migrateToV2(migrated)).toEqual(migrated);
    expect(device.getItem(BACKUP_KEY_V1)).toBe(raw);
  });

  it('sanitizes geography records, inherited keys, and invalid counters', async () => {
    const { SaveSystem, meta, farm } = await setup();
    const state = SaveSystem.migrateToV2({
      meta: { ...meta, country: '__proto__', biome: NaN,
        cityRecords: { ca_toronto: -2, ca_gatineau: 12.9, fake_city: 900 },
        cityOwned: { ca_toronto: 'false', ca_gatineau: true, fake_city: true },
        skills: ['__proto__', 'constructor'] },
      farm: { ...farm, due: -4, cash: Infinity },
    })!;
    expect(state.meta.country).toBe('CA');
    expect(state.meta.cityRecords).toEqual({ ca_gatineau: 12 });
    expect(state.meta.cityOwned).toEqual({ ca_gatineau: true });
    expect(state.farm.due).toBe(0);
    expect(state.farm.cash).toBe(0);
  });

  it('rejects empty objects and future schemas instead of treating them as fresh progress', async () => {
    const { SaveSystem, meta, farm } = await setup();
    expect(SaveSystem.migrateToV2({ meta: {}, farm: {} })).toBeNull();
    expect(SaveSystem.migrateToV2({ schemaVersion: 3, meta, farm })).toBeNull();
  });

  it('normalizes malformed reports before the save-transfer UI uses their fields', async () => {
    const { SaveSystem, meta, farm } = await setup();
    const payload = SaveSystem.migrateToV2({ schemaVersion: 2, migrationId: 'old', meta, farm,
      migrationReport: { notes: 'not an array', fromVersion: '<img>', toVersion: '<script>', backupKey: '<img>' } })!;
    expect(payload.migrationReport).toMatchObject({ fromVersion: 2, toVersion: 2, notes: [], backupKey: 'due-by-dusk-v1-backup' });
  });
});
