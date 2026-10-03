import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useAutoSave from './use-auto-save'

interface Value {
  title: string
}

/** The hook as a screen uses it: a draft in state, the server's value passed in. */
function useHarness(
  saved: undefined | Value,
  save: (value: Value) => Promise<unknown>,
  options: { delay?: 'manual' | number; validate?: (value: Value) => string | undefined } = {}
) {
  const [draft, setDraft] = useState<Value>()
  const autoSave = useAutoSave({ draft, save, saved, setDraft, ...options })
  return { ...autoSave, draft, setDraft }
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('adopts the saved value without saving it back', () => {
    const save = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.draft).toEqual({ title: 'Forum' })
    expect(result.current.status).toBe('idle')
    expect(save).not.toHaveBeenCalled()
  })

  it('saves a burst of changes once, after the pause', async () => {
    const save = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'F' }))
    act(() => result.current.setDraft({ title: 'Fo' }))
    act(() => result.current.setDraft({ title: 'Foo' }))
    expect(result.current.status).toBe('pending')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ title: 'Foo' })
    expect(result.current.status).toBe('saved')
  })

  it('keeps an edit when a refetch of the previous save arrives', async () => {
    const save = vi.fn().mockResolvedValue({})
    let saved: Value = { title: 'Forum' }
    const { rerender, result } = renderHook(() => useHarness(saved, save))

    act(() => result.current.setDraft({ title: 'One' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    act(() => result.current.setDraft({ title: 'Two' }))

    saved = { title: 'One' }
    rerender()

    expect(result.current.draft).toEqual({ title: 'Two' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(save).toHaveBeenLastCalledWith({ title: 'Two' })
  })

  it('holds back an invalid value and says why', async () => {
    const save = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() =>
      useHarness({ title: 'Forum' }, save, { validate: value => (value.title ? undefined : 'Needs a title') })
    )

    act(() => result.current.setDraft({ title: '' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('invalid')
    expect(result.current.error).toBe('Needs a title')
  })

  it("reports the server's reason when a save fails", async () => {
    const save = vi.fn().mockRejectedValue({ data: 'That segment is taken.', status: 'error' })
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'Other' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('That segment is taken.')
  })

  it('waits for flush() when the delay is manual', async () => {
    const save = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save, { delay: 'manual' }))

    act(() => result.current.setDraft({ title: 'commu' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      result.current.flush()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(save).toHaveBeenCalledWith({ title: 'commu' })
  })

  it('saves during a long run of typing, at most maxWait apart', async () => {
    const save = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    // A keystroke every 500ms never leaves the 700ms pause a save waits for.
    for (let index = 1; index <= 7; index++) {
      act(() => result.current.setDraft({ title: 'x'.repeat(index) }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
    }

    // The first keystroke came at 0ms, so the save went at 3000ms with the
    // sixth one in it — not after the typing stopped.
    expect(save.mock.calls[0][0]).toEqual({ title: 'xxxxxx' })
  })

  it('retries a save that never reached the server, and stops at success', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce({ errors: new TypeError('Failed to fetch') })
      .mockResolvedValue({})
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'Offline edit' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    expect(result.current.status).toBe('error')
    expect(result.current.retrying).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(save).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('saved')
  })

  it('does not retry a value the server refused', async () => {
    const save = vi.fn().mockRejectedValue({ data: 'Reserved.', status: 'error' })
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'page' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.retrying).toBeFalsy()
  })

  it('asks before leaving while a failed edit is still unsaved', async () => {
    const save = vi.fn().mockRejectedValue({ data: 'Reserved.', status: 'error' })
    const { result } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'page' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })

    const event = new Event('beforeunload', { cancelable: true })
    globalThis.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('saves a waiting change when the screen closes', () => {
    const save = vi.fn().mockResolvedValue({})
    const { result, unmount } = renderHook(() => useHarness({ title: 'Forum' }, save))

    act(() => result.current.setDraft({ title: 'Left' }))
    unmount()

    expect(save).toHaveBeenCalledWith({ title: 'Left' })
  })
})
