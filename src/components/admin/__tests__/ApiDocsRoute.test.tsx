// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { swaggerUiBundleMock } = vi.hoisted(() => ({
  swaggerUiBundleMock: vi.fn(() => ({ destroy: vi.fn() })),
}))

vi.mock('swagger-ui-dist', () => ({
  SwaggerUIBundle: swaggerUiBundleMock,
}))

import ApiDocsRoute from '../routes/ApiDocsRoute'

afterEach(() => {
  vi.restoreAllMocks()
  swaggerUiBundleMock.mockClear()
})

describe('ApiDocsRoute', () => {
  it('renders Swagger UI inline from the local OpenAPI spec', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ openapi: '3.1.0', info: { title: 'Guess API', version: '1.0.0' }, paths: {} }),
      })),
    )

    render(
      <MemoryRouter>
        <ApiDocsRoute />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(swaggerUiBundleMock).toHaveBeenCalledTimes(1)
    })

    expect(swaggerUiBundleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deepLinking: true,
        displayRequestDuration: true,
        spec: expect.objectContaining({ openapi: '3.1.0' }),
        domNode: expect.any(HTMLDivElement),
      }),
    )
    expect(screen.queryByTitle('Guess OpenAPI Docs')).not.toBeInTheDocument()
    expect(screen.queryByText(/Unable to render the OpenAPI docs/i)).not.toBeInTheDocument()
  })
})