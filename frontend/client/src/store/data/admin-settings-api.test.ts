import getRequest from '@utils/request/get'
import postRequest from '@utils/request/post'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultSettings, fetchAdminSettingsApi, updateAdminSettingsApi } from './admin-settings-api'

vi.mock('@utils/request/get', () => ({ default: vi.fn() }))
vi.mock('@utils/request/post', () => ({ default: vi.fn() }))

// These booleans gate whether a member can comment, upvote a topic or upvote a
// reply. A missing field must fall back to the shipped default rather than to
// `undefined`, which reads as "off" everywhere it is used — an install that has
// never opened the screen would silently lose the controls it always had.
beforeEach(() => {
  vi.clearAllMocks()
})

describe('reading the portal settings', () => {
  it('reads back what the server sent', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: {
        topicAccess: { comment: true, upvote: true },
        topicFormFields: { department: 'hidden', topicType: 'optional' } as const
      }
    } as never)

    await expect(fetchAdminSettingsApi()).resolves.toEqual({
      topicAccess: { comment: true, upvote: true },
      topicFormFields: { department: 'hidden', topicType: 'optional' } as const
    })
  })

  it('fills in the fields the server left out', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { topicAccess: { comment: true } }
    } as never)

    await expect(fetchAdminSettingsApi()).resolves.toEqual({
      topicAccess: {
        comment: true,
        upvote: defaultSettings.topicAccess.upvote
      },
      topicFormFields: defaultSettings.topicFormFields
    })
  })

  // `hidden` is a setting an admin chose, not a gap to be filled.
  it('keeps a field the admin hid', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { topicFormFields: { department: 'hidden', topicType: 'optional' } }
    } as never)

    const settings = await fetchAdminSettingsApi()

    expect(settings.topicFormFields).toEqual({ department: 'hidden', topicType: 'optional' })
  })

  it('reads a mode it does not know as the default', async () => {
    vi.mocked(getRequest).mockResolvedValue({
      data: { topicFormFields: { department: 'sometimes', topicType: true } }
    } as never)

    const settings = await fetchAdminSettingsApi()

    expect(settings.topicFormFields).toEqual(defaultSettings.topicFormFields)
  })

  it('falls back to the defaults for a body it cannot read', async () => {
    // eslint-disable-next-line unicorn/no-null -- a JSON body legitimately carries null
    for (const data of [undefined, null, 'corrupted', 42]) {
      vi.mocked(getRequest).mockResolvedValue({ data } as never)

      await expect(fetchAdminSettingsApi()).resolves.toEqual(defaultSettings)
    }
  })

  it('asks the settings endpoint', async () => {
    vi.mocked(getRequest).mockResolvedValue({ data: {} } as never)

    await fetchAdminSettingsApi()

    expect(getRequest).toHaveBeenCalledWith('settings')
  })
})

describe('writing the portal settings', () => {
  it('sends the settings and reads back what was stored', async () => {
    const settings = {
      topicAccess: { comment: true, upvote: true },
      topicFormFields: { department: 'required', topicType: 'hidden' } as const
    }

    vi.mocked(postRequest).mockResolvedValue({ data: settings } as never)

    await expect(updateAdminSettingsApi(settings)).resolves.toEqual(settings)
    expect(postRequest).toHaveBeenCalledWith('settings/update', { body: settings })
  })

  // What the screen renders after a save is the server's answer, so it goes
  // through the same filling-in as a read.
  it('fills in whatever the save response left out', async () => {
    vi.mocked(postRequest).mockResolvedValue({ data: { topicAccess: { upvote: true } } } as never)

    const stored = await updateAdminSettingsApi(defaultSettings)

    expect(stored.topicAccess.upvote).toBe(true)
    expect(stored.topicFormFields).toEqual(defaultSettings.topicFormFields)
  })
})
