import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({
  native: true,
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => bridge.native } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: bridge.get, set: bridge.set } }));

describe('native save bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    bridge.native = true;
    bridge.get.mockReset();
    bridge.set.mockReset();
    const cache = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
    });
  });

  it('restores an OS-cleared cache without overwriting a newer local save', async () => {
    localStorage.setItem('current', 'newer local save');
    bridge.get.mockImplementation(async ({ key }) => ({ value: key === 'missing' ? 'native backup' : 'older native save' }));
    const { bootstrapPreferences } = await import('./nativeStorage');
    await bootstrapPreferences(['current', 'missing']);
    expect(localStorage.getItem('current')).toBe('newer local save');
    expect(localStorage.getItem('missing')).toBe('native backup');
    expect(bridge.set).not.toHaveBeenCalled();
  });

  it('serializes overlapping writes so an old completion cannot overwrite a new save', async () => {
    let finishFirst!: () => void;
    let stored = '';
    bridge.set.mockImplementationOnce(async ({ value }) => {
      await new Promise<void>(resolve => { finishFirst = resolve; });
      stored = value;
    }).mockImplementation(async ({ value }) => { stored = value; });
    bridge.get.mockImplementation(async () => ({ value: stored }));
    const { persistPreference } = await import('./nativeStorage');
    const first = persistPreference('save', 'old');
    const second = persistPreference('save', 'new');
    await vi.waitFor(() => expect(bridge.set).toHaveBeenCalledTimes(1));
    finishFirst();
    await Promise.all([first, second]);
    expect(stored).toBe('new');
  });

  it('reports a failed native write and continues accepting later saves', async () => {
    bridge.set.mockRejectedValueOnce(new Error('storage full')).mockResolvedValue(undefined);
    bridge.get.mockResolvedValue({ value: 'retry' });
    const { persistPreference } = await import('./nativeStorage');
    await expect(persistPreference('save', 'failed')).rejects.toThrow('storage full');
    await expect(persistPreference('save', 'retry')).resolves.toBeUndefined();
  });

  it('never requires a native plugin while running in a browser', async () => {
    bridge.native = false;
    const { bootstrapPreferences, persistPreference } = await import('./nativeStorage');
    await bootstrapPreferences(['save']);
    await persistPreference('save', 'value');
    expect(bridge.get).not.toHaveBeenCalled();
    expect(bridge.set).not.toHaveBeenCalled();
  });

  it('retains the native warning until the primary save has been verified again', async () => {
    bridge.set.mockRejectedValueOnce(new Error('storage full')).mockResolvedValue(undefined);
    bridge.get.mockImplementation(async ({ key }) => ({ value: key === 'settings' ? 'settings' : 'retry' }));
    const { persistPreference, getNativeSaveStatus } = await import('./nativeStorage');
    await expect(persistPreference('dbd-farm-v3', 'failed')).rejects.toThrow();
    expect(getNativeSaveStatus()?.state).toBe('warning');
    await persistPreference('settings', 'settings');
    expect(getNativeSaveStatus()?.state).toBe('warning');
    await persistPreference('dbd-farm-v3', 'retry');
    expect(getNativeSaveStatus()?.state).toBe('saved');
  });
});
