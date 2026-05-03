// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FreshnessPill } from '../FreshnessPill'

describe('FreshnessPill', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T20:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "Fetch now" when no timestamp exists and triggers refresh', () => {
    const onRefresh = vi.fn()

    render(<FreshnessPill fetchedAt={null} onRefresh={onRefresh} />)

    const button = screen.getByRole('button', { name: /fetch now/i })
    expect(button).toHaveTextContent('Fetch now')

    fireEvent.click(button)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('renders a fresh tone when data age is under 5 minutes', () => {
    const fetchedAt = Date.now() - 2 * 60 * 1000
    render(<FreshnessPill fetchedAt={fetchedAt} onRefresh={() => {}} />)

    const button = screen.getByRole('button', { name: /fetched 2m ago/i })
    expect(button.className).toMatch(/emerald/)
  })

  it('renders warning and critical tones for stale data', () => {
    const warnFetchedAt = Date.now() - 6 * 60 * 1000
    const criticalFetchedAt = Date.now() - 31 * 60 * 1000

    const { rerender } = render(
      <FreshnessPill fetchedAt={warnFetchedAt} onRefresh={() => {}} />,
    )

    expect(screen.getByRole('button', { name: /fetched 6m ago/i }).className).toMatch(/amber/)

    rerender(<FreshnessPill fetchedAt={criticalFetchedAt} onRefresh={() => {}} />)

    expect(screen.getByRole('button', { name: /fetched 31m ago/i }).className).toMatch(/red/)
  })
})
