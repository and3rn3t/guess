/**
 * TableExportMenu — AP.14 CSV / JSON export buttons on every table
 *
 * Provides export options for tabular data:
 * - Copy as TSV (Tab-Separated Values, for spreadsheets)
 * - Download as CSV
 * - Download as JSON
 * - Copy as Markdown table
 *
 * Supports filtering: exports only the rows currently shown in the table.
 */
import { useState } from 'react'
import { Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TableExportRow {
  [key: string]: string | number | boolean | null | undefined
}

export interface TableExportColumn {
  key: string
  header: string
}

interface TableExportMenuProps {
  /** Rows to export (typically filtered) */
  rows: TableExportRow[]
  /** Column definitions with keys and headers */
  columns: TableExportColumn[]
  /** Optional filename base (without extension) */
  filename?: string
}

/** Convert rows to TSV string */
export function rowsToTsv(rows: TableExportRow[], columns: TableExportColumn[]): string {
  const header = columns.map((c) => c.header).join('\t')
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col.key]
          const str = val === null || val === undefined ? '' : String(val)
          // Escape tabs and newlines in TSV
          return str.replace(/\t/g, ' ').replace(/\n/g, ' ')
        })
        .join('\t'),
    )
    .join('\n')
  return `${header}\n${body}`
}

/** Convert rows to CSV string (RFC 4180) */
export function rowsToCsv(rows: TableExportRow[], columns: TableExportColumn[]): string {
  const escaped = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val)
    // RFC 4180: fields containing commas, quotes, or newlines must be quoted
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"` // Escape quotes by doubling
    }
    return str
  }

  const header = columns.map((c) => escaped(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((col) => escaped(row[col.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

/** Convert rows to JSON string */
export function rowsToJson(rows: TableExportRow[], columns: TableExportColumn[]): string {
  const filtered = rows.map((row) => {
    const obj: TableExportRow = {}
    columns.forEach((col) => {
      obj[col.key] = row[col.key]
    })
    return obj
  })
  return JSON.stringify(filtered, null, 2)
}

/** Convert rows to Markdown table string */
export function rowsToMarkdown(rows: TableExportRow[], columns: TableExportColumn[]): string {
  const header = `| ${columns.map((c) => c.header).join(' | ')} |`
  const separator = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows
    .map(
      (row) =>
        `| ${columns
          .map((col) => {
            const val = row[col.key]
            const str = val === null || val === undefined ? '' : String(val)
            // Escape pipes in markdown
            return str.replace(/\|/g, '\\|')
          })
          .join(' | ')} |`,
    )
    .join('\n')
  return `${header}\n${separator}\n${body}`
}

/** Trigger a file download */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Copy text to clipboard */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function TableExportMenu({
  rows,
  columns,
  filename = 'export',
}: Readonly<TableExportMenuProps>): React.JSX.Element {
  const [justCopied, setJustCopied] = useState<string | null>(null)

  const handleCopyTsv = async () => {
    const tsv = rowsToTsv(rows, columns)
    const success = await copyToClipboard(tsv)
    if (success) {
      setJustCopied('tsv')
      setTimeout(() => setJustCopied(null), 2000)
    }
  }

  const handleDownloadCsv = () => {
    const csv = rowsToCsv(rows, columns)
    downloadFile(csv, `${filename}.csv`, 'text/csv')
  }

  const handleDownloadJson = () => {
    const json = rowsToJson(rows, columns)
    downloadFile(json, `${filename}.json`, 'application/json')
  }

  const handleCopyMarkdown = async () => {
    const md = rowsToMarkdown(rows, columns)
    const success = await copyToClipboard(md)
    if (success) {
      setJustCopied('markdown')
      setTimeout(() => setJustCopied(null), 2000)
    }
  }

  const isDisabled = rows.length === 0

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleCopyTsv}
        className="gap-2"
      >
        {justCopied === 'tsv' ? <Check size={16} /> : <Copy size={16} />}
        TSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleCopyMarkdown}
        className="gap-2"
      >
        {justCopied === 'markdown' ? <Check size={16} /> : <Copy size={16} />}
        Markdown
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleDownloadCsv}
        className="gap-2"
      >
        <Download size={16} />
        CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleDownloadJson}
        className="gap-2"
      >
        <Download size={16} />
        JSON
      </Button>
    </div>
  )
}
