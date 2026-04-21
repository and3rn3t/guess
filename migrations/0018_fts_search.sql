-- FTS5 virtual table for fast full-text character name search.
-- Replaces the leading-wildcard LIKE '%search%' query (which causes a full table scan)
-- with an inverted index MATCH lookup, then joins back to characters for filtering.

CREATE VIRTUAL TABLE IF NOT EXISTS characters_fts USING fts5(
  name,
  content='characters',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

-- Populate with existing data
INSERT INTO characters_fts(rowid, name)
SELECT rowid, name FROM characters;

-- ── Sync triggers ─────────────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS characters_fts_ai
AFTER INSERT ON characters BEGIN
  INSERT INTO characters_fts(rowid, name) VALUES (new.rowid, new.name);
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_ad
AFTER DELETE ON characters BEGIN
  INSERT INTO characters_fts(characters_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_au
AFTER UPDATE ON characters BEGIN
  INSERT INTO characters_fts(characters_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
  INSERT INTO characters_fts(rowid, name) VALUES (new.rowid, new.name);
END;
