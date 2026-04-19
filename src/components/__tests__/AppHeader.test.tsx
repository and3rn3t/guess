// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppHeader } from '../AppHeader'
import type { GameAction, GamePhase } from '@/hooks/useGameState'
import type { SyncStatus } from '@/lib/sync'

vi.mock('@phosphor-icons/react', () => {
  const Icon = ({ children }: React.PropsWithChildren) => <span>{children}</span>
  return {
    ArrowLeftIcon: Icon, CloudArrowUpIcon: Icon, CloudCheckIcon: Icon,
    CloudSlashIcon: Icon, CloudXIcon: Icon, ClockCounterClockwiseIcon: Icon,
    ChartBarIcon: Icon, HouseIcon: Icon, MoonIcon: Icon,
    SpeakerHighIcon: Icon, SpeakerSlashIcon: Icon, SparkleIcon: Icon,
    SunIcon: Icon, UsersIcon: Icon, WrenchIcon: Icon,
  }
})

vi.mock('@/lib/analytics', () => ({
  trackNavigation: vi.fn(),
}))

const baseProps = () => ({
  gamePhase: 'welcome' as GamePhase,
  navigate: vi.fn(),
  dispatch: vi.fn<(action: GameAction) => void>(),
  answers: [],
  currentQuestion: null,
  maxQuestions: 20,
  syncStatus: 'synced' as SyncStatus,
  muted: false,
  toggleMute: vi.fn(),
  theme: 'dark' as string | undefined,
  toggleTheme: vi.fn(),
  setShowQuitDialog: vi.fn(),
})

describe('AppHeader', () => {
  it('renders app name', () => {
    render(<AppHeader {...baseProps()} />)
    expect(screen.getByText('Mystic Guesser')).toBeInTheDocument()
  })

  it('shows mute toggle button', () => {
    render(<AppHeader {...baseProps()} />)
    // Sound toggle button should exist
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('calls toggleMute on sound button click', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<AppHeader {...props} />)
    const muteBtn = screen.getByRole('button', { name: /mute sounds/i })
    await user.click(muteBtn)
    expect(props.toggleMute).toHaveBeenCalledOnce()
  })

  it('calls toggleTheme on theme button click', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<AppHeader {...props} />)
    const themeBtn = screen.getByRole('button', { name: /switch to light mode/i })
    await user.click(themeBtn)
    expect(props.toggleTheme).toHaveBeenCalledOnce()
  })

  it('shows nav buttons in welcome phase', () => {
    render(<AppHeader {...baseProps()} gamePhase="welcome" />)
    expect(screen.getByText('Statistics')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('shows quit button during playing phase', () => {
    render(
      <AppHeader
        {...baseProps()}
        gamePhase="playing"
        currentQuestion={{ id: 'q1', text: 'Q', attribute: 'isHuman' }}
        answers={[{ questionId: 'q1', value: 'yes' }]}
      />,
    )
    expect(screen.getByRole('button', { name: /quit/i })).toBeInTheDocument()
  })

  it('shows home button in gameOver phase', () => {
    render(<AppHeader {...baseProps()} gamePhase="gameOver" />)
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument()
  })
})
