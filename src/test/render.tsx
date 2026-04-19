import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'

/** Custom render that wraps components with any needed providers. */
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options })
}

export { customRender as render }
export { screen, within, waitFor, act } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
