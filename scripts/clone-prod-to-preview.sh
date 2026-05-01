#!/usr/bin/env zsh
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

# Disable FKs once so reverse-order deletes are unnecessary.
npx wrangler d1 execute guess-db-preview \
  --env preview \
  --remote \
  --command "PRAGMA foreign_keys = OFF;" >/dev/null

# Reverse dependency order: child tables first.
CLEAR_TABLES=(character_attributes characters questions attribute_definitions)
CHUNK_SIZE=50000

for tbl in "${CLEAR_TABLES[@]}"; do
  echo "  → Clearing $tbl (chunks of $CHUNK_SIZE)..."
  while :; do
    OUT=$(npx wrangler d1 execute guess-db-preview \
      --env preview \
      --remote \
      --json \
      --command "DELETE FROM $tbl WHERE rowid IN (SELECT rowid FROM $tbl LIMIT $CHUNK_SIZE);" 2>&1) || {
        echo "$OUT"
        echo "    chunk failed, retrying after 2s..."
        sleep 2
        continue
      }
    # changes count appears in JSON meta; if zero, table is empty.
    CHANGES=$(echo "$OUT" | grep -oE '"changes":[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+$' || echo "0")
    echo "    deleted $CHANGES rows from $tbl"
    if [ "${CHANGES:-0}" = "0" ]; then
      break
    fi
  done
done

npx wrangler d1 execute guess-db-preview \
  --env preview \
  --remote \
  --command "PRAGMA foreign_keys = ON;" >/dev/null

echo "  → Preview tables cleared"

# ── 3. Apply production dump to preview ───────────────────────────────────────
echo "\n[3/3] Applying production data to preview..."
npx wrangler d1 execute guess-db-preview \
  --env preview \
  --remote \
  --file "$DUMP_FILE"

echo "\n✓ Done — preview now mirrors production content"
