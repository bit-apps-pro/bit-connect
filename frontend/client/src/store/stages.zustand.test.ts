import { wpApi } from '@utils/request/wp-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updatePostStageApi } from './data/update-post-stage-api'
import { useStagesStore } from './stages.zustand'

vi.mock('@utils/request/wp-api', () => ({ wpApi: vi.fn() }))
vi.mock('./data/update-post-stage-api', () => ({ updatePostStageApi: vi.fn() }))

const stage = (id: number, slug: string, order?: number) => ({
  id,
  meta: order === undefined ? {} : { order },
  name: slug,
  slug
})

beforeEach(() => {
  vi.clearAllMocks()
  useStagesStore.setState({ error: undefined, isLoading: false, isUpdatingStage: false, stages: [] })
})

describe('loading the stages', () => {
  // Core's terms endpoint cannot sort by meta, so it answers alphabetically and
  // the admin's arrangement is applied here. Without it the portal's stage rail
  // is in a different order from the Stages screen that set it.
  it('puts them in the order the admin arranged', async () => {
    vi.mocked(wpApi).mockResolvedValue({
      data: [stage(7, 'shipped', 2), stage(3, 'ideas', 0), stage(5, 'planned', 1)]
    } as never)

    await useStagesStore.getState().fetchStages()

    expect(useStagesStore.getState().stages.map(s => s.slug)).toEqual(['ideas', 'planned', 'shipped'])
  })

  it('asks for enough stages that a forum does not lose one to pagination', async () => {
    vi.mocked(wpApi).mockResolvedValue({ data: [] } as never)

    await useStagesStore.getState().fetchStages()

    expect(wpApi).toHaveBeenCalledWith('bit-connect-stages', {
      method: 'GET',
      queryParam: { per_page: 100 }
    })
  })

  it('holds an empty list rather than a broken one when the body is not a list', async () => {
    vi.mocked(wpApi).mockResolvedValue({ data: { message: 'nope' } } as never)

    await useStagesStore.getState().fetchStages()

    expect(useStagesStore.getState().stages).toEqual([])
  })

  it('records the failure and stops loading', async () => {
    vi.mocked(wpApi).mockRejectedValue(new Error('Network down'))

    await expect(useStagesStore.getState().fetchStages()).rejects.toThrow('Network down')

    expect(useStagesStore.getState().error).toBe('Network down')
    expect(useStagesStore.getState().isLoading).toBe(false)
  })

  it('clears a previous failure when asked again', async () => {
    useStagesStore.setState({ error: 'Network down' })
    vi.mocked(wpApi).mockResolvedValue({ data: [] } as never)

    await useStagesStore.getState().fetchStages()

    expect(useStagesStore.getState().error).toBeUndefined()
  })
})

describe('finding a stage', () => {
  it('finds one by the term id a topic carries', () => {
    useStagesStore.setState({ stages: [stage(3, 'ideas'), stage(5, 'planned')] as never })

    expect(useStagesStore.getState().getStageByTermId(5)?.slug).toBe('planned')
  })

  // A topic filed under a stage that has since been deleted still renders; the
  // caller shows no chip rather than crashing on a missing name.
  it('answers undefined for a stage that is no longer there', () => {
    useStagesStore.setState({ stages: [stage(3, 'ideas')] as never })

    expect(useStagesStore.getState().getStageByTermId(99)).toBeUndefined()
  })
})

describe('moving a topic to another stage', () => {
  it('hands back the topic the server saved', async () => {
    vi.mocked(updatePostStageApi).mockResolvedValue({ ID: 9 } as never)

    await expect(useStagesStore.getState().updatePostStage(9, 5)).resolves.toEqual({ ID: 9 })
    expect(useStagesStore.getState().isUpdatingStage).toBe(false)
  })

  // The control is disabled while this is in flight, so it has to be released
  // on a refusal as well as on a success.
  it('stops reporting itself as busy when the move is refused', async () => {
    vi.mocked(updatePostStageApi).mockRejectedValue(new Error('Not allowed.'))

    await expect(useStagesStore.getState().updatePostStage(9, 5)).rejects.toThrow('Not allowed.')

    expect(useStagesStore.getState().isUpdatingStage).toBe(false)
    expect(useStagesStore.getState().error).toBe('Not allowed.')
  })
})
