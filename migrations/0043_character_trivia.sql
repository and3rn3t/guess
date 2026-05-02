-- EN.29: Optional reveal-time trivia facts per character.
-- Stored as JSON text array (up to 3 short strings) to keep schema minimal.

ALTER TABLE characters ADD COLUMN trivia TEXT;
