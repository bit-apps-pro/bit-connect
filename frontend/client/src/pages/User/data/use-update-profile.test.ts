import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '@/config/test-query-wrapper'

const queryRequest = vi.fn()
vi.mock('@common/helpers/request', () => ({
  default: queryRequest,
  extractUploadError: String,
  uploadRequest: vi.fn()
}))

const checkAuth = vi.fn()
vi.mock('@/store/auth.zustand', () => ({
  useAuthStore: () => ({ checkAuth })
}))

const setFields = vi.fn()
const form = { setFields } as never

const { default: useUpdateProfile } = await import('./use-update-profile')

const payload = {
  bio: 'Builds things.',
  display_name: 'Aiden Carter',
  links: { github: 'https://github.com/aiden' },
  slug: 'aiden-carter'
}

describe('useUpdateProfile', () => {
  beforeEach(() => {
    queryRequest.mockReset()
    checkAuth.mockReset()
    setFields.mockReset()
  })

  it('posts every field to the member own profile endpoint', async () => {
    queryRequest.mockResolvedValue({ code: 'SUCCESS', data: { user: {} }, status: 'success' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUpdateProfile(form, 7), { wrapper })
    await result.current.updateProfile(payload)

    expect(queryRequest).toHaveBeenCalledWith('users/7/profile', payload)
  })

  it('invalidates the profile query by prefix, not by numeric id', async () => {
    // The profile query is keyed by the URL slug, so ['user-profile', 7] would
    // never match the cached ['user-profile', 'aiden-carter'].
    queryRequest.mockResolvedValue({ code: 'SUCCESS', data: { user: {} }, status: 'success' })
    const { queryClient, wrapper } = createQueryWrapper()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateProfile(form, 7), { wrapper })
    await result.current.updateProfile(payload)

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-profile'] })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['user-content'] })
  })

  it('refreshes the auth store so the header stops showing the old name', async () => {
    queryRequest.mockResolvedValue({ code: 'SUCCESS', data: { user: {} }, status: 'success' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUpdateProfile(form, 7), { wrapper })
    await result.current.updateProfile(payload)

    await waitFor(() => expect(checkAuth).toHaveBeenCalled())
  })

  it('maps a server validation failure onto the matching form fields', async () => {
    queryRequest.mockRejectedValue({
      code: 'VALIDATION',
      data: { slug: ['That profile URL is already taken.'] },
      status: 'error'
    })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUpdateProfile(form, 7), { wrapper })
    await expect(result.current.updateProfile(payload)).rejects.toBeTruthy()

    expect(setFields).toHaveBeenCalledWith([
      { errors: ['That profile URL is already taken.'], name: 'slug' }
    ])
  })

  it('leaves the form alone when the failure is not a validation one', async () => {
    queryRequest.mockRejectedValue({ code: 'ERROR', data: 'Server exploded', status: 'error' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUpdateProfile(form, 7), { wrapper })
    await expect(result.current.updateProfile(payload)).rejects.toBeTruthy()

    expect(setFields).not.toHaveBeenCalled()
  })
})
