// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RouteErrorBoundary } from '../RouteErrorBoundary'

// Silence the React error log emitted when a child throws.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom: route blew up')
  return <div>route content</div>
}

describe('RouteErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Boom shouldThrow={false} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText('route content')).toBeInTheDocument()
  })

  it('renders the fallback (with Retry + Copy) when a child throws', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Boom shouldThrow={true} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText(/this route failed to render/i)).toBeInTheDocument()
    expect(screen.getByText(/kaboom: route blew up/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy error/i })).toBeInTheDocument()
  })

  it('Retry resets the boundary and re-mounts the child', async () => {
    let throws = true
    function Child() {
      return <Boom shouldThrow={throws} />
    }

    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Child />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )

    // Initially errored.
    expect(screen.getByText(/this route failed to render/i)).toBeInTheDocument()

    // Stop throwing, click Retry → child re-mounts cleanly.
    throws = false
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(screen.getByText('route content')).toBeInTheDocument()
  })

  it('Copy writes the error message to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Boom shouldThrow={true} />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /copy error/i }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('kaboom: route blew up')
  })
})
