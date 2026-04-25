import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IngestConfig {
  tmdbApiKey: string;
  igdbClientId: string;
  igdbClientSecret: string;
  comicVineApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;
}

let _config: IngestConfig | null = null;

/**
 * Load API keys from .env.local in project root.
 * Format: KEY=value (one per line, no quotes needed).
 */
export function getConfig(): IngestConfig {
  if (_config) return _config;

  const envPath = join(__dirname, '..', '..', '.env.local');
  let envContent: string;
  try {
    envContent = readFileSync(envPath, 'utf-8');
  } catch {
    // Fall back to .dev.vars
    const devVarsPath = join(__dirname, '..', '..', '.dev.vars');
    envContent = readFileSync(devVarsPath, 'utf-8');
  }

  const env: Record<string, string> = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }

  _config = {
    tmdbApiKey: env.TMDB_API_KEY ?? '',
    igdbClientId: env.IGDB_CLIENT_ID ?? '',
    igdbClientSecret: env.IGDB_CLIENT_SECRET ?? '',
    comicVineApiKey: env.COMIC_VINE_API_KEY ?? '',
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    openrouterApiKey: env.OPENROUTER_API_KEY ?? '',
  };

  return _config;
}
