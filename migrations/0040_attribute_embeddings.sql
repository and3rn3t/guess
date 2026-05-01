-- B.4: Question deduplication via embeddings.
--
-- One row per question (keyed by attribute_key, matching the questions table).
-- `embedding` is the raw Float32Array bytes (4 × dim bytes) — bge-base-en-v1.5
-- emits 768-dim vectors so each blob is 3,072 bytes. Dim stored explicitly so
-- the deserializer doesn't have to assume.
--
-- `dismissed_pairs` records "no, these aren't actually duplicates" decisions
-- so the admin queue doesn't keep re-surfacing the same false positives.
-- Pair keys are canonicalised so (a, b) and (b, a) collapse to one row.

CREATE TABLE IF NOT EXISTS attribute_embeddings (
  attribute_key TEXT    PRIMARY KEY,
  embedding     BLOB    NOT NULL,
  dim           INTEGER NOT NULL,
  model         TEXT    NOT NULL,
  text_hash     TEXT    NOT NULL,                 -- short hash of the source text so we know when to refresh
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_attribute_embeddings_model
  ON attribute_embeddings(model);

CREATE TABLE IF NOT EXISTS question_dedup_dismissed (
  -- Canonical pair key: lower(attribute_key_a) || '::' || lower(attribute_key_b)
  -- with attribute_key_a < attribute_key_b enforced by the writer.
  pair_key       TEXT    PRIMARY KEY,
  attribute_key_a TEXT   NOT NULL,
  attribute_key_b TEXT   NOT NULL,
  similarity     REAL    NOT NULL,
  dismissed_by   TEXT,
  dismissed_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
