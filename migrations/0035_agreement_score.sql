-- Migration 0035: cross-source agreement scorecard (DQ.3)
--
-- Adds two columns to character_attributes that quantify how strongly the
-- stored value is corroborated by independent signals:
--
--   agreement_score    REAL    NULL when no signals exist; otherwise [0, 1].
--                              1.0 = every signal agrees with the stored value;
--                              0.0 = every signal contradicts it.
--   agreement_signals  INTEGER count of independent signals that contributed
--                              to the score (0 when no signals).
--
-- Signals come from:
--   • game_reveals      — confident yes/no player answers for the same
--                          (character, attribute) pair (1 signal each)
--   • attribute_disputes — open dispute = 1 disagreeing signal;
--                          dismissed dispute = 1 agreeing signal (we
--                          consciously kept the stored value); resolved =
--                          neutral (the value already changed).
--
-- Computed by `scripts/compute-agreement.ts` (intended for daily cron).
-- Designed so admin tables can sort by agreement_score ASC to surface the
-- most contested rows first; the engine and DQ.4 dispute prioritisation
-- consume the same column.
--
-- Existing rows start with NULL / 0 and are populated lazily by the script.

ALTER TABLE character_attributes ADD COLUMN agreement_score REAL;
ALTER TABLE character_attributes ADD COLUMN agreement_signals INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_character_attributes_agreement
  ON character_attributes(agreement_score)
  WHERE agreement_score IS NOT NULL;
