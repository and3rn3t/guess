import { describe, it, expect } from 'vitest'

import {
  buildDefaultWorkflowProgress,
  buildPriorityItems,
  DEFAULT_THRESHOLDS,
  formatElapsed,
  formatRunAge,
  parseThresholds,
  parseWorkflowProgress,
  playbookStepLabel,
  priorityToneClasses,
  stepTone,
  WORKFLOW_PLAYBOOKS,
  workflowSyncBadge,
} from './landingHelpers'

describe('landingHelpers', () => {
  describe('buildDefaultWorkflowProgress', () => {
    it('returns an entry per playbook with null/false defaults', () => {
      const result = buildDefaultWorkflowProgress()
      expect(Object.keys(result).sort()).toEqual(WORKFLOW_PLAYBOOKS.map((p) => p.id).sort())
      for (const p of WORKFLOW_PLAYBOOKS) {
        expect(result[p.id]).toEqual({ activeTo: null, completed: false })
      }
    })
  })

  describe('parseWorkflowProgress', () => {
    it('returns defaults for null input', () => {
      expect(parseWorkflowProgress(null)).toEqual(buildDefaultWorkflowProgress())
    })

    it('returns defaults for invalid JSON', () => {
      expect(parseWorkflowProgress('not-json')).toEqual(buildDefaultWorkflowProgress())
    })

    it('returns defaults when JSON is not an object', () => {
      expect(parseWorkflowProgress('null')).toEqual(buildDefaultWorkflowProgress())
      expect(parseWorkflowProgress('"oops"')).toEqual(buildDefaultWorkflowProgress())
    })

    it('merges valid per-playbook entries over defaults', () => {
      const raw = JSON.stringify({ 'curate-core': { activeTo: 'characters', completed: true } })
      const result = parseWorkflowProgress(raw)
      expect(result['curate-core']).toEqual({ activeTo: 'characters', completed: true })
      expect(result['expand-knowledge']).toEqual({ activeTo: null, completed: false })
    })

    it('ignores non-string activeTo and non-true completed', () => {
      const raw = JSON.stringify({ 'curate-core': { activeTo: 42, completed: 'yes' } })
      expect(parseWorkflowProgress(raw)['curate-core']).toEqual({ activeTo: null, completed: false })
    })
  })

  describe('playbookStepLabel', () => {
    const playbook = WORKFLOW_PLAYBOOKS[0]

    it('returns "Not started" when activeTo is null', () => {
      expect(playbookStepLabel(playbook, null)).toBe('Not started')
    })

    it('returns the primary label when activeTo matches primary.to', () => {
      expect(playbookStepLabel(playbook, playbook.primary.to)).toBe(playbook.primary.label)
    })

    it('returns the supporting step label when activeTo matches', () => {
      const step = playbook.supporting[0]
      expect(playbookStepLabel(playbook, step.to)).toBe(step.label)
    })

    it('returns "Custom step" for unknown activeTo', () => {
      expect(playbookStepLabel(playbook, 'something-else')).toBe('Custom step')
    })
  })

  describe('buildPriorityItems', () => {
    it('returns empty array when stats is undefined', () => {
      expect(buildPriorityItems(undefined, DEFAULT_THRESHOLDS)).toEqual([])
    })

    it('emits warning item when pendingEnrich exceeds threshold', () => {
      const items = buildPriorityItems(
        { totalCharacters: 0, enriched: 0, pendingEnrich: 5, activeQuestions: 0, openDisputes: 0, pendingProposals: 0, games7d: 100 },
        { ...DEFAULT_THRESHOLDS, pendingEnrich: 0, lowGames7d: 0 },
      )
      expect(items).toHaveLength(1)
      expect(items[0].tone).toBe('warning')
      expect(items[0].title).toContain('5 characters need enrichment')
    })

    it('emits all four items when every threshold is breached', () => {
      const items = buildPriorityItems(
        { totalCharacters: 0, enriched: 0, pendingEnrich: 1, activeQuestions: 0, openDisputes: 1, pendingProposals: 1, games7d: 0 },
        DEFAULT_THRESHOLDS,
      )
      expect(items.map((i) => i.key).sort()).toEqual(['disputes', 'engagement', 'enrich', 'proposals'])
    })
  })

  describe('priorityToneClasses', () => {
    it('maps tone to deterministic class strings', () => {
      expect(priorityToneClasses('danger')).toContain('red-500')
      expect(priorityToneClasses('warning')).toContain('yellow-500')
      expect(priorityToneClasses('info')).toContain('blue-500')
    })
  })

  describe('parseThresholds', () => {
    it('returns defaults for null', () => {
      expect(parseThresholds(null)).toEqual(DEFAULT_THRESHOLDS)
    })

    it('returns defaults for invalid JSON', () => {
      expect(parseThresholds('bad')).toEqual(DEFAULT_THRESHOLDS)
    })

    it('clamps negative numbers to zero', () => {
      const raw = JSON.stringify({ pendingEnrich: -5, openDisputes: -1, pendingProposals: -2, lowGames7d: -10 })
      expect(parseThresholds(raw)).toEqual({ pendingEnrich: 0, openDisputes: 0, pendingProposals: 0, lowGames7d: 0 })
    })

    it('preserves valid numeric values', () => {
      const raw = JSON.stringify({ pendingEnrich: 10, openDisputes: 3, pendingProposals: 7, lowGames7d: 50 })
      expect(parseThresholds(raw)).toEqual({ pendingEnrich: 10, openDisputes: 3, pendingProposals: 7, lowGames7d: 50 })
    })

    it('falls back per-field to defaults for non-numeric fields', () => {
      const raw = JSON.stringify({ pendingEnrich: 'oops' })
      expect(parseThresholds(raw)).toEqual(DEFAULT_THRESHOLDS)
    })
  })

  describe('workflowSyncBadge', () => {
    it('returns distinct labels for each status', () => {
      expect(workflowSyncBadge('saved').label).toBe('Saved')
      expect(workflowSyncBadge('syncing').label).toBe('Syncing')
      expect(workflowSyncBadge('hydrating').label).toBe('Hydrating')
      expect(workflowSyncBadge('retry').label).toBe('Retry')
    })
  })

  describe('formatElapsed', () => {
    it('returns "n/a" for non-finite or negative', () => {
      expect(formatElapsed(NaN)).toBe('n/a')
      expect(formatElapsed(-1)).toBe('n/a')
    })

    it('formats sub-second as milliseconds', () => {
      expect(formatElapsed(420)).toBe('420 ms')
    })

    it('formats seconds with two decimals', () => {
      expect(formatElapsed(1500)).toBe('1.50 s')
    })
  })

  describe('formatRunAge', () => {
    it('returns "No run yet" for null', () => {
      expect(formatRunAge(null)).toBe('No run yet')
    })

    it('returns a relative window for recent timestamps', () => {
      expect(formatRunAge(Date.now() - 5_000)).toMatch(/s ago$/)
      expect(formatRunAge(Date.now() - 5 * 60_000)).toMatch(/m ago$/)
      expect(formatRunAge(Date.now() - 5 * 3_600_000)).toMatch(/h ago$/)
      expect(formatRunAge(Date.now() - 5 * 86_400_000)).toMatch(/d ago$/)
    })
  })

  describe('stepTone', () => {
    it('maps each status to its color class', () => {
      expect(stepTone('error')).toContain('red')
      expect(stepTone('skipped')).toContain('muted')
      expect(stepTone('inserted')).toContain('emerald')
      expect(stepTone('started')).toContain('emerald')
    })
  })
})
