-- Migration 0028: Deduplicate attribute pairs and deactivate zero-info attributes
-- 
-- Problem: Three duplicate attribute pairs split character_attributes coverage, reducing
-- per-attribute info gain. Two zero-info attributes waste question budget.
--
-- Duplicate pairs (winner → loser):
--   fromVideoGame   → isVideoGameCharacter
--   fromMovie       → isFromMovie
--   fromBook        → isFromBook
--
-- Zero-info attributes (deactivate, not delete — preserves history):
--   isFictional     (all game characters are fictional → ~0 info gain)
--   isReal          (inverse of isFictional → same problem)
--   livesInNewYork  (hyperspecific single-city geography with no peer attributes)

-- NOTE: The INSERT OR IGNORE ... SELECT merge step was removed because it causes
-- SQLITE_NOMEM on D1 when character_attributes is large (builds full result set in memory).
-- Trade-off: characters that ONLY had the loser key (not the canonical key) will lose
-- that attribute — re-run the enrichment pipeline to restore coverage for those characters.

-- ── Step 1: Remove loser character_attribute rows ─────────────────────────────────────

DELETE FROM character_attributes
WHERE attribute_key IN ('isVideoGameCharacter', 'isFromMovie', 'isFromBook');

-- ── Step 2: Remove loser questions ────────────────────────────────────────────────────

DELETE FROM questions
WHERE attribute_key IN ('isVideoGameCharacter', 'isFromMovie', 'isFromBook');

-- ── Step 3: Remove loser attribute definitions ────────────────────────────────────────

DELETE FROM attribute_definitions
WHERE key IN ('isVideoGameCharacter', 'isFromMovie', 'isFromBook');

-- ── Step 4: Deactivate zero-info attributes ────────────────────────────────────────────

UPDATE attribute_definitions
SET is_active = 0
WHERE key IN ('isFictional', 'isReal', 'livesInNewYork');
