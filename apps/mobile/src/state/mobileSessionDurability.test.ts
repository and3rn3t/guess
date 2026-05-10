import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadActiveSessionId, saveActiveSessionId } from './mobileSessionDurability';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    })
  }
}));

describe('mobileSessionDurability', () => {
  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    storage.clear();
  });

  it('returns null when no session is stored', async () => {
    await expect(loadActiveSessionId()).resolves.toBeNull();
  });

  it('persists and restores a session ID', async () => {
    await saveActiveSessionId('sess-abc123');
    await expect(loadActiveSessionId()).resolves.toBe('sess-abc123');
  });

  it('clears the session when null is passed', async () => {
    await saveActiveSessionId('sess-to-clear');
    await saveActiveSessionId(null);
    await expect(loadActiveSessionId()).resolves.toBeNull();
  });

  it('returns null for an empty string value', async () => {
    storage.set('@guess/mobile/session/v1', '');
    await expect(loadActiveSessionId()).resolves.toBeNull();
  });

  it('returns null for a whitespace-only value', async () => {
    storage.set('@guess/mobile/session/v1', '   ');
    await expect(loadActiveSessionId()).resolves.toBeNull();
  });

  it('survives 50 sequential save/load cycles (suspend/resume simulation)', async () => {
    for (let i = 0; i < 50; i++) {
      const sessionId = `sess-cycle-${i}`;

      // Simulate suspend: save session before background
      await saveActiveSessionId(sessionId);

      // Simulate resume: load session on foreground
      const restored = await loadActiveSessionId();

      expect(restored).toBe(sessionId);
    }
  });

  it('overwrites a previous session without residue', async () => {
    await saveActiveSessionId('sess-old');
    await saveActiveSessionId('sess-new');
    await expect(loadActiveSessionId()).resolves.toBe('sess-new');
  });

  it('returns null when getItem throws', async () => {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage error'));

    await expect(loadActiveSessionId()).resolves.toBeNull();
  });
});
