import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useDebounce from './useDebounce'
import useDebounceState from './useDebounceState'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Every search field and slug-availability check hangs off this. A value that
// updates immediately turns each keystroke into a request; one that never
// settles leaves the field looking broken.
describe('useDebounceState', () => {
  it('reports the first value straight away', () => {
    const { result } = renderHook(() => useDebounceState('bill'))

    expect(result.current).toBe('bill')
  })

  it('holds the new value back until the delay has passed', () => {
    const { rerender, result } = renderHook(({ value }) => useDebounceState(value, 300), {
      initialProps: { value: 'bill' }
    })

    rerender({ value: 'billing' })
    expect(result.current).toBe('bill')

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('bill')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('billing')
  })

  // The point of the whole hook: typing restarts the wait rather than queueing
  // one settled value per keystroke.
  it('starts the wait again on every change', () => {
    const { rerender, result } = renderHook(({ value }) => useDebounceState(value, 300), {
      initialProps: { value: 'b' }
    })

    for (const value of ['bi', 'bil', 'bill']) {
      act(() => {
        vi.advanceTimersByTime(200)
      })
      rerender({ value })
    }

    expect(result.current).toBe('b')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('bill')
  })

  it('waits half a second when no delay is given', () => {
    const { rerender, result } = renderHook(({ value }) => useDebounceState(value), {
      initialProps: { value: 'bill' }
    })

    rerender({ value: 'billing' })

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current).toBe('bill')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('billing')
  })

  it('carries any value, not just text', () => {
    const { rerender, result } = renderHook(({ value }) => useDebounceState(value, 100), {
      initialProps: { value: { page: 1 } }
    })

    rerender({ value: { page: 2 } })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toEqual({ page: 2 })
  })

  // Left running, a pending timer sets state on a component that is gone.
  it('drops its pending timer when the component goes', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebounceState(value, 300), {
      initialProps: { value: 'bill' }
    })

    rerender({ value: 'billing' })
    unmount()

    expect(() =>
      act(() => {
        vi.advanceTimersByTime(300)
      })
    ).not.toThrow()
  })
})

describe('useDebounce', () => {
  it('calls through once the delay has passed', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 300))

    act(() => result.current('billing'))
    expect(callback).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledWith('billing')
  })

  it('calls through once for a run of calls, with the last arguments', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebounce(callback, 300))

    act(() => {
      result.current('b')
      result.current('bi')
      result.current('billing')
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('billing')
  })

  // The debounced function is memoised on the delay alone, so without the ref
  // it would go on calling whichever closure was current when it was created —
  // the classic stale-callback bug.
  it('calls the newest callback rather than the one it was created with', () => {
    const first = vi.fn()
    const second = vi.fn()

    const { rerender, result } = renderHook(({ callback }) => useDebounce(callback, 300), {
      initialProps: { callback: first }
    })

    rerender({ callback: second })
    act(() => result.current('billing'))

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('billing')
  })

  // A new function identity on every render would restart the wait on every
  // render, which is the same as not debouncing at all.
  it('keeps the same debounced function across renders', () => {
    const { rerender, result } = renderHook(
      ({ callback }: { callback: (value: string) => void }) => useDebounce(callback, 300),
      { initialProps: { callback: vi.fn() } }
    )

    const first = result.current
    rerender({ callback: vi.fn() })

    expect(result.current).toBe(first)
  })
})
