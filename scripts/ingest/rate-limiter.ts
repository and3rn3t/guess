/**
 * Simple rate limiter for API calls.
 * Ensures minimum delay between requests to respect API rate limits.
 */
export class RateLimiter {
  private lastCall = 0;

  constructor(
    /** Minimum ms between requests */
    private readonly minInterval: number,
    /** Max requests per window (0 = unlimited within interval) */
    private readonly maxPerWindow: number = 0,
    /** Window size in ms */
    private readonly windowSize: number = 0
  ) {
    if (maxPerWindow > 0 && windowSize > 0) {
      this._windowCalls = [];
    }
  }

  private _windowCalls: number[] = [];

  async wait(): Promise<void> {
    const now = Date.now();

    // Simple interval-based throttle
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }

    // Window-based rate limiting
    if (this.maxPerWindow > 0 && this.windowSize > 0) {
      const windowStart = Date.now() - this.windowSize;
      this._windowCalls = this._windowCalls.filter(t => t > windowStart);

      if (this._windowCalls.length >= this.maxPerWindow) {
        const waitUntil = this._windowCalls[0] + this.windowSize;
        const waitMs = waitUntil - Date.now();
        if (waitMs > 0) {
          console.log(`  Rate limit: waiting ${(waitMs / 1000).toFixed(1)}s...`);
          await sleep(waitMs);
        }
      }

      this._windowCalls.push(Date.now());
    }

    this.lastCall = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Retry a function with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`  Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${lastError.message}`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
