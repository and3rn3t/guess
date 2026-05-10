import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkMobileApiHealth,
  fetchHistoryGames,
  getMobileApiBaseUrlForDebug,
  getMobileSyncStatus,
  onMobileSyncStatusChange,
  startGame,
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

  it('uses EXPO_PUBLIC_API_BASE_URL when provided', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://example.com/';
    vi.stubGlobal('__DEV__', true);

    expect(getMobileApiBaseUrlForDebug()).toBe('https://example.com');
  });

  it('falls back to localhost in dev when API base is unset', () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    vi.stubGlobal('__DEV__', true);

    expect(getMobileApiBaseUrlForDebug()).toBe('http://127.0.0.1:8788');
  });

  it('reports reachable API when health check returns 200', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    const result = await checkMobileApiHealth();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.detail).toBe('reachable');
  });

  it('reports unreachable API when health check request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));

    const result = await checkMobileApiHealth();
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.detail).toBe('network_unreachable');
  });

  it('sends selected difficulty in startGame payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionId: 'sess-start-hard',
          question: {
            id: 'q-start',
            text: 'Is your character from a game?',
            attribute: 'fromGame'
          },
          reasoning: {
            why: 'Initial split favors medium entropy.',
            impact: 'high',
            remaining: 120,
            confidence: 71
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    await expect(
      startGame({
        difficulty: 'hard',
        categories: []
      })
    ).resolves.toMatchObject({ sessionId: 'sess-start-hard' });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toBeDefined();
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body)) as { difficulty?: string };
    expect(body.difficulty).toBe('hard');
  });

  it('forwards selected categories in startGame payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionId: 'sess-start-cats',
          question: {
            id: 'q-cats',
            text: 'Is your character from anime?',
            attribute: 'fromAnime'
          },
          reasoning: {
            why: 'Category narrowing improves first-turn precision.',
            impact: 'high',
            remaining: 88,
            confidence: 79
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    await expect(
      startGame({
        difficulty: 'medium',
        categories: ['anime', 'movies']
      })
    ).resolves.toMatchObject({ sessionId: 'sess-start-cats' });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as { categories?: string[] };
    expect(body.categories).toEqual(['anime', 'movies']);
  });
});
