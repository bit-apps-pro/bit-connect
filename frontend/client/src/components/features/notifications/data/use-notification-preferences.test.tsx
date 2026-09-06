/* eslint-disable translate-obj-prop/translate-obj-prop -- fixtures are wire data, not user-facing copy */
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import get from '@/utils/request/get'
import post from '@/utils/request/post'

import { createQueryWrapper } from '../../../../config/test-query-wrapper'
import {
  PREFERENCES_KEY,
  useNotificationPreferences,
  useSaveNotificationPreferences
} from './use-notification-preferences'

vi.mock('@/utils/request/get', () => ({ default: vi.fn() }))
vi.mock('@/utils/request/post', () => ({ default: vi.fn() }))
vi.mock('@/config/config', () => ({ default: { IS_LOGGED_IN: true } }))

const row = (type: string, overrides: Record<string, unknown> = {}) => ({
  alwaysDelivered: false,
  description: '',
  email: false,
  emailLocked: false,
  inapp: true,
  inappLocked: false,
  label: type,
  type,
  ...overrides
})

const screen = (rows = [row('topic_reply')], frequency = 'instant') => ({
  data: { frequency, types: rows }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// Every value is resolved server-side by the same code the dispatcher uses, so
// the screen cannot disagree with what actually gets sent — a form that
// computes its own answer from stored preferences drifts the moment an admin
// changes a default.
describe('reading the member’s own settings', () => {
  it('asks the server for the resolved screen', async () => {
    vi.mocked(get).mockResolvedValue(screen() as never)
    const { wrapper } = createQueryWrapper()

    renderHook(() => useNotificationPreferences(), { wrapper })

    await waitFor(() => expect(get).toHaveBeenCalledWith('notification-preferences', expect.anything()))
  })

  it('unwraps the screen out of the envelope', async () => {
    vi.mocked(get).mockResolvedValue(screen([row('topic_reply'), row('mention')], 'daily') as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationPreferences(), { wrapper })

    await waitFor(() => expect(result.current.preferences?.types).toHaveLength(2))
    expect(result.current.preferences?.frequency).toBe('daily')
  })

  it('reports a failure rather than an empty screen', async () => {
    vi.mocked(get).mockRejectedValue(new Error('Network down'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationPreferences(), { wrapper })

    await waitFor(() => expect(result.current.isPreferencesError).toBe(true))
    expect(result.current.preferences).toBeUndefined()
  })
})

describe('saving the member’s choices', () => {
  it('sends what was changed', async () => {
    vi.mocked(post).mockResolvedValue(screen() as never)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSaveNotificationPreferences(), { wrapper })

    await result.current.savePreferences({
      frequency: 'weekly',
      types: { topic_reply: { email: true } }
    })

    expect(post).toHaveBeenCalledWith('notification-preferences', {
      body: { frequency: 'weekly', types: { topic_reply: { email: true } } }
    })
  })

  // A row the admin has locked is silently dropped on save, so a client
  // trusting its own optimistic state would go on showing a switch the forum
  // never accepted.
  it('replaces the screen with the one the server answered', async () => {
    const { queryClient, wrapper } = createQueryWrapper()

    queryClient.setQueryData([PREFERENCES_KEY], screen([row('topic_reply', { email: false })]))

    vi.mocked(post).mockResolvedValue(
      screen([row('topic_reply', { email: false, emailLocked: true })]) as never
    )

    const { result } = renderHook(() => useSaveNotificationPreferences(), { wrapper })

    await result.current.savePreferences({ types: { topic_reply: { email: true } } })

    const cached = queryClient.getQueryData([PREFERENCES_KEY]) as ReturnType<typeof screen>

    expect(cached.data.types[0].email).toBe(false)
    expect(cached.data.types[0].emailLocked).toBe(true)
  })

  it('leaves the screen alone when the save is refused', async () => {
    const { queryClient, wrapper } = createQueryWrapper()

    const before = screen()
    queryClient.setQueryData([PREFERENCES_KEY], before)
    vi.mocked(post).mockRejectedValue(new Error('Not allowed.'))

    const { result } = renderHook(() => useSaveNotificationPreferences(), { wrapper })

    await expect(result.current.savePreferences({ frequency: 'never' })).rejects.toThrow()

    expect(queryClient.getQueryData([PREFERENCES_KEY])).toEqual(before)
  })

  it('leaves the screen alone when the answer carries nothing', async () => {
    const { queryClient, wrapper } = createQueryWrapper()

    const before = screen()
    queryClient.setQueryData([PREFERENCES_KEY], before)
    vi.mocked(post).mockResolvedValue({ data: undefined } as never)

    const { result } = renderHook(() => useSaveNotificationPreferences(), { wrapper })

    await result.current.savePreferences({ frequency: 'never' })

    expect(queryClient.getQueryData([PREFERENCES_KEY])).toEqual(before)
  })
})
