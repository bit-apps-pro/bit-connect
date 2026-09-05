import { request } from '@common/request'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import StepPortalSettings from './step-portal-settings'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const mockRequest = vi.mocked(request)

function ok<T>(data: T) {
  return { code: 'SUCCESS', data, status: 'success' }
}

function mockSlugCheck(exists: boolean) {
  mockRequest.mockImplementation(((url: string) => {
    if (url.startsWith('portal-page/check')) {
      const slug = decodeURIComponent(url.split('slug=')[1] ?? '')
      return Promise.resolve(
        ok({ exists, hasShortcode: false, isPortal: false, slug, url: `https://x/${slug}/` })
      )
    }
    return Promise.resolve(ok({ slug: 'x', url: 'https://x/x/' }))
  }) as typeof request)
}

function renderStep(onNext = vi.fn()) {
  const { wrapper: Wrapper } = createQueryWrapper()

  render(
    <Wrapper>
      <StepPortalSettings onNext={onNext} />
    </Wrapper>
  )

  return onNext
}

describe('StepPortalSettings', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts at /portal and warns when a page is already there', async () => {
    mockSlugCheck(true)
    renderStep()

    expect(screen.getByPlaceholderText('e.g. community')).toHaveValue('portal')
    await waitFor(() =>
      expect(screen.getByText(/A page already exists at https:\/\/x\/portal\//)).toBeVisible()
    )
    expect(screen.getByRole('button', { name: 'Create page and continue' })).toBeDisabled()
  })

  it('goes green on a free slug and creates the page on continue', async () => {
    mockSlugCheck(false)
    const user = userEvent.setup()
    const onNext = renderStep()

    const input = screen.getByPlaceholderText('e.g. community')
    await user.clear(input)
    await user.type(input, 'community')

    await waitFor(() => expect(screen.getByText(/is available\./)).toBeVisible())
    const next = screen.getByRole('button', { name: 'Create page and continue' })
    await waitFor(() => expect(next).toBeEnabled())
    await user.click(next)

    await waitFor(() => expect(onNext).toHaveBeenCalled())
    expect(mockRequest).toHaveBeenCalledWith(
      'portal-page',
      expect.objectContaining({ body: { slug: 'community' }, method: 'POST' })
    )
    expect(mockRequest).not.toHaveBeenCalledWith('portal-page/root', expect.anything())
  })

  it('turns root mode on after creating the page', async () => {
    mockSlugCheck(false)
    const user = userEvent.setup()
    const onNext = renderStep()

    await user.click(screen.getByText('As the homepage'))
    const next = screen.getByRole('button', { name: 'Create page and continue' })
    await waitFor(() => expect(next).toBeEnabled())
    await user.click(next)

    await waitFor(() => expect(onNext).toHaveBeenCalled())
    const calls = mockRequest.mock.calls
      .map(call => call[0])
      .filter(u => !u.startsWith('portal-page/check'))
    expect(calls).toEqual(['portal-page', 'portal-page/root'])
  })

  it('can be skipped for the shortcode route', async () => {
    mockSlugCheck(false)
    const user = userEvent.setup()
    const onNext = renderStep()

    await user.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onNext).toHaveBeenCalled()
    expect(mockRequest).not.toHaveBeenCalledWith('portal-page', expect.anything())
  })
})
