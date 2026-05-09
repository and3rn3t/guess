import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('mobile offline queue', () => {
  beforeEach(async () => {
    storage.clear();
    vi.stubGlobal('__DEV__', false);
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.com';

    const { replaceMobileQueuedActions } = await import('./mobileOfflineQueue');
    await replaceMobileQueuedActions([]);
  });

  it('queues a failed result submission and flushes it later', async () => {
    const mobileGameApi = await import('./mobileGameApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    await expect(mobileGameApi.submitResult('sess-1', true)).resolves.toBeUndefined();
    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(1);
    expect(mobileGameApi.getMobileSyncStatus()).toBe('offline');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));

    await expect(mobileGameApi.flushMobileQueuedActions()).resolves.toBe(1);
    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(0);
  });

  it('queues a failed feedback submission and keeps the payload intact', async () => {
    const mobileGameApi = await import('./mobileGameApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));

    await expect(mobileGameApi.submitFeedback('sess-2', 5, 'Great game')).resolves.toBeUndefined();
    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(1);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    await expect(mobileGameApi.flushMobileQueuedActions()).resolves.toBe(1);
    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(0);
  });

  it('flushes 50+ queued actions without data loss', async () => {
    const mobileGameApi = await import('./mobileGameApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    fetchMock.mockRejectedValue(new TypeError('offline'));

    const queuedSize = 55;
    for (let index = 0; index < queuedSize; index += 1) {
      await expect(mobileGameApi.submitResult(`sess-${index}`, index % 2 === 0)).resolves.toBeUndefined();
    }

    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(queuedSize);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    await expect(mobileGameApi.flushMobileQueuedActions()).resolves.toBe(queuedSize);
    await expect(mobileGameApi.getMobileQueuedActionCount()).resolves.toBe(0);
  });
});
