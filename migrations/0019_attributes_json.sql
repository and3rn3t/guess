-- Denormalized attributes_json column on characters.
-- Stores all non-null attributes as a JSON object { attribute_key: 0|1 }.
-- Eliminates the large character_attributes JOIN in game/start.ts and game/resume.ts
-- (reduces D1 payload from ~25-50K rows down to 500 rows for a typical pool).

ALTER TABLE characters ADD COLUMN attributes_json TEXT NOT NULL DEFAULT '{}';

-- Backfill from existing character_attributes
UPDATE characters SET attributes_json = COALESCE(
  (SELECT json_group_object(attribute_key, value)
   FROM character_attributes
   WHERE character_id = characters.id AND value IS NOT NULL),
  '{}'
);

-- ── Sync triggers ─────────────────────────────────────────────────────────────

-- New non-null attribute inserted
CREATE TRIGGER IF NOT EXISTS trg_attrs_json_insert
AFTER INSERT ON character_attributes
FOR EACH ROW
WHEN NEW.value IS NOT NULL
BEGIN
  UPDATE characters SET attributes_json = COALESCE(
    (SELECT json_group_object(attribute_key, value)
     FROM character_attributes
     WHERE character_id = NEW.character_id AND value IS NOT NULL),
    '{}'
  ) WHERE id = NEW.character_id;
END;

-- Non-null attribute deleted (set to NULL or removed)
CREATE TRIGGER IF NOT EXISTS trg_attrs_json_delete
AFTER DELETE ON character_attributes
FOR EACH ROW
WHEN OLD.value IS NOT NULL
BEGIN
  UPDATE characters SET attributes_json = COALESCE(
    (SELECT json_group_object(attribute_key, value)
     FROM character_attributes
     WHERE character_id = OLD.character_id AND value IS NOT NULL),
    '{}'
  ) WHERE id = OLD.character_id;
END;

-- Attribute value changed
CREATE TRIGGER IF NOT EXISTS trg_attrs_json_update
AFTER UPDATE OF value ON character_attributes
FOR EACH ROW
BEGIN
  UPDATE characters SET attributes_json = COALESCE(
    (SELECT json_group_object(attribute_key, value)
     FROM character_attributes
     WHERE character_id = NEW.character_id AND value IS NOT NULL),
    '{}'
  ) WHERE id = NEW.character_id;
END;
