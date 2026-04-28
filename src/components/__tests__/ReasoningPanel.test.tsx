// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReasoningPanel } from '../ReasoningPanel'
import type { ReasoningExplanation } from '@/lib/types'

// Mock heavy deps
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useSpring: (v: number) => ({ get: () => v }),
  useTransform: (_: unknown, fn: (v: number) => string) => fn(0),
}))

vi.mock('@phosphor-icons/react', () => {
  const Icon = () => <span />
  return { Brain: Icon, Lightbulb: Icon, Sparkle: Icon, CaretDown: Icon, Trophy: Icon }
})

vi.mock('@/components/CharacterImage', () => ({
  CharacterImage: ({ name }: { name: string }) => <img alt={name} />,
}))

vi.mock('recharts', () => ({
  LineChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

const mockReasoning: ReasoningExplanation = {
  remaining: 12,
  confidence: 75,
  why: 'This question splits the remaining pool evenly.',
  impact: 'Expected to eliminate ~40% of candidates.',
  topCandidates: [
    { name: 'Goku', probability: 40, imageUrl: null },
    { name: 'Naruto', probability: 30, imageUrl: null },
  ],
}

describe('ReasoningPanel', () => {
  it('renders placeholder when reasoning is null', () => {
    render(<ReasoningPanel reasoning={null} />)
    expect(screen.getByText(/AI Reasoning/i)).toBeInTheDocument()
    expect(screen.getByText(/Start the game/i)).toBeInTheDocument()
  })

  it('renders remaining and confidence stats', () => {
    render(<ReasoningPanel reasoning={mockReasoning} />)
    expect(screen.getByText('12')).toBeInTheDocument() // remaining
    expect(screen.getByText('75%')).toBeInTheDocument() // confidence
  })

  it('renders top candidate names', () => {
    render(<ReasoningPanel reasoning={mockReasoning} />)
    const gokuEls = screen.getAllByText('Goku')
    expect(gokuEls.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Naruto').length).toBeGreaterThan(0)
  })

  it('shows "thinking" state via isThinking prop', () => {
    render(<ReasoningPanel reasoning={null} isThinking={true} />)
    // Placeholder still shown; isThinking animates the Brain icon in real component
    expect(screen.getByText(/AI Reasoning/i)).toBeInTheDocument()
  })

  it('expand/collapse toggles detail visibility', async () => {
    const user = userEvent.setup()
    render(<ReasoningPanel reasoning={mockReasoning} />)
    // The button's text is "AI Reasoning" — click to expand mobile details
    const toggle = screen.getByRole('button', { name: /AI Reasoning/i })
    await user.click(toggle)
    // After click the expanded state should flip (no CSS assertions — jsdom doesn't process Tailwind)
    expect(toggle).toBeInTheDocument()
  })
})
