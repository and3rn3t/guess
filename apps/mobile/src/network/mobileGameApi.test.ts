import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHistoryGames,
  getMobileSyncStatus,
  onMobileSyncStatusChange,
  type MobileSyncStatus
} from './mobileGameApi';

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

describe('mobileGameApi GET resilience', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('__DEV__', false);
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    storage.clear();
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  it('retries a transient transport failure for GET requests', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            games: [
              {
                id: 'game-1',
                characterId: 'char-1',
                characterName: 'Ada Lovelace',
                won: true,
                difficulty: 'medium',
                questionsAsked: 12,
                poolSize: 128,
                timestamp: 1710000000000
              }
            ]
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        )
      );

    const request = fetchHistoryGames(1);
    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual([
      {
        id: 'game-1',
        characterId: 'char-1',
        characterName: 'Ada Lovelace',
        won: true,
        difficulty: 'medium',
        questionsAsked: 12,
        poolSize: 128,
        timestamp: 1710000000000
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('publishes pending and synced states around API requests', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchPromise);
    const observedStatuses: MobileSyncStatus[] = [];
    const unsubscribe = onMobileSyncStatusChange((status) => {
      observedStatuses.push(status);
    });

    const request = fetchHistoryGames(1);

    expect(getMobileSyncStatus()).toBe('pending');

    resolveFetch(
      new Response(
        JSON.stringify({ games: [] }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    await expect(request).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observedStatuses).toContain('pending');
    expect(observedStatuses[observedStatuses.length - 1]).toBe('synced');

    unsubscribe();
  });
});
