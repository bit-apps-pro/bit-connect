import { describe, expect, it } from 'vitest'

import { resolveActiveStage } from './use-active-stage'

const DEFAULT_STAGE = 'questions'

const resolve = (
  pathname: string,
  options: { spansAllStages?: boolean; stageParam?: string } = {}
) => resolveActiveStage({ defaultStage: DEFAULT_STAGE, pathname, ...options })

describe('resolveActiveStage', () => {
  it('marks the stage the listing is filtered to', () => {
    expect(resolve('/', { stageParam: 'publish' })).toBe('publish')
  })

  it('falls back to the default stage on a listing that names none', () => {
    expect(resolve('/')).toBe(DEFAULT_STAGE)
    expect(resolve('/page/2')).toBe(DEFAULT_STAGE)
  })

  it('marks the stage a stage archive names in its path', () => {
    expect(resolve('/stage/publish')).toBe('publish')
  })

  // What the sidebar actually links to. The server redirects these to the
  // site's permalink form, so the trailing-slash spelling is the one the hook
  // is handed in production — matching only the bare form would leave the nav
  // unmarked on every stage the reader clicked.
  it('marks the stage the sidebar linked, with or without a trailing slash', () => {
    expect(resolve('/stage/planned')).toBe('planned')
    expect(resolve('/stage/planned/')).toBe('planned')
    expect(resolve('/stage/in-progress/')).toBe('in-progress')
  })

  // The default stage's nav item points at the portal root rather than at
  // `/stage/questions`, which 301s back here — so the root has to mark it.
  it('marks the default stage on the root the sidebar links it to', () => {
    expect(resolve('/')).toBe(DEFAULT_STAGE)
  })

  // The archive pins its filter from the path, so the list really is that one
  // stage even though the page is also running a search across the forum.
  it('keeps a stage archive marked while it is also searching', () => {
    expect(resolve('/stage/planned', { spansAllStages: true })).toBe('planned')
  })

  // -------------------------------------------------------------------------
  // Only a stage listing marks a stage. The sidebar says which listing you are
  // in, and none of the routes below is one.
  // -------------------------------------------------------------------------

  it('marks nothing on a topic', () => {
    expect(resolve('/qa-test-topic')).toBeUndefined()
    // Including a topic whose own stage is perfectly well known: the reader may
    // have arrived from a search, a tag, or a link from outside the portal, so
    // its stage is not the listing they are in.
    expect(resolve('/slack-notifications-for-new-topics')).toBeUndefined()
  })

  it('marks nothing on the pages that are not listings', () => {
    expect(resolve('/user/someone')).toBeUndefined()
    expect(resolve('/notifications')).toBeUndefined()
  })

  // A tag or type archive lists that term across every stage, so no stage is
  // the one the reader is in.
  it('marks nothing on a term archive that is not a stage', () => {
    expect(resolve('/tag/api')).toBeUndefined()
    expect(resolve('/topic/question')).toBeUndefined()
  })

  it('marks nothing while the listing is searching or filtering by tag', () => {
    expect(resolve('/', { spansAllStages: true })).toBeUndefined()
    expect(resolve('/page/2', { spansAllStages: true })).toBeUndefined()
  })

  it('prefers an explicit stage filter over a search', () => {
    expect(resolve('/', { spansAllStages: true, stageParam: 'publish' })).toBe('publish')
  })

  it('prefers an explicit stage filter over the archive path', () => {
    expect(resolve('/tag/api', { stageParam: 'publish' })).toBe('publish')
  })
})
