import type { Category } from './types.js';

/** Normalize a character name into a URL-safe slug ID. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Create a unique ID from source + sourceId. */
export function makeId(source: string, sourceId: string): string {
  return `${source}-${sourceId}`;
}

/** Normalize popularity from a source-specific range to 0–1. */
export function normalizePopularity(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** Map a media type string to our category enum. */
export function mapCategory(type: string): Category {
  const t = type.toLowerCase();
  if (t.includes('anime') || t.includes('manga')) return 'anime';
  if (t.includes('game') || t.includes('video')) return 'video-games';
  if (t.includes('comic') || t.includes('manga')) return 'comics';
  if (t.includes('cartoon') || t.includes('animation')) return 'cartoons';
  if (t.includes('book') || t.includes('novel') || t.includes('literature')) return 'books';
  if (t.includes('tv') || t.includes('television') || t.includes('series')) return 'tv-shows';
  if (t.includes('movie') || t.includes('film') || t.includes('cinema')) return 'movies';
  return 'pop-culture';
}

/** Truncate description to reasonable length. */
export function truncateDesc(desc: string | null | undefined, maxLen = 500): string | null {
  if (!desc) return null;
  const clean = desc.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + '...';
}

/** Format elapsed time nicely. */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m${sec}s`;
}

/** Progress logger for long-running ingestion. */
export class ProgressLogger {
  private count = 0;
  private startTime = Date.now();

  constructor(
    private readonly label: string,
    private readonly logEvery = 100
  ) {
    console.log(`[${label}] Starting...`);
  }

  tick(extra?: string) {
    this.count++;
    if (this.count % this.logEvery === 0) {
      const elapsed = formatElapsed(Date.now() - this.startTime);
      const rate = (this.count / ((Date.now() - this.startTime) / 1000)).toFixed(1);
      console.log(`[${this.label}] ${this.count} processed (${rate}/s, ${elapsed})${extra ? ' — ' + extra : ''}`);
    }
  }

  done(): { count: number; elapsed: number } {
    const elapsed = Date.now() - this.startTime;
    console.log(`[${this.label}] Done: ${this.count} total in ${formatElapsed(elapsed)}`);
    return { count: this.count, elapsed };
  }
}
