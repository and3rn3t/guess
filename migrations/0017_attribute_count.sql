-- Denormalized attribute_count column on characters to replace the correlated
-- subquery in game/start.ts (SELECT ... GROUP BY character_id HAVING COUNT(*) >= N)
-- with a simple indexed equality check (attribute_count >= N).

ALTER TABLE characters ADD COLUMN attribute_count INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing data
UPDATE characters SET attribute_count = (
  SELECT COUNT(*)
  FROM character_attributes
  WHERE character_id = characters.id AND value IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_characters_attr_count ON characters(attribute_count);

-- ── Triggers to keep attribute_count in sync automatically ───────────────────

-- New non-null attribute inserted
CREATE TRIGGER IF NOT EXISTS trg_attr_count_insert
AFTER INSERT ON character_attributes
FOR EACH ROW
WHEN NEW.value IS NOT NULL
BEGIN
  UPDATE characters SET attribute_count = attribute_count + 1
  WHERE id = NEW.character_id;
END;

-- Non-null attribute deleted
CREATE TRIGGER IF NOT EXISTS trg_attr_count_delete
AFTER DELETE ON character_attributes
FOR EACH ROW
WHEN OLD.value IS NOT NULL
BEGIN
  UPDATE characters SET attribute_count = MAX(0, attribute_count - 1)
  WHERE id = OLD.character_id;
END;

-- Attribute value changed (NULL ↔ non-NULL, or true ↔ false)
-- Full recount is safer than trying to track the delta
CREATE TRIGGER IF NOT EXISTS trg_attr_count_update
AFTER UPDATE OF value ON character_attributes
FOR EACH ROW
BEGIN
  UPDATE characters SET attribute_count = (
    SELECT COUNT(*)
    FROM character_attributes
    WHERE character_id = NEW.character_id AND value IS NOT NULL
  ) WHERE id = NEW.character_id;
END;
