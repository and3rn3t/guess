// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuestionCard, ThinkingCard } from '../QuestionCard'
import type { Question } from '@/lib/types'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _, animate: _a, exit: _e, transition: _t, drag: _dr, dragConstraints: _dc, dragElastic: _de, onDragEnd: _od, style: _s, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      return <div {...rest}>{children}</div>
    },
    span: ({ children, style: _s, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      return <span {...rest}>{children}</span>
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useTransform: () => ({ get: () => 0 }),
}))

vi.mock('@phosphor-icons/react', () => ({
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  Question: () => <span data-testid="icon-question" />,
  Keyboard: () => <span data-testid="icon-keyboard" />,
}))

vi.mock('@/lib/llm', () => ({
  llmWithMeta: vi.fn(),
  LlmError: class LlmError extends Error {},
}))

vi.mock('@/lib/prompts', () => ({
  conversationalParse_v1: vi.fn().mockReturnValue({ system: 'sys', user: 'usr' }),
}))

vi.mock('sonner', () => ({
  toast: vi.fn(),
}))

const QUESTION: Question = {
  id: 'q1',
  text: 'Is this character human?',
  attribute: 'isHuman',
}

describe('QuestionCard', () => {
  const onAnswer = vi.fn()

  beforeEach(() => {
    onAnswer.mockReset()
  })

  it('renders question text', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={3}
        totalQuestions={20}
        onAnswer={onAnswer}
      />,
    )
    expect(screen.getByText('Is this character human?')).toBeInTheDocument()
  })

  it('displays question number and total', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={3}
        totalQuestions={20}
        onAnswer={onAnswer}
      />,
    )
    expect(screen.getByText('Question 3 of 20')).toBeInTheDocument()
    expect(screen.getByText('15% Complete')).toBeInTheDocument()
  })

  it('renders all 4 answer buttons', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />,
    )
    expect(screen.getByRole('button', { name: /answer yes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /answer no/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /answer maybe/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /answer don't know/i })).toBeInTheDocument()
  })

  it('calls onAnswer with correct value for each button', async () => {
    const user = userEvent.setup()
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />,
    )

    await user.click(screen.getByRole('button', { name: /answer yes/i }))
    expect(onAnswer).toHaveBeenCalledWith('yes')

    await user.click(screen.getByRole('button', { name: /answer no/i }))
    expect(onAnswer).toHaveBeenCalledWith('no')

    await user.click(screen.getByRole('button', { name: /answer maybe/i }))
    expect(onAnswer).toHaveBeenCalledWith('maybe')

    await user.click(screen.getByRole('button', { name: /answer don't know/i }))
    expect(onAnswer).toHaveBeenCalledWith('unknown')
  })

  it('disables buttons when processing', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
        isProcessing
      />,
    )

    const buttons = screen.getAllByRole('button')
    // All answer buttons should be disabled; the keyboard shortcut toggle is not an answer button
    const answerButtons = buttons.filter((btn) => {
      const label = btn.getAttribute('aria-label') ?? btn.textContent ?? ''
      return ['Yes', 'No', 'Maybe', 'Skip'].some((ans) => label.includes(ans))
    })
    answerButtons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('shows free-text input', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />,
    )
    expect(screen.getByPlaceholderText(/type your answer/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('has aria-live region for question text', () => {
    render(
      <QuestionCard
        question={QUESTION}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />,
    )
    const liveRegion = screen.getByText('Is this character human?').closest('[aria-live]')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })
})

describe('ThinkingCard', () => {
  it('renders thinking indicator elements', () => {
    const { container } = render(<ThinkingCard />)
    // ThinkingCard renders shimmer divs with animate-shimmer class
    const shimmers = container.querySelectorAll('.animate-shimmer')
    expect(shimmers.length).toBeGreaterThan(0)
  })
})
