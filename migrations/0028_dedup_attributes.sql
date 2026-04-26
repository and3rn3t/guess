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

-- ── Step 1: Merge loser rows into winner (insert only where winner is missing) ─────────

INSERT OR IGNORE INTO character_attributes (character_id, attribute_key, value, confidence)
SELECT character_id, 'fromVideoGame', value, confidence
FROM character_attributes
WHERE attribute_key = 'isVideoGameCharacter';

INSERT OR IGNORE INTO character_attributes (character_id, attribute_key, value, confidence)
SELECT character_id, 'fromMovie', value, confidence
FROM character_attributes
WHERE attribute_key = 'isFromMovie';

INSERT OR IGNORE INTO character_attributes (character_id, attribute_key, value, confidence)
SELECT character_id, 'fromBook', value, confidence
FROM character_attributes
WHERE attribute_key = 'isFromBook';

-- ── Step 2: Remove loser rows ──────────────────────────────────────────────────────────

DELETE FROM character_attributes WHERE attribute_key = 'isVideoGameCharacter';
DELETE FROM character_attributes WHERE attribute_key = 'isFromMovie';
DELETE FROM character_attributes WHERE attribute_key = 'isFromBook';

-- ── Step 3: Remove loser questions ────────────────────────────────────────────────────

DELETE FROM questions WHERE attribute_key = 'isVideoGameCharacter';
DELETE FROM questions WHERE attribute_key = 'isFromMovie';
DELETE FROM questions WHERE attribute_key = 'isFromBook';

-- ── Step 4: Remove loser attribute definitions ────────────────────────────────────────

DELETE FROM attribute_definitions WHERE key = 'isVideoGameCharacter';
DELETE FROM attribute_definitions WHERE key = 'isFromMovie';
DELETE FROM attribute_definitions WHERE key = 'isFromBook';

-- ── Step 5: Deactivate zero-info attributes ────────────────────────────────────────────

UPDATE attribute_definitions
SET is_active = 0
WHERE key IN ('isFictional', 'isReal', 'livesInNewYork');
