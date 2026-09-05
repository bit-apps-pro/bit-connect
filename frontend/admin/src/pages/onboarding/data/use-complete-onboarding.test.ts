import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useCompleteOnboarding from './use-complete-onboarding'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const mockRequest = vi.mocked(request)

describe('useCompleteOnboarding', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('POSTs to onboarding-complete', async () => {
    mockRequest.mockResolvedValue({ code: 'SUCCESS', data: {}, status: 'success' })
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper })

    await result.current.completeOnboarding()

    expect(mockRequest).toHaveBeenCalledWith('onboarding-complete', { method: 'POST' })
  })

  it('optimistically sets the onboarding-status cache to completed', async () => {
    mockRequest.mockResolvedValue({ code: 'SUCCESS', data: {}, status: 'success' })
    const { queryClient, wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper })

    await result.current.completeOnboarding()

    await waitFor(() =>
      expect(queryClient.getQueryData(['onboarding-status'])).toEqual({ completed: true })
    )
  })
})
