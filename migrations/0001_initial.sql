-- ============================================================
-- D1 Schema: Guess Character Database
-- Phase 1 — initial tables for characters, attributes, questions
-- ============================================================

-- Characters table — core character metadata
CREATE TABLE IF NOT EXISTS characters (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL CHECK (category IN (
    'video-games','movies','anime','comics','books','cartoons','tv-shows','pop-culture'
  )),
  source      TEXT    DEFAULT 'default',  -- 'default','tmdb','anilist','igdb','comicvine','wikidata','user'
  source_id   TEXT,                        -- external ID from source API
  popularity  REAL    DEFAULT 0,           -- normalized 0–1 popularity score
  image_url   TEXT,                        -- R2 URL or source thumbnail URL
  description TEXT,
  is_custom   INTEGER DEFAULT 0,           -- 1 if user-created
  created_by  TEXT,                        -- user ID who created (null for seeded/scraped)
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_characters_category   ON characters(category);
CREATE INDEX idx_characters_popularity ON characters(popularity DESC);
CREATE INDEX idx_characters_source     ON characters(source, source_id);
CREATE UNIQUE INDEX idx_characters_source_dedup ON characters(source, source_id)
  WHERE source_id IS NOT NULL;

-- Attribute definitions — the master list of boolean attributes
CREATE TABLE IF NOT EXISTS attribute_definitions (
  key           TEXT PRIMARY KEY,          -- camelCase key, e.g. 'isHuman'
  display_text  TEXT NOT NULL,             -- human label, e.g. 'Is Human'
  question_text TEXT,                      -- full question, e.g. 'Is this character a human?'
  categories    TEXT,                      -- JSON array of relevant categories, NULL = all
  created_at    INTEGER DEFAULT (unixepoch())
);

-- Character attributes — the sparse matrix of character × attribute values
CREATE TABLE IF NOT EXISTS character_attributes (
  character_id  TEXT    NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  attribute_key TEXT    NOT NULL REFERENCES attribute_definitions(key),
  value         INTEGER,                   -- 1 = true, 0 = false, NULL = unknown
  confidence    REAL    DEFAULT 1.0,       -- AI confidence 0–1 (1.0 for manually set)
  PRIMARY KEY (character_id, attribute_key)
);

CREATE INDEX idx_char_attrs_key_value ON character_attributes(attribute_key, value);
CREATE INDEX idx_char_attrs_character ON character_attributes(character_id);

-- Questions table — yes/no questions mapped to attributes
CREATE TABLE IF NOT EXISTS questions (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  attribute_key TEXT NOT NULL REFERENCES attribute_definitions(key),
  priority      REAL DEFAULT 1.0           -- higher = preferred in selection
);

CREATE INDEX idx_questions_attribute ON questions(attribute_key);
