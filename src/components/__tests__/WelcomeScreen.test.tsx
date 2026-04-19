// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeScreen } from '../WelcomeScreen'
import type { Character, CharacterCategory, Difficulty, GameHistoryEntry } from '@/lib/types'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _, animate: _a, exit: _e, transition: _t, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => {
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

vi.mock('@phosphor-icons/react', () => {
  const Icon = () => <span />
  return {
    BrainIcon: Icon, ChartBarIcon: Icon, ClipboardTextIcon: Icon, CloudCheckIcon: Icon,
    FlaskIcon: Icon, GearIcon: Icon, LightningIcon: Icon, PlayIcon: Icon, SparkleIcon: Icon,
    TreeStructureIcon: Icon, WifiSlashIcon: Icon, WrenchIcon: Icon,
  }
})

const CHARS: Character[] = [
  { id: 'mario', name: 'Mario', category: 'video-games', attributes: { isHuman: true } },
  { id: 'link', name: 'Link', category: 'video-games', attributes: { isHuman: true } },
]

const defaultProps = () => ({
  startGame: vi.fn(),
  difficulty: 'medium' as Difficulty,
  setDifficulty: vi.fn(),
  selectedCategories: new Set<CharacterCategory>(),
  toggleCategory: vi.fn(),
  activeCharacters: CHARS,
  llmMode: false,
  setLlmMode: vi.fn(),
  serverMode: false,
  setServerMode: vi.fn(),
  serverTotal: null,
  online: true,
  maxQuestions: 20,
  gameHistory: null,
  hasSavedSession: false,
  resumeSession: vi.fn(),
  clearSession: vi.fn(),
  showDevTools: false,
  navigate: vi.fn(),
  characters: CHARS,
})

describe('WelcomeScreen', () => {
  it('renders hero section', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByText('Think of a Character')).toBeInTheDocument()
  })

  it('shows Start Game button for new players', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    const buttons = screen.getAllByRole('button', { name: /start game/i })
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('calls startGame on CTA click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    const buttons = screen.getAllByRole('button', { name: /start game/i })
    await user.click(buttons[0])
    expect(props.startGame).toHaveBeenCalledOnce()
  })

  it('shows Quick Play for returning players', () => {
    const history: GameHistoryEntry[] = [{
      id: '1',
      date: new Date().toISOString(),
      characterId: 'mario',
      characterName: 'Mario',
      won: true,
      steps: [{ questionId: 'q1', questionText: 'Q1', answer: 'yes' }],
      difficulty: 'medium',
      totalCharacters: 100,
    }]
    render(<WelcomeScreen {...defaultProps()} gameHistory={history} />)
    expect(screen.getByRole('button', { name: /quick play/i })).toBeInTheDocument()
  })

  it('shows resume banner when saved session exists', () => {
    render(<WelcomeScreen {...defaultProps()} hasSavedSession />)
    expect(screen.getByText(/resume your game/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })

  it('calls resumeSession on Resume click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} hasSavedSession />)
    await user.click(screen.getByRole('button', { name: /resume/i }))
    expect(props.resumeSession).toHaveBeenCalledOnce()
  })

  it('calls clearSession on Dismiss click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} hasSavedSession />)
    await user.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(props.clearSession).toHaveBeenCalledOnce()
  })

  it('renders difficulty selector', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByText('Difficulty')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
  })

  it('calls setDifficulty when clicking a difficulty', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    await user.click(screen.getByText('Hard'))
    expect(props.setDifficulty).toHaveBeenCalledWith('hard')
  })

  it('renders category buttons', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByText('Categories')).toBeInTheDocument()
  })

  it('calls toggleCategory on category click', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    // Find a category button (e.g., "Video Games")
    const catButton = screen.getByText('Video Games')
    await user.click(catButton)
    expect(props.toggleCategory).toHaveBeenCalledWith('video-games')
  })

  it('shows AI-Enhanced mode toggle', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    expect(screen.getByRole('switch', { name: /ai-enhanced/i })).toBeInTheDocument()
  })

  it('toggles LLM mode', async () => {
    const user = userEvent.setup()
    const props = defaultProps()
    render(<WelcomeScreen {...props} />)
    await user.click(screen.getByRole('switch', { name: /ai-enhanced/i }))
    expect(props.setLlmMode).toHaveBeenCalledWith(true)
  })

  it('shows active character count', () => {
    render(<WelcomeScreen {...defaultProps()} />)
    const matches = screen.getAllByText(/2 characters/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
