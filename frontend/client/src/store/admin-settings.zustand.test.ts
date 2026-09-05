import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as adminSettingsApi from './data/admin-settings-api'

import { useAdminSettingsStore } from './admin-settings.zustand'
import {
  defaultSettings,
  fetchAdminSettingsApi,
  updateAdminSettingsApi
} from './data/admin-settings-api'

// Partially mocked: the defaults are real, because what the store falls back
// to before its first fetch is part of what is under test here.
vi.mock('./data/admin-settings-api', async importActual => {
  const actual = await importActual<typeof adminSettingsApi>()

  return {
    defaultSettings: actual.defaultSettings,
    fetchAdminSettingsApi: vi.fn(),
    updateAdminSettingsApi: vi.fn()
  }
})

const settings = {
  topicAccess: { comment: true, commentUpvote: true, privateTopic: false, upvote: true },
  topicFormFields: { requireDepartment: false, requireTopicType: false }
}

beforeEach(() => {
  vi.clearAllMocks()
  useAdminSettingsStore.setState({
    error: undefined,
    isLoading: false,
    isUpdating: false,
    settings: defaultSettings
  })
})

describe('the portal settings store', () => {
  // Until the first fetch answers, every gate in the portal reads off these,
  // so they have to be the shipped defaults rather than an empty object.
  it('starts on the shipped defaults', () => {
    expect(useAdminSettingsStore.getState().settings).toEqual(defaultSettings)
  })

  it('adopts what the server sent', async () => {
    vi.mocked(fetchAdminSettingsApi).mockResolvedValue(settings)

    await useAdminSettingsStore.getState().fetchSettings()

    expect(useAdminSettingsStore.getState().settings).toEqual(settings)
    expect(useAdminSettingsStore.getState().isLoading).toBe(false)
  })

  // Keeping the last known settings is better than dropping to defaults: a
  // failed refresh must not silently re-enable something an admin turned off.
  it('keeps the settings it already had when a refresh fails', async () => {
    useAdminSettingsStore.setState({ settings })
    vi.mocked(fetchAdminSettingsApi).mockRejectedValue(new Error('Network down'))

    await expect(useAdminSettingsStore.getState().fetchSettings()).rejects.toThrow('Network down')

    expect(useAdminSettingsStore.getState().settings).toEqual(settings)
    expect(useAdminSettingsStore.getState().error).toBe('Network down')
    expect(useAdminSettingsStore.getState().isLoading).toBe(false)
  })

  it('holds what the save came back with rather than what was sent', async () => {
    const stored = { ...settings, topicAccess: { ...settings.topicAccess, comment: false } }

    vi.mocked(updateAdminSettingsApi).mockResolvedValue(stored)

    await useAdminSettingsStore.getState().updateSettings(settings)

    expect(useAdminSettingsStore.getState().settings).toEqual(stored)
    expect(useAdminSettingsStore.getState().isUpdating).toBe(false)
  })

  it('leaves the settings alone when the save is refused', async () => {
    useAdminSettingsStore.setState({ settings })
    vi.mocked(updateAdminSettingsApi).mockRejectedValue(new Error('Not allowed.'))

    await expect(useAdminSettingsStore.getState().updateSettings(defaultSettings)).rejects.toThrow(
      'Not allowed.'
    )

    expect(useAdminSettingsStore.getState().settings).toEqual(settings)
    expect(useAdminSettingsStore.getState().isUpdating).toBe(false)
  })
})
