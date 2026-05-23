#!/usr/bin/env bash
# Clone game content tables from production D1 → preview D1.
#
# What is synced:   characters, character_attributes, questions, attribute_definitions
# What is skipped:  game_stats, game_sessions, game_reveals, sim_game_stats,
#                   d1_migrations, FTS tables (auto-rebuilt by triggers)
#
# Usage:
#   pnpm db:clone-to-preview
#   zsh scripts/clone-prod-to-preview.sh

set -euo pipefail

DUMP_FILE="$(mktemp /tmp/prod-content-XXXXXX.sql)"

cleanup() {
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

CONTENT_TABLES=(characters character_attributes questions attribute_definitions)

echo "═══════════════════════════════════════════════"
echo "  Clone production → preview"
echo "  Tables: ${CONTENT_TABLES[*]}"
echo "═══════════════════════════════════════════════"

# ── 1. Export data only (no schema) from production ──────────────────────────
echo "\n[1/3] Exporting from production..."
TABLE_FLAGS=()
for t in "${CONTENT_TABLES[@]}"; do
  TABLE_FLAGS+=(--table "$t")
done

npx wrangler d1 export guess-db \
  --env production \
  --remote \
  --output "$DUMP_FILE" \
  --no-schema \
  "${TABLE_FLAGS[@]}"

ROW_COUNT=$(grep -c "^INSERT" "$DUMP_FILE" 2>/dev/null || echo 0)
echo "  → Exported $ROW_COUNT INSERT statements"

# Wrap dump with FK checks disabled so table insertion order doesn't matter.
# wrangler d1 export does not guarantee dependency order across tables.
PATCHED_FILE="$(mktemp /tmp/prod-content-patched-XXXXXX.sql)"
{ echo "PRAGMA foreign_keys = OFF;"; cat "$DUMP_FILE"; echo "PRAGMA foreign_keys = ON;"; } > "$PATCHED_FILE"
mv "$PATCHED_FILE" "$DUMP_FILE"

# ── 2. Clear preview tables in chunks (avoid D1 CPU time limit) ───────────────
echo "\n[2/3] Clearing preview content tables..."

# Reverse dependency order: child tables first.
# Per-call PRAGMA does not persist across wrangler invocations, so we rely on
# reverse-order deletes instead of disabling FKs.
CLEAR_TABLES=(character_attributes characters questions attribute_definitions)
CHUNK_SIZE=25000
MAX_RETRIES=5

for tbl in "${CLEAR_TABLES[@]}"; do
  echo "  → Clearing $tbl (chunks of $CHUNK_SIZE)..."
  while :; do
    attempt=0
    while :; do
      attempt=$((attempt + 1))
      if OUT=$(npx wrangler d1 execute guess-db-preview \
        --env preview \
        --remote \
        --json \
        --command "DELETE FROM $tbl WHERE rowid IN (SELECT rowid FROM $tbl LIMIT $CHUNK_SIZE);" 2>&1); then
        break
      fi
      if [ "$attempt" -ge "$MAX_RETRIES" ]; then
        echo "    chunk failed after $MAX_RETRIES attempts:"
        echo "$OUT"
        exit 1
      fi
      echo "    chunk failed (attempt $attempt/$MAX_RETRIES), backing off..."
      sleep $((attempt * 5))
    done
    CHANGES=$(echo "$OUT" | grep -oE '"changes":[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+$' || echo "0")
    echo "    deleted ${CHANGES:-0} rows from $tbl"
    if [ "${CHANGES:-0}" = "0" ]; then
      break
    fi
  done
done

echo "  → Preview tables cleared"

# ── 3. Apply production dump to preview ───────────────────────────────────────
echo "\n[3/3] Applying production data to preview..."
npx wrangler d1 execute guess-db-preview \
  --env preview \
  --remote \
  --file "$DUMP_FILE"

echo "\n✓ Done — preview now mirrors production content"
