/// <reference types="@cloudflare/workers-types" />

/**
 * RateLimiter Durable Object
 *
 * Provides atomic, consistent per-user rate limiting.
 * Unlike KV-based rate limiting (which has eventual consistency and TOCTOU races),
 * this DO uses the single-threaded JavaScript execution guarantee of Durable Objects
 * to atomically read, check, and increment the counter in one tick.
 *
 * One DO instance is created per (action, userId) key pair.
 * Requests: POST / with query param ?max=N
 */
export class RateLimiter {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const maxPerHour = parseInt(url.searchParams.get("max") ?? "60", 10);

    // Current hour bucket (UTC)
    const hour = Math.floor(Date.now() / 3_600_000);
    const key = `count:${hour}`;

    // Atomic read + increment inside the same microtask
    const current: number = (await this.state.storage.get<number>(key)) ?? 0;

    if (current >= maxPerHour) {
      return Response.json({ allowed: false, remaining: 0 });
    }

    await this.state.storage.put(key, current + 1);

    // Lazily clean up the bucket two hours prior to bound storage growth
    await this.state.storage.delete(`count:${hour - 2}`);

    return Response.json({ allowed: true, remaining: maxPerHour - current - 1 });
  }
}
