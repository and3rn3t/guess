/**
 * AdminCommandPalette unit tests — AP.10 global ⌘K command palette
 */
import { test, expect } from 'vitest'

// Simulated character filtering logic (extracted for testing)
function filterCharacters(
  characters: Array<{ id: string; name: string }>,
  search: string
): Array<{ id: string; name: string }> {
  if (!search.trim() || search.length < 2) return []
  const lower = search.toLowerCase()
  return characters
    .filter((c) => c.name.toLowerCase().includes(lower))
    .slice(0, 5)
}

// Simulated section filtering logic
interface Section {
  title: string
  items: Array<{ to: string; label: string }>
}

function filterSections(
  sections: Section[],
  search: string
): Section[] {
  if (!search.trim()) return sections
  const lower = search.toLowerCase()
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          item.to.toLowerCase().includes(lower)
      ),
    }))
    .filter((section) => section.items.length > 0)
}

// Simulated command filtering logic
interface Command {
  label: string
  action: () => void
}

function filterCommands(commands: Command[], search: string): Command[] {
  if (!search.trim()) return []
  const lower = search.toLowerCase()
  return commands.filter((cmd) => cmd.label.toLowerCase().includes(lower))
}

test('filterCharacters: empty search returns empty array', () => {
  const chars = [{ id: '1', name: 'Batman' }]
  expect(filterCharacters(chars, '')).toEqual([])
  expect(filterCharacters(chars, ' ')).toEqual([])
})

test('filterCharacters: search < 2 chars returns empty array', () => {
  const chars = [{ id: '1', name: 'Batman' }]
  expect(filterCharacters(chars, 'b')).toEqual([])
})

test('filterCharacters: matches character by name', () => {
  const chars = [
    { id: '1', name: 'Batman' },
    { id: '2', name: 'Superman' },
    { id: '3', name: 'Batgirl' },
  ]
  const result = filterCharacters(chars, 'bat')
  expect(result).toHaveLength(2)
  expect(result.map((c) => c.name)).toEqual(['Batman', 'Batgirl'])
})

test('filterCharacters: case-insensitive matching', () => {
  const chars = [{ id: '1', name: 'Batman' }]
  expect(filterCharacters(chars, 'BAT')).toEqual([{ id: '1', name: 'Batman' }])
})

test('filterCharacters: limits results to 5', () => {
  const chars = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    name: `Character ${i}`,
  }))
  expect(filterCharacters(chars, 'char')).toHaveLength(5)
})

test('filterSections: empty search returns all sections', () => {
  const sections: Section[] = [
    { title: 'Routes', items: [{ to: '/', label: 'Home' }] },
    { title: 'Other', items: [{ to: '/other', label: 'Other' }] },
  ]
  expect(filterSections(sections, '')).toEqual(sections)
})

test('filterSections: filters by item label', () => {
  const sections: Section[] = [
    { title: 'Data', items: [
      { to: '/characters', label: 'Characters' },
      { to: '/questions', label: 'Questions' },
    ]},
    { title: 'Tools', items: [{ to: '/logs', label: 'Error Logs' }]},
  ]
  const result = filterSections(sections, 'char')
  expect(result).toHaveLength(1)
  expect(result[0].title).toBe('Data')
  expect(result[0].items).toHaveLength(1)
  expect(result[0].items[0].label).toBe('Characters')
})

test('filterSections: filters by item to (route)', () => {
  const sections: Section[] = [
    { title: 'Data', items: [{ to: '/data-quality', label: 'Quality Check' }]},
  ]
  const result = filterSections(sections, 'quality')
  expect(result).toHaveLength(1)
  expect(result[0].items).toHaveLength(1)
})

test('filterSections: removes empty sections after filtering', () => {
  const sections: Section[] = [
    { title: 'Data', items: [{ to: '/characters', label: 'Characters' }]},
    { title: 'Logs', items: [{ to: '/logs', label: 'Error Logs' }]},
  ]
  const result = filterSections(sections, 'char')
  expect(result).toHaveLength(1)
  expect(result[0].title).toBe('Data')
})

test('filterCommands: empty search returns empty array', () => {
  const commands: Command[] = [{ label: 'Export CSV', action: () => {} }]
  expect(filterCommands(commands, '')).toEqual([])
})

test('filterCommands: matches command by label', () => {
  const cmd1 = { label: 'Export game_stats as CSV', action: () => {} }
  const cmd2 = { label: 'View recent errors', action: () => {} }
  const commands = [cmd1, cmd2]
  const result = filterCommands(commands, 'export')
  expect(result).toHaveLength(1)
  expect(result[0].label).toBe('Export game_stats as CSV')
})

test('filterCommands: case-insensitive matching', () => {
  const cmd = { label: 'Export CSV', action: () => {} }
  expect(filterCommands([cmd], 'EXPORT')).toHaveLength(1)
})

test('filterCommands: partial word matching', () => {
  const commands: Command[] = [
    { label: 'Check data quality', action: () => {} },
    { label: 'View recent errors', action: () => {} },
  ]
  const result = filterCommands(commands, 'data')
  expect(result).toHaveLength(1)
  expect(result[0].label).toBe('Check data quality')
})

test('composite: all filters work together', () => {
  const chars = [
    { id: '1', name: 'Batman' },
    { id: '2', name: 'Superman' },
  ]
  const sections: Section[] = [
    { title: 'Core', items: [{ to: '/char', label: 'Characters' }]},
  ]
  const commands: Command[] = [
    { label: 'Export game_stats as CSV', action: () => {} },
  ]

  const searchTerm = 'bat'
  const charResults = filterCharacters(chars, searchTerm)
  const sectionResults = filterSections(sections, searchTerm)
  const commandResults = filterCommands(commands, searchTerm)

  expect(charResults).toHaveLength(1)
  expect(charResults[0].name).toBe('Batman')
  expect(sectionResults).toHaveLength(0) // "bat" doesn't match "Characters" or "/char"
  expect(commandResults).toHaveLength(0) // "bat" doesn't match "Export game_stats as CSV"
})
