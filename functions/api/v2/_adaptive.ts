// Adaptive runtime data loader — extracted from _game-engine.ts (RF.2).
// Loads per-turn adaptive maps from D1 in parallel; failures degrade gracefully.

import type { ScoringWeights } from "@guess/game-engine";
import { d1CacheGet, d1ConfigGet, d1ConfigGetJson } from "../_d1_cache";

/** Shape of the adaptive runtime data loaded from D1 each turn.
 *  All fields are optional — fetch failures are non-fatal. */
export interface AdaptiveData {
  maybeRateMap: Record<string, number> | undefined;
  netGainMap: Record<string, number> | undefined;
  confusionDiscriminators: Record<string, string[]> | undefined;
  disputeMap: Record<string, Record<string, number>> | undefined;
  attributeTrustMap: Record<string, number> | undefined;
  characterPopularityMap: Record<string, number> | undefined;
  questionEmpiricalGainMap: Record<string, number> | undefined;
  /** C.6: per-attribute multiplier in (0, 1] applied to selector infoGain to
   *  down-weight questions trending toward AN.17 retirement. */
  questionQualityPenaltyMap: Record<string, number> | undefined;
  confusionPairs: Set<string> | undefined;
  /** Promoted ScoringWeights override (kv:engine:weights-active). Honoured
   *  only when auto-tune is enabled and the blob shape is valid. */
  activeWeights: ScoringWeights | undefined;
}

type DisputeRow = {
  character_id: string;
  attribute_key: string;
  confidence: number;
};
type ConfusionPairRow = { character_a: string; character_b: string };

const EMPTY_ADAPTIVE: AdaptiveData = {
  maybeRateMap: undefined,
  netGainMap: undefined,
  confusionDiscriminators: undefined,
  disputeMap: undefined,
  attributeTrustMap: undefined,
  characterPopularityMap: undefined,
  questionEmpiricalGainMap: undefined,
  questionQualityPenaltyMap: undefined,
  confusionPairs: undefined,
  activeWeights: undefined,
};

/** Load runtime adaptive data in parallel — best-effort; failures degrade gracefully.
 *  Called on every answer, skip, and reject-guess turn. */
export async function loadAdaptiveData(
  db: D1Database | undefined,
): Promise<AdaptiveData> {
  if (!db) return { ...EMPTY_ADAPTIVE };

  const [
    maybeRatesRaw,
    netGainsRaw,
    confusionRaw,
    disputeRows,
    attributeTrustRaw,
    characterPopularityRaw,
    questionEmpiricalGainRaw,
    questionQualityPenaltyRaw,
    confusionPairRows,
    activeWeightsRaw,
    autoTuneEnabledRaw,
  ] = await Promise.allSettled([
    d1CacheGet<Record<string, number>>(db, "kv:attribute-maybe-rates"),
    d1CacheGet<Record<string, number>>(db, "kv:attribute-net-gains"),
    d1CacheGet<Record<string, string[]>>(db, "kv:confusion-discriminators"),
    db
      .prepare(
        `SELECT character_id, attribute_key, confidence FROM attribute_disputes WHERE status = 'open'`,
      )
      .all<DisputeRow>()
      .then((r) => r.results),
    d1CacheGet<Record<string, number>>(db, "kv:attribute-trust"),
    d1CacheGet<Record<string, number>>(db, "kv:character-popularity"),
    d1CacheGet<Record<string, number>>(db, "kv:question-empirical-gain"),
    d1CacheGet<Record<string, number>>(db, "kv:question-quality-penalty"),
    db
      .prepare(
        `SELECT character_a, character_b FROM character_confusions WHERE confusion_count >= 2`,
      )
      .all<ConfusionPairRow>()
      .then((r) => r.results),
    d1ConfigGetJson<Record<string, number>>(db, "engine:weights-active"),
    d1ConfigGet(db, "engine:auto-tune-enabled"),
  ]);

  const maybeRateMap =
    maybeRatesRaw.status === "fulfilled"
      ? (maybeRatesRaw.value ?? undefined)
      : undefined;
  const netGainMap =
    netGainsRaw.status === "fulfilled"
      ? (netGainsRaw.value ?? undefined)
      : undefined;
  const confusionDiscriminators =
    confusionRaw.status === "fulfilled"
      ? (confusionRaw.value ?? undefined)
      : undefined;
  const attributeTrustMap =
    attributeTrustRaw.status === "fulfilled"
      ? (attributeTrustRaw.value ?? undefined)
      : undefined;
  const characterPopularityMap =
    characterPopularityRaw.status === "fulfilled"
      ? (characterPopularityRaw.value ?? undefined)
      : undefined;
  const questionEmpiricalGainMap =
    questionEmpiricalGainRaw.status === "fulfilled"
      ? (questionEmpiricalGainRaw.value ?? undefined)
      : undefined;
  const questionQualityPenaltyMap =
    questionQualityPenaltyRaw.status === "fulfilled"
      ? (questionQualityPenaltyRaw.value ?? undefined)
      : undefined;

  let disputeMap: Record<string, Record<string, number>> | undefined;
  if (disputeRows.status === "fulfilled" && disputeRows.value.length > 0) {
    disputeMap = {};
    for (const row of disputeRows.value) {
      disputeMap[row.character_id] ??= {};
      disputeMap[row.character_id]![row.attribute_key] = row.confidence;
    }
  }

  let confusionPairs: Set<string> | undefined;
  if (
    confusionPairRows.status === "fulfilled" &&
    confusionPairRows.value.length > 0
  ) {
    confusionPairs = new Set(
      confusionPairRows.value.map((r) => `${r.character_a}::${r.character_b}`),
    );
  }

  // Auto-tune kill switch: any value other than the literal string 'true'
  // (case-insensitive) means disabled. Defaults to disabled when unset —
  // weights only take effect once explicitly toggled on.
  const autoTuneOn =
    autoTuneEnabledRaw.status === "fulfilled" &&
    typeof autoTuneEnabledRaw.value === "string" &&
    autoTuneEnabledRaw.value.trim().toLowerCase() === "true";

  let activeWeights: ScoringWeights | undefined;
  if (
    autoTuneOn &&
    activeWeightsRaw.status === "fulfilled" &&
    activeWeightsRaw.value
  ) {
    const raw = activeWeightsRaw.value;
    const validKeys = ["match", "mismatch", "maybe", "maybeMiss"] as const;
    const candidate: Record<string, number> = {};
    for (const k of validKeys) {
      const v = raw[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 5) {
        candidate[k] = v;
      }
    }
    if (Object.keys(candidate).length > 0) {
      activeWeights = candidate;
    }
  }

  return {
    maybeRateMap,
    netGainMap,
    confusionDiscriminators,
    disputeMap,
    attributeTrustMap,
    characterPopularityMap,
    questionEmpiricalGainMap,
    questionQualityPenaltyMap,
    confusionPairs,
    activeWeights,
  };
}
