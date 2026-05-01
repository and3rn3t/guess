/**
 * DQ.28 — Per-attribute evidence helpers.
 *
 * Every write into `character_attributes.evidence` goes through one of the
 * builders below so the format stays consistent across the worker, the
 * enrichment script, and the seed generator. The string is intentionally
 * structured (colon-delimited tags) so admin tooling and future analytics
 * can group/filter by source without parsing prose.
 *
 * Shape: `<source>:<sub-tag>[:<extra>...]` — always non-empty.
 *
 *   admin:manual:<unix-ms>             — admin clicked an attribute pill
 *   admin:create:<unix-ms>             — admin POST /api/v2/characters
 *   community:vote:<unix-ms>           — applied majority community vote
 *   correction:<unix-ms>               — user-submitted correction
 *   csv-upload:<unix-ms>               — bulk CSV upload via admin
 *   reveal:<gameSessionId>             — game-end backfill from confident answers
 *   enrichment:<provider>:<model>:run=<iso8601> — LLM enrichment run
 *   seed:default                       — repo-bundled default character seed
 */

export const EVIDENCE_PREFIXES = [
  'admin',
  'community',
  'correction',
  'csv-upload',
  'reveal',
  'enrichment',
  'seed',
] as const;

export function evidenceAdminManual(now: number = Date.now()): string {
  return `admin:manual:${now}`;
}

export function evidenceAdminCreate(now: number = Date.now()): string {
  return `admin:create:${now}`;
}

export function evidenceCommunityVote(now: number = Date.now()): string {
  return `community:vote:${now}`;
}

export function evidenceCorrection(now: number = Date.now()): string {
  return `correction:${now}`;
}

export function evidenceCsvUpload(now: number = Date.now()): string {
  return `csv-upload:${now}`;
}

export function evidenceReveal(gameSessionId: string): string {
  // gameSessionId may be empty in dev fallback paths — guard so the value
  // is never the empty tail "reveal:".
  const id = gameSessionId && gameSessionId.length > 0 ? gameSessionId : `unknown-${Date.now()}`;
  return `reveal:${id}`;
}

export function evidenceEnrichment(provider: string, model: string, runIso: string = new Date().toISOString()): string {
  return `enrichment:${provider}:${model}:run=${runIso}`;
}

export function evidenceSeed(): string {
  return 'seed:default';
}

/** True if `s` is a non-empty, well-formed evidence tag. Used by tests. */
export function isValidEvidence(s: unknown): s is string {
  if (typeof s !== 'string' || s.length === 0) return false;
  const head = s.split(':', 1)[0];
  return (EVIDENCE_PREFIXES as readonly string[]).includes(head);
}
