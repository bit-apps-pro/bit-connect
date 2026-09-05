import { request } from '@common/request'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createQueryWrapper } from '../../../config/test-query-wrapper'
import useSettings from './use-settings'

vi.mock('@common/request', () => ({ request: vi.fn() }))

const stored = (settings: Record<string, unknown>) => ({
  code: 'SUCCESS',
  data: settings,
  status: 'success'
})

beforeEach(() => {
  vi.clearAllMocks()
})

// Every switch on this screen renders straight off `settings`, so a missing key
// has to fall back to the shipped default rather than to `undefined` — which
// reads as "off" in a checkbox and as an empty number field in a spinner.
describe('the settings screen’s values', () => {
  it('reads back what the server stored', async () => {
    vi.mocked(request).mockResolvedValue(
      stored({
        cleanup: { deleteDataOnUninstall: true },
        moderation: { autoHideThreshold: 5 },
        topicAccess: { comment: false, commentUpvote: true, privateTopic: false, upvote: false },
        topicFormFields: { requireDepartment: false, requireTopicType: false }
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSettingsFetching).toBe(false))

    expect(result.current.settings).toEqual({
      cleanup: { deleteDataOnUninstall: true },
      moderation: { autoHideThreshold: 5 },
      topicAccess: { comment: false, commentUpvote: true, privateTopic: false, upvote: false },
      topicFormFields: { requireDepartment: false, requireTopicType: false }
    })
  })

  it('fills in the sections an older install never saved', async () => {
    vi.mocked(request).mockResolvedValue(stored({ topicAccess: { comment: false } }) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSettingsFetching).toBe(false))

    expect(result.current.settings.topicAccess.comment).toBe(false)
    expect(result.current.settings.topicAccess.upvote).toBe(true)
    expect(result.current.settings.moderation.autoHideThreshold).toBe(2)
    expect(result.current.settings.topicFormFields.requireDepartment).toBe(true)
  })

  // `false` is a decision an admin made, not a gap to be filled.
  it('keeps a switch the admin turned off', async () => {
    vi.mocked(request).mockResolvedValue(
      stored({
        topicAccess: { comment: false, commentUpvote: false, privateTopic: false, upvote: false }
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSettingsFetching).toBe(false))

    expect(result.current.settings.topicAccess).toEqual({
      comment: false,
      commentUpvote: false,
      privateTopic: false,
      upvote: false
    })
  })

  // A default of one here would show "hide after 1 report" on a site the server
  // is running at two.
  it('shows the same auto-hide threshold the server defaults to', () => {
    vi.mocked(request).mockReturnValue(
      new Promise(() => {
        /* never settles */
      }) as never
    )
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    expect(result.current.settings.moderation.autoHideThreshold).toBe(2)
  })

  it('falls back to the defaults for a body it cannot read', async () => {
    for (const body of [stored({}), stored({ nonsense: true }), { data: undefined }]) {
      vi.mocked(request).mockResolvedValue(body as never)
      const { wrapper } = createQueryWrapper()

      const { result } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => expect(result.current.isSettingsFetching).toBe(false))

      expect(result.current.settings.topicAccess.comment).toBe(true)
      expect(result.current.settings.cleanup.deleteDataOnUninstall).toBe(false)
    }
  })

  it('still shows the defaults when the request fails outright', async () => {
    vi.mocked(request).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSettingsError).toBe(true))

    expect(result.current.settings.moderation.autoHideThreshold).toBe(2)
  })

  // Uninstall data deletion is destructive and irreversible, so it may only
  // ever be on because somebody switched it on.
  it('never defaults the destructive setting to on', async () => {
    vi.mocked(request).mockResolvedValue(stored({ topicAccess: {} }) as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSettingsFetching).toBe(false))

    expect(result.current.settings.cleanup.deleteDataOnUninstall).toBe(false)
  })
})
