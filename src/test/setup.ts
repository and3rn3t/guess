import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

const shouldUseMsw = typeof window !== 'undefined'

beforeAll(() => {
  if (!shouldUseMsw) return
  server.listen({ onUnhandledRequest: 'bypass' })
})

// Automatic cleanup after each test
afterEach(() => {
  if (shouldUseMsw) {
    server.resetHandlers()
  }
  cleanup()
})

afterAll(() => {
  if (!shouldUseMsw) return
  server.close()
})
