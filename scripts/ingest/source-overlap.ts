/**
 * EN.5: Source Overlap Heatmap
 *
 * Queries the staging DB for pairwise source overlap after deduplication.
 * Reveals which data sources are redundant vs. additive — how many characters
 * appear in both Source A and Source B after cross-source dedup.
 *
 * Output: data/overlap.html — static HTML matrix table with color-coded cells.
 *
 * Usage (via run.ts):
 *   npx tsx scripts/ingest/run.ts source-overlap
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', '..', 'data', 'overlap.html');

interface SourceStats {
  source: string;
  total: number;
  canonical: number;
}

interface OverlapCell {
  sourceA: string;
  sourceB: string;
  overlap: number;
  pctOfA: number;
  pctOfB: number;
}

export async function runSourceOverlap(): Promise<void> {
  const db = getDb();

  // Get all sources with their character counts
  const sources = db.prepare(`
    SELECT
      rc.source,
      COUNT(*) as total,
      COUNT(CASE WHEN dm.canonical_id = rc.id THEN 1 END) as canonical
    FROM raw_characters rc
    LEFT JOIN dedup_map dm ON dm.canonical_id = rc.id
    GROUP BY rc.source
    ORDER BY COUNT(*) DESC
  `).all() as SourceStats[];

  if (sources.length === 0) {
    console.log('No source data found in staging DB. Run ingestion first.');
    return;
  }

  console.log(`Found ${sources.length} sources:`);
  for (const s of sources) {
    console.log(`  ${s.source}: ${s.total.toLocaleString()} total, ${s.canonical.toLocaleString()} canonical`);
  }

  // Compute pairwise overlap: characters whose canonical_id appears in both sources
  // A character appears in source X if its raw_id (any row) has source = X and maps to the canonical
  const overlaps: OverlapCell[] = [];

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];

      // Characters that have at least one row from sourceA AND one from sourceB,
      // both pointing to the same canonical_id
      const result = db.prepare(`
        SELECT COUNT(DISTINCT dm.canonical_id) as overlap
        FROM dedup_map dm
        WHERE dm.canonical_id IN (
          SELECT dm2.canonical_id FROM raw_characters rc2
          INNER JOIN dedup_map dm2 ON dm2.raw_id = rc2.id
          WHERE rc2.source = ?
        )
        AND dm.canonical_id IN (
          SELECT dm3.canonical_id FROM raw_characters rc3
          INNER JOIN dedup_map dm3 ON dm3.raw_id = rc3.id
          WHERE rc3.source = ?
        )
      `).get(a.source, b.source) as { overlap: number };

      overlaps.push({
        sourceA: a.source,
        sourceB: b.source,
        overlap: result.overlap,
        pctOfA: a.canonical > 0 ? (result.overlap / a.canonical) * 100 : 0,
        pctOfB: b.canonical > 0 ? (result.overlap / b.canonical) * 100 : 0,
      });

      console.log(`  ${a.source} ∩ ${b.source}: ${result.overlap.toLocaleString()} characters`);
    }
  }

  // Generate HTML
  const html = buildHtml(sources, overlaps);

  const dir = path.dirname(OUTPUT_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUTPUT_FILE, html);

  console.log(`\nSource overlap heatmap written to ${OUTPUT_FILE}`);
}

function buildHtml(sources: SourceStats[], overlaps: OverlapCell[]): string {
  const sourceNames = sources.map(s => s.source);
  const overlapMap = new Map<string, OverlapCell>();
  for (const o of overlaps) {
    overlapMap.set(`${o.sourceA}|${o.sourceB}`, o);
    overlapMap.set(`${o.sourceB}|${o.sourceA}`, { ...o, sourceA: o.sourceB, sourceB: o.sourceA, pctOfA: o.pctOfB, pctOfB: o.pctOfA });
  }

  const maxOverlap = Math.max(...overlaps.map(o => o.overlap), 1);
  const date = new Date().toUTCString();

  const headerCells = sourceNames.map(s => `<th>${s}</th>`).join('');
  const rows = sourceNames.map(rowSrc => {
    const rowSource = sources.find(s => s.source === rowSrc)!;
    const cells = sourceNames.map(colSrc => {
      if (rowSrc === colSrc) {
        return `<td class="diagonal"><strong>${rowSource.canonical.toLocaleString()}</strong><span>canonical</span></td>`;
      }
      const key = `${rowSrc}|${colSrc}`;
      const cell = overlapMap.get(key);
      if (!cell) return `<td class="empty">—</td>`;
      const intensity = cell.overlap / maxOverlap;
      const bg = `rgba(99, 102, 241, ${(intensity * 0.7 + 0.05).toFixed(2)})`;
      const textColor = intensity > 0.5 ? '#fff' : '#1e1b4b';
      return `<td style="background:${bg};color:${textColor}" title="${cell.sourceA} ∩ ${cell.sourceB}: ${cell.overlap.toLocaleString()} chars&#10;${cell.pctOfA.toFixed(1)}% of ${cell.sourceA}, ${cell.pctOfB.toFixed(1)}% of ${cell.sourceB}">
        <strong>${cell.overlap.toLocaleString()}</strong>
        <span>${cell.pctOfA.toFixed(0)}% / ${cell.pctOfB.toFixed(0)}%</span>
      </td>`;
    }).join('');
    return `<tr><th>${rowSrc}<span class="total">${rowSource.total.toLocaleString()} raw</span></th>${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Source Overlap Heatmap</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0e17; color: #e0e0e0; margin: 0; padding: 24px; }
    h1 { font-size: 1.5rem; margin: 0 0 4px; color: #a5b4fc; }
    .meta { font-size: 0.8rem; color: #6b7280; margin-bottom: 24px; }
    .legend { font-size: 0.8rem; color: #9ca3af; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 10px 14px; text-align: center; border: 1px solid #1f2937; min-width: 100px; }
    th { background: #1a1830; color: #a5b4fc; font-weight: 600; font-size: 0.85rem; }
    th:first-child { text-align: right; }
    th .total { display: block; font-size: 0.7rem; color: #6b7280; font-weight: 400; }
    td strong { display: block; font-size: 1rem; }
    td span { display: block; font-size: 0.7rem; opacity: 0.85; }
    td.diagonal { background: #1e1b4b; color: #c7d2fe; }
    td.empty { background: #111827; color: #374151; }
    td { transition: opacity 0.15s; }
    td:hover { opacity: 0.85; cursor: default; }
  </style>
</head>
<body>
  <h1>Source Overlap Heatmap</h1>
  <p class="meta">Generated ${date} · Values show canonical character overlap after deduplication</p>
  <p class="legend">Cell shows: <strong>overlap count</strong> / <em>% of row source · % of col source</em> · Hover for details</p>
  <table>
    <thead><tr><th></th>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
