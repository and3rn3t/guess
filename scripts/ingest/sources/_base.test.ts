import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { RateLimiter, parseWithSchema, withRateLimit, withRetry } from './_base';

describe('_base.ts (DQ.v2.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRateLimit', () => {
    it('happy path: acquires slot, runs fn once, returns value', async () => {
      const limiter = new RateLimiter(0);
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withRateLimit(limiter, fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure then succeeds', async () => {
      const limiter = new RateLimiter(0);
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('429 transient'))
        .mockResolvedValueOnce('ok');
      const result = await withRateLimit(limiter, fn, { baseDelay: 1 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('shouldRetry=false short-circuits permanent errors', async () => {
      const limiter = new RateLimiter(0);
      const fn = vi.fn().mockRejectedValue(new Error('401 unauthorized'));
      await expect(
        withRateLimit(limiter, fn, { baseDelay: 1, shouldRetry: () => false })
      ).rejects.toThrow('401 unauthorized');
      // No retries when shouldRetry returns false.
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetry (re-exported)', () => {
    it('retries up to maxRetries then throws final error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('still bad'));
      await expect(withRetry(fn, 2, 1)).rejects.toThrow('still bad');
      // 1 initial attempt + 2 retries = 3 calls.
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('parseWithSchema', () => {
    const schema = z.object({ id: z.number(), name: z.string() });

    it('returns parsed data on valid input', () => {
      const out = parseWithSchema({ id: 1, name: 'a' }, schema, 'test');
      expect(out).toEqual({ id: 1, name: 'a' });
    });

    it('throws tagged error with field path on invalid input', () => {
      expect(() => parseWithSchema({ id: 'wrong', name: 1 }, schema, 'tmdb')).toThrow(
        /\[tmdb\] schema validation failed/
      );
    });

    it('includes the field path of the first failing key', () => {
      try {
        parseWithSchema({ id: 1 }, schema, 'comicvine');
        throw new Error('should have thrown');
      } catch (err) {
        expect((err as Error).message).toMatch(/name:/);
      }
    });
  });
});
