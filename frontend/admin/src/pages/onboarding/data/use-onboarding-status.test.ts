import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useOnboardingStatus from './use-onboarding-status'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const mockRequest = vi.mocked(request)

describe('useOnboardingStatus', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('requests the onboarding-status endpoint', async () => {
    mockRequest.mockResolvedValue({
      code: 'SUCCESS',
      data: { completed: true },
      status: 'success'
    })
    const { wrapper } = createQueryWrapper()

    renderHook(() => useOnboardingStatus(), { wrapper })

    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        'onboarding-status',
        expect.objectContaining({ method: 'GET' })
      )
    )
  })

  it('exposes completed=false once the response resolves', async () => {
    mockRequest.mockResolvedValue({
      code: 'SUCCESS',
      data: { completed: false },
      status: 'success'
    })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useOnboardingStatus(), { wrapper })

    await waitFor(() => expect(result.current.isOnboardingStatusPending).toBe(false))
    expect(result.current.isOnboardingCompleted).toBe(false)
  })
})
