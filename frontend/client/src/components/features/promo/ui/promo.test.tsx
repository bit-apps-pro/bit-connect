import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Promo from './promo'

const link = () => screen.getByRole('link')

describe('Promo card', () => {
  afterEach(cleanup)

  it('renders nothing at all when every field is empty', () => {
    const { container } = render(<Promo />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders only the rows it was given', () => {
    const { container } = render(<Promo headline="Built by Acme" />)

    expect(screen.getByText('Built by Acme')).toBeInTheDocument()
    // No lead-in, no link label, no wording of its own anywhere.
    expect(container.textContent).toBe('Built by Acme')
  })

  it('shows the admin top line, lead-in and link label', () => {
    render(
      <Promo
        cta="See our work"
        eyebrow="An Acme product"
        headline="Built by Acme"
        prefix="We also build"
        url="https://acme.test/plugins"
      />
    )

    expect(screen.getByText('An Acme product')).toBeInTheDocument()
    expect(screen.getByText('Built by Acme')).toBeInTheDocument()
    expect(screen.getByText(/We also build/)).toBeInTheDocument()
    expect(screen.getByText('See our work')).toBeInTheDocument()
  })

  it('opens the admin link in a new tab without handing over the referrer or link equity', () => {
    render(<Promo headline="Built by Acme" url="https://acme.test/plugins" />)

    expect(link()).toHaveAttribute('href', 'https://acme.test/plugins')
    expect(link()).toHaveAttribute('target', '_blank')
    expect(link()).toHaveAttribute('rel', 'noreferrer noopener nofollow')
  })

  it('is plain text rather than a link when no URL was set', () => {
    render(<Promo headline="Built by Acme" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Built by Acme')).toBeInTheDocument()
  })

  it('refuses a link the browser should not follow', () => {
    render(<Promo headline="Built by Acme" url="javascript:alert(1)" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('types the admin phrases after the lead-in', () => {
    vi.useFakeTimers()
    const { container } = render(<Promo phrases={['our other plugins']} prefix="We also build" />)

    // A tick per character, each flushed on its own: it is the flush of one
    // tick's state that lets the hook schedule the next.
    for (let typed = 0; typed < 3; typed += 1) {
      act(() => void vi.advanceTimersByTime(65))
    }

    expect(screen.getByText('our', { exact: true })).toBeInTheDocument()
    expect(container.textContent).toBe('We also build our')
    vi.useRealTimers()
  })

  it('names itself by its own rows, and hides the typed row from the a11y tree', () => {
    render(
      <Promo
        cta="See our work"
        eyebrow="An Acme product"
        headline="Built by Acme"
        prefix="We also build"
        url="https://acme.test"
      />
    )

    expect(link()).toHaveAccessibleName(
      'Built by Acme — An Acme product — See our work (opens in a new tab)'
    )
    // The typed row mutates every 65ms; announcing it would make an advert
    // behave like a live region.
    expect(screen.getByText(/We also build/)).toHaveAttribute('aria-hidden')
  })
})
