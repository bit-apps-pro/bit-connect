import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchStatusesApi } from './data/fetch-statuses-api'
import { updatePostStatusApi } from './data/update-post-status-api'
import { useStatusesStore } from './statuses.zustand'

vi.mock('./data/fetch-statuses-api', () => ({ fetchStatusesApi: vi.fn() }))
vi.mock('./data/update-post-status-api', () => ({ updatePostStatusApi: vi.fn() }))

const status = (id: number, slug: string) => ({ id, meta: {}, name: slug, slug })

beforeEach(() => {
  vi.clearAllMocks()
  useStatusesStore.setState({
    error: undefined,
    isLoading: false,
    isUpdatingStatus: false,
    statuses: []
  })
})

describe('loading the statuses', () => {
  it('keeps what the server sent', async () => {
    vi.mocked(fetchStatusesApi).mockResolvedValue([
      status(1, 'need-approval'),
      status(2, 'in-progress')
    ] as never)

    await useStatusesStore.getState().fetchStatuses()

    expect(useStatusesStore.getState().statuses.map(s => s.slug)).toEqual([
      'need-approval',
      'in-progress'
    ])
    expect(useStatusesStore.getState().isLoading).toBe(false)
  })

  it('records the failure and stops loading', async () => {
    vi.mocked(fetchStatusesApi).mockRejectedValue(new Error('Network down'))

    await expect(useStatusesStore.getState().fetchStatuses()).rejects.toThrow('Network down')

    expect(useStatusesStore.getState().error).toBe('Network down')
    expect(useStatusesStore.getState().isLoading).toBe(false)
  })
})

describe('finding a status', () => {
  it('finds one by the term id a topic carries', () => {
    useStatusesStore.setState({ statuses: [status(1, 'open'), status(2, 'closed')] as never })

    expect(useStatusesStore.getState().getStatusByTermId(2)?.slug).toBe('closed')
  })

  it('answers undefined for a status that is no longer there', () => {
    useStatusesStore.setState({ statuses: [status(1, 'open')] as never })

    expect(useStatusesStore.getState().getStatusByTermId(99)).toBeUndefined()
  })
})

describe('changing a topic’s status', () => {
  it('hands back the topic the server saved', async () => {
    vi.mocked(updatePostStatusApi).mockResolvedValue({ ID: 9 } as never)

    await expect(useStatusesStore.getState().updatePostStatus(9, 2)).resolves.toEqual({ ID: 9 })
    expect(useStatusesStore.getState().isUpdatingStatus).toBe(false)
  })

  it('stops reporting itself as busy when the change is refused', async () => {
    vi.mocked(updatePostStatusApi).mockRejectedValue(new Error('Not allowed.'))

    await expect(useStatusesStore.getState().updatePostStatus(9, 2)).rejects.toThrow('Not allowed.')

    expect(useStatusesStore.getState().isUpdatingStatus).toBe(false)
    expect(useStatusesStore.getState().error).toBe('Not allowed.')
  })
})
