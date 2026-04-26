-- Migration 0030: Add difficulty column to questions table
--
-- Purpose: Allows classifying questions by difficulty level so the game engine
-- can soft-filter mismatched questions (0.5× score penalty) when game difficulty
-- is set. Classification is done offline via scripts/classify-difficulty.ts.
--
-- Difficulty semantics:
--   easy   – binary, universally known (is it human? does it have a weapon?)
--   medium – requires some pop-culture knowledge (is it royalty? has a sidekick?)
--   hard   – niche or very specific (has tentacles? can regenerate? shoots lasers?)

ALTER TABLE questions ADD COLUMN difficulty TEXT
  CHECK (difficulty IN ('easy', 'medium', 'hard'))
  DEFAULT NULL;
