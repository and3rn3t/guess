// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminPageHeader } from '../AdminPageHeader'

describe('AdminPageHeader', () => {
  it('sets standardized admin document title format', () => {
    render(
      <MemoryRouter>
        <AdminPageHeader title="Failure Triage" />
      </MemoryRouter>,
    )

    expect(document.title).toBe('Admin \u00b7 Failure Triage \u00b7 Andernator')
  })

  it('renders default breadcrumbs when none are provided', () => {
    render(
      <MemoryRouter>
        <AdminPageHeader title="Error Logs" />
      </MemoryRouter>,
    )

    const nav = screen.getByLabelText(/breadcrumb/i)
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveTextContent('Admin')
    expect(nav).toHaveTextContent('Error Logs')
  })

  it('renders explicit breadcrumbs when provided', () => {
    render(
      <MemoryRouter>
        <AdminPageHeader
          title="Question Retirement Queue"
          breadcrumbs={[{ label: 'Questions', to: '/questions' }, { label: 'Retirement Queue' }]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Questions' })).toHaveAttribute('href', '/questions')
    expect(screen.getByText('Retirement Queue')).toBeInTheDocument()
  })
})
