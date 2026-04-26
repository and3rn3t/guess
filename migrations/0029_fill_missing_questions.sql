-- Migration 0029: Fill missing questions table rows for active attributes
--
-- Problem: Some attribute_definitions rows with question_text have no corresponding
-- row in the questions table, so selectBestQuestion never picks them.
--
-- Solution: Insert a questions row for any active attribute that has question_text
-- but no existing questions row. Uses 'q_fill_<key>' as the ID prefix.

INSERT OR IGNORE INTO questions (id, text, attribute_key, priority)
SELECT
  'q_fill_' || ad.key AS id,
  ad.question_text     AS text,
  ad.key               AS attribute_key,
  1.0                  AS priority
FROM attribute_definitions ad
WHERE ad.is_active = 1
  AND ad.question_text IS NOT NULL
  AND ad.question_text != ''
  AND NOT EXISTS (
    SELECT 1 FROM questions q WHERE q.attribute_key = ad.key
  );
