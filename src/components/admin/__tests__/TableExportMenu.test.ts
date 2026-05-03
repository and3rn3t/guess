/**
 * TableExportMenu unit tests — AP.14 CSV / JSON export primitives
 */
import { test, expect } from 'vitest'
import {
  type TableExportRow,
  type TableExportColumn,
  rowsToTsv,
  rowsToCsv,
  rowsToJson,
  rowsToMarkdown,
} from '../TableExportMenu'

const columns: TableExportColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'count', header: 'Count' },
]

test('TSV export — basic row', () => {
  const rows = [{ id: '1', name: 'Alice', count: 42 }]
  const result = rowsToTsv(rows, columns)
  expect(result).toBe('ID\tName\tCount\n1\tAlice\t42')
})

test('TSV export — escapes tabs in values', () => {
  const rows = [{ id: '1', name: 'Alice\tBob', count: 42 }]
  const result = rowsToTsv(rows, columns)
  // Tab should be replaced with space
  expect(result).toContain('Alice Bob')
  expect(result).not.toContain('Alice\tBob')
})

test('TSV export — handles nulls', () => {
  const rows = [{ id: '1', name: null, count: 42 }]
  const result = rowsToTsv(rows, columns)
  expect(result).toBe('ID\tName\tCount\n1\t\t42')
})

test('CSV export — basic row', () => {
  const rows = [{ id: '1', name: 'Alice', count: 42 }]
  const result = rowsToCsv(rows, columns)
  expect(result).toBe('ID,Name,Count\n1,Alice,42')
})

test('CSV export — escapes commas in values', () => {
  const rows = [{ id: '1', name: 'Alice, Inc', count: 42 }]
  const result = rowsToCsv(rows, columns)
  expect(result).toBe('ID,Name,Count\n1,"Alice, Inc",42')
})

test('CSV export — escapes quotes by doubling', () => {
  const rows = [{ id: '1', name: 'Alice "Ace" Smith', count: 42 }]
  const result = rowsToCsv(rows, columns)
  expect(result).toBe('ID,Name,Count\n1,"Alice ""Ace"" Smith",42')
})

test('CSV export — escapes newlines in values', () => {
  const rows = [{ id: '1', name: 'Alice\nBob', count: 42 }]
  const result = rowsToCsv(rows, columns)
  expect(result).toContain('"Alice\nBob"')
})

test('JSON export — basic rows', () => {
  const rows = [
    { id: '1', name: 'Alice', count: 42 },
    { id: '2', name: 'Bob', count: 17 },
  ]
  const result = rowsToJson(rows, columns)
  const parsed = JSON.parse(result)
  expect(parsed).toHaveLength(2)
  expect(parsed[0]).toEqual({ id: '1', name: 'Alice', count: 42 })
})

test('JSON export — preserves data types', () => {
  const rows = [{ id: '1', name: 'Alice', count: 42 }]
  const result = rowsToJson(rows, columns)
  const parsed = JSON.parse(result)
  expect(typeof parsed[0].count).toBe('number')
  expect(parsed[0].count).toBe(42)
})

test('Markdown export — basic table', () => {
  const rows = [
    { id: '1', name: 'Alice', count: '42' },
    { id: '2', name: 'Bob', count: '17' },
  ]
  const result = rowsToMarkdown(rows, columns)
  expect(result).toContain('| ID | Name | Count |')
  expect(result).toContain('| --- | --- | --- |')
  expect(result).toContain('| 1 | Alice | 42 |')
})

test('Markdown export — escapes pipes in values', () => {
  const rows = [{ id: '1', name: 'Alice | Bob', count: '42' }]
  const result = rowsToMarkdown(rows, columns)
  expect(result).toContain('Alice \\| Bob')
  expect(result).not.toContain('Alice | Bob |')
})

test('Markdown export — handles nulls', () => {
  const rows = [{ id: '1', name: null, count: '42' }]
  const result = rowsToMarkdown(rows, columns)
  expect(result).toBe('| ID | Name | Count |\n| --- | --- | --- |\n| 1 |  | 42 |')
})

test('Empty rows export — all formats', () => {
  const rows: TableExportRow[] = []
  const tsv = rowsToTsv(rows, columns)
  const csv = rowsToCsv(rows, columns)
  const json = rowsToJson(rows, columns)
  const markdown = rowsToMarkdown(rows, columns)

  // Headers only (with trailing newline from header\n${"" empty body})
  expect(tsv).toBe('ID\tName\tCount\n')
  expect(csv).toBe('ID,Name,Count\n')
  expect(JSON.parse(json)).toEqual([])
  expect(markdown).toContain('| ID | Name | Count |')
})
