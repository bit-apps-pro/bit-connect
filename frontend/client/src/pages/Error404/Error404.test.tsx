import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()

vi.mock('react-router', () => ({ useNavigate: () => navigate }))

const { default: Error404 } = await import('./Error404')

/**
 * The portal's not-found screen used to be unreachable in practice: it redirected
 * away the moment it mounted, and both of its exits pointed at a hard-coded
 * "/portal" — which the router basename turned into /portal/portal, and which
 * was simply wrong for any other slug or at the site root.
 */
describe('Error404', () => {
  beforeEach(() => navigate.mockClear())
  afterEach(cleanup)

  it('shows the not-found message instead of navigating away on mount', () => {
    render(<Error404 />)

    expect(screen.getByText('We can’t find that page')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sends the visitor to the portal root, letting the basename supply its location', async () => {
    render(<Error404 />)

    await userEvent.click(screen.getByRole('button', { name: /back to the community/i }))

    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('offers a way back to wherever the visitor came from', async () => {
    render(<Error404 />)

    await userEvent.click(screen.getByRole('button', { name: /go back/i }))

    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('names the status so the screen is self-explanatory out of context', () => {
    render(<Error404 />)

    expect(screen.getByText('404')).toBeTruthy()
  })
})
