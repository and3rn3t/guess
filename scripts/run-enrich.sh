#!/usr/bin/env zsh
# Run enrichment in background, logging to data/enrich-log.txt
cd "$(dirname "$0")/.."
npx tsx scripts/ingest/run.ts enrich 5 >> data/enrich-log.txt 2>&1
