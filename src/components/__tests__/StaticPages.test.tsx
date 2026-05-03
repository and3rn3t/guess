// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AboutPage } from '../static/AboutPage'
import { CreditsPage } from '../static/CreditsPage'

describe('Static pages', () => {
  it('renders About page with portfolio links', () => {
    render(<AboutPage />)

    expect(screen.getByRole('heading', { name: /about andernator/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /github repository/i })).toHaveAttribute(
      'href',
      'https://github.com/and3rn3t/guess',
    )
    expect(screen.getByRole('link', { name: /architecture guide/i })).toHaveAttribute(
      'href',
      'https://github.com/and3rn3t/guess/blob/main/ARCHITECTURE.md',
    )
    expect(screen.getByRole('link', { name: /credits and attributions/i })).toHaveAttribute(
      'href',
      '/credits',
    )
  })

  it('renders Credits page with source and license links', () => {
    render(<CreditsPage />)

    expect(screen.getByRole('heading', { name: /^credits$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^tmdb$/i })).toHaveAttribute(
      'href',
      'https://www.themoviedb.org/',
    )
    expect(screen.getByRole('link', { name: /^anilist$/i })).toHaveAttribute(
      'href',
      'https://anilist.co/',
    )
    expect(screen.getByRole('link', { name: /^project license$/i })).toHaveAttribute(
      'href',
      'https://github.com/and3rn3t/guess/blob/main/LICENSE',
    )
    expect(screen.getByRole('link', { name: /about this project/i })).toHaveAttribute('href', '/about')
  })
})
