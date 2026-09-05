import { describe, expect, it } from 'vitest'

import { type ActiveTopic, resolveActiveStage } from './use-active-stage'

const DEFAULT_STAGE = 'questions'

const resolve = (pathname: string, options: { stageParam?: string; topic?: ActiveTopic } = {}) =>
  resolveActiveStage({ defaultStage: DEFAULT_STAGE, pathname, ...options })

const publishTopic = { post_name: 'qa-test-topic', stage: 'publish' }

describe('resolveActiveStage', () => {
  it('marks the stage the listing is filtered to', () => {
    expect(resolve('/', { stageParam: 'publish' })).toBe('publish')
  })

  it('falls back to the default stage on a listing that names none', () => {
    expect(resolve('/')).toBe(DEFAULT_STAGE)
    expect(resolve('/page/2')).toBe(DEFAULT_STAGE)
  })

  // The regression: reading a topic used to throw the highlight onto the
  // default stage, because a topic URL carries no `?stage=`.
  it('keeps the topic’s own stage marked on a topic URL', () => {
    expect(resolve('/qa-test-topic', { topic: publishTopic })).toBe('publish')
  })

  it('marks nothing until the topic under this URL has loaded', () => {
    expect(resolve('/qa-test-topic')).toBeUndefined()
    // The store still holds the previously read topic.
    expect(resolve('/another-topic', { topic: publishTopic })).toBeUndefined()
  })

  it('matches the loaded topic through an encoded slug', () => {
    const emoji = { post_name: 'hello-%f0%9f%94%a5-world', stage: 'on-development' }
    expect(resolve('/hello-🔥-world', { topic: emoji })).toBe('on-development')
  })

  it('marks nothing for a topic that is in no stage', () => {
    expect(resolve('/qa-test-topic', { topic: { post_name: 'qa-test-topic' } })).toBeUndefined()
  })

  it('marks the stage a stage archive names in its path', () => {
    expect(resolve('/stage/publish')).toBe('publish')
  })

  it('leaves the default stage marked on the pages that are not stages', () => {
    expect(resolve('/tag/api')).toBe(DEFAULT_STAGE)
    expect(resolve('/user/someone')).toBe(DEFAULT_STAGE)
  })

  it('prefers an explicit stage filter over the archive path', () => {
    expect(resolve('/tag/api', { stageParam: 'publish' })).toBe('publish')
  })
})
