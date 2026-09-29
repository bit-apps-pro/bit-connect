import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import Promo from './promo'

const link = () => screen.getByRole('link')

describe('Promo credit', () => {
  afterEach(cleanup)

  it('renders nothing at all when both lines are empty', () => {
    const { container } = render(<Promo />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders only the lines it was given', () => {
    const { container } = render(<Promo headline="Built by Acme" />)

    expect(container.textContent).toBe('Built by Acme')
    expect(container.querySelector('img')).toBeNull()
  })

  it('picks the product name out of the headline', () => {
    render(<Promo eyebrow="a Bit Apps product" headline="Built with Bit Connect" />)

    expect(screen.getByText('Bit Connect')).toHaveClass('bc-text-primary')
    expect(screen.getByText('a Bit Apps product')).toBeInTheDocument()
  })

  it('opens the link in a new tab without handing over the referrer or link equity', () => {
    render(<Promo headline="Built by Acme" url="https://acme.test/plugins" />)

    expect(link()).toHaveAttribute('href', 'https://acme.test/plugins')
    expect(link()).toHaveAttribute('target', '_blank')
    expect(link()).toHaveAttribute('rel', 'noreferrer noopener nofollow')
  })

  it('is plain text rather than a link when no URL was set', () => {
    render(<Promo headline="Built by Acme" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('refuses a link the browser should not follow', () => {
    render(<Promo headline="Built by Acme" url="javascript:alert(1)" />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('names itself by its own lines', () => {
    render(
      <Promo eyebrow="a Bit Apps product" headline="Built with Bit Connect" url="https://acme.test" />
    )

    expect(link()).toHaveAccessibleName(
      'Built with Bit Connect — a Bit Apps product (opens in a new tab)'
    )
  })
})
