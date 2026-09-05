import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useUpdatePortalSlug from './use-update-portal-slug'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const mockRequest = vi.mocked(request)

describe('useUpdatePortalSlug', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('POSTs the slug to the portal-page/slug endpoint', async () => {
    mockRequest.mockResolvedValue({
      code: 'SUCCESS',
      data: { slug: 'new-slug', url: 'https://x/new-slug' },
      status: 'success'
    })
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUpdatePortalSlug(), { wrapper })

    await result.current.updatePortalSlug('new-slug')

    expect(mockRequest).toHaveBeenCalledWith('portal-page/slug', {
      body: { slug: 'new-slug' },
      method: 'POST'
    })
  })

  it('invalidates the portal-page query on success', async () => {
    mockRequest.mockResolvedValue({ code: 'SUCCESS', data: {}, status: 'success' })
    const { queryClient, wrapper } = createQueryWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdatePortalSlug(), { wrapper })
    await result.current.updatePortalSlug('another-slug')

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['portal-page'] }))
  })
})
