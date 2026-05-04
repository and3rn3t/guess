export interface TableExportRow {
  [key: string]: string | number | boolean | null | undefined
}

export interface TableExportColumn {
  key: string
  header: string
}

type TableExportValue = TableExportRow[keyof TableExportRow]

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
          return str.replaceAll('\t', ' ').replaceAll('\n', ' ')
        })
        .join('\t'),
    )
    .join('\n')
  return `${header}\n${body}`
}

/** Convert rows to CSV string (RFC 4180) */
export function rowsToCsv(rows: TableExportRow[], columns: TableExportColumn[]): string {
  const escaped = (val: TableExportValue): string => {
    const str = val === null || val === undefined ? '' : String(val)
    // RFC 4180: fields containing commas, quotes, or newlines must be quoted
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"` // Escape quotes by doubling
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
            return str.replaceAll('|', String.raw`\|`)
          })
          .join(' | ')} |`,
    )
    .join('\n')
  return `${header}\n${separator}\n${body}`
}
