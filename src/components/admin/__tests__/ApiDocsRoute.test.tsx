// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ApiDocsRoute from '../routes/ApiDocsRoute'

describe('ApiDocsRoute', () => {
  it('renders the embedded OpenAPI docs page via inline iframe document', () => {
    render(
      <MemoryRouter>
        <ApiDocsRoute />
      </MemoryRouter>,
    )

    expect(screen.getByTitle('Guess OpenAPI Docs')).toHaveAttribute(
      'srcdoc',
      expect.stringContaining('/vendor/swagger-ui/swagger-ui-bundle.js'),
    )
  })
})