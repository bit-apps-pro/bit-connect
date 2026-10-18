import { __ } from '@common/helpers/i18nWrap'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'

import { type AutoSaveState, type AutoSaveStatus, PageSaveContext } from './page-save'

interface AutoSaveOptions<T> {
  /**
   * How long after the last change to save, in milliseconds. `'manual'` saves
   * only when flush() is called — for a value that must not be stored half
   * typed, such as a URL segment, saved when its field is left.
   */
  delay?: 'manual' | number
  /** The value being edited. */
  draft: T | undefined
  /** False holds every save back, and leaves the draft alone. */
  enabled?: boolean
  /** Reports this value's saving to the page's status line, under this name. */
  key?: string
  /**
   * The longest a run of changes waits, however closely they follow each
   * other — so a minute of steady typing is saved as it goes, not at the end.
   */
  maxWait?: number
  save: (value: T) => Promise<unknown>
  /** What the server holds; undefined until it has loaded. */
  saved: T | undefined
  /** Compares values; anything the server does not store must be left out. */
  serialize?: (value: T) => string
  setDraft: (value: T) => void
  /** Why the draft cannot be saved as it stands, if it cannot. */
  validate?: (value: T) => string | undefined
}

/** Waits between automatic retries of a save that never reached the server. */
const RETRY_DELAYS = [2000, 5000, 15_000]

/**
 * The request never got an answer: offline, timed out, or cut off. request()
 * wraps those as `{ errors }`, while a refusal the server explained carries
 * its `status`. Only these are retried — a refused value would be refused again.
 */
function isNetworkFailure(error: unknown): boolean {
  if (!navigator.onLine) return true
  return !!error && typeof error === 'object' && 'errors' in error && !('status' in error)
}

/** The server's reason, whichever of its shapes it arrived in. */
function messageOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return typeof error === 'string' ? error : undefined
  const { data, errors, message } = error as { data?: unknown; errors?: { message?: unknown }; message?: unknown }
  if (typeof data === 'string' && data !== '') return data
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat()[0]
    if (typeof first === 'string') return first
  }
  if (typeof message === 'string' && message !== '') return message
  if (typeof errors?.message === 'string') return errors.message

  return undefined
}

/**
 * Saves a value as it is edited.
 *
 * Takes the server's value as the draft once it loads, and again after any
 * refetch the draft has not moved on from — never over an edit still waiting
 * to be saved. A change is saved `delay` ms after the last one, so a burst of
 * typing or switch flips is one request, and never more than `maxWait` after
 * the first; changes made while a save is in flight are saved after it.
 *
 * A save that never reached the server is retried on its own — after 2, 5 and
 * 15 seconds, and as soon as the browser is back online — while one the
 * server refused waits for the value to change. Either way the edit stays on
 * screen, and leaving the page asks first for as long as anything is unsaved.
 * A change still waiting when the screen closes is saved then.
 */
export default function useAutoSave<T>({
  delay = 700,
  draft,
  enabled = true,
  key,
  maxWait = 3000,
  save,
  saved,
  serialize = JSON.stringify,
  setDraft,
  validate
}: AutoSaveOptions<T>) {
  const report = useContext(PageSaveContext)
  const [state, setState] = useState<AutoSaveState>({ status: 'idle' })

  const latest = useRef({ draft, enabled, save, serialize, validate })
  latest.current = { draft, enabled, save, serialize, validate }
  // What the server holds as far as this screen knows: the last value loaded or saved.
  const baseline = useRef<string>()
  const adopted = useRef<string>()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const retryTimer = useRef<ReturnType<typeof setTimeout>>()
  const retries = useRef(0)
  // When the oldest change not yet sent was made, for maxWait.
  const waitingSince = useRef<number>()
  const inFlight = useRef(false)
  const again = useRef(false)

  const savedKey = saved === undefined ? undefined : serialize(saved)
  const draftKey = draft === undefined ? undefined : serialize(draft)

  useEffect(() => {
    if (!enabled || saved === undefined || savedKey === undefined || savedKey === adopted.current) return
    adopted.current = savedKey
    const current = latest.current.draft
    const untouched =
      baseline.current === undefined ||
      current === undefined ||
      latest.current.serialize(current) === baseline.current
    baseline.current = savedKey
    if (untouched) setDraft(saved)
  }, [enabled, saved, savedKey, setDraft])

  const run = useCallback(async (value?: T): Promise<void> => {
    const target = value ?? latest.current.draft
    if (target === undefined || !latest.current.enabled || baseline.current === undefined) return
    if (inFlight.current) {
      again.current = true
      return
    }
    const snapshot = latest.current.serialize(target)
    if (snapshot === baseline.current || latest.current.validate?.(target)) return

    clearTimeout(timer.current)
    clearTimeout(retryTimer.current)
    waitingSince.current = undefined
    inFlight.current = true
    setState({ status: 'saving' })
    try {
      await latest.current.save(target)
      baseline.current = snapshot
      retries.current = 0
      setState({ status: 'saved' })
    } catch (error) {
      if (isNetworkFailure(error)) {
        const wait = RETRY_DELAYS[retries.current]
        retries.current += 1
        if (wait !== undefined) retryTimer.current = setTimeout(() => void run(), wait)
        setState({
          error: __('Can’t reach the server.'),
          retrying: wait !== undefined,
          status: 'error'
        })
      } else {
        retries.current = 0
        setState({ error: messageOf(error), status: 'error' })
      }
    } finally {
      inFlight.current = false
    }

    if (again.current) {
      again.current = false
      await run()
    }
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!enabled || draftKey === undefined || baseline.current === undefined || draftKey === baseline.current) {
      waitingSince.current = undefined
      return
    }
    // A new edit is a new attempt: the old failure and its retries are done.
    clearTimeout(retryTimer.current)
    retries.current = 0
    setState(prev => (prev.status === 'error' ? { status: 'idle' } : prev))
    if (delay === 'manual') return
    waitingSince.current ??= Date.now()
    const untilMaxWait = waitingSince.current + maxWait - Date.now()
    timer.current = setTimeout(() => void run(), Math.max(0, Math.min(delay, untilMaxWait)))
  }, [delay, draftKey, enabled, maxWait, run])

  // Offline, TanStack Query holds a mutation rather than failing it, and sends
  // it on reconnecting — so a save made offline sits "in flight" until then.
  // Tracked here only to say so, instead of showing "Saving…" indefinitely.
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  // Back online: a save that failed for want of a connection goes again now
  // rather than at its next scheduled retry.
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      if (retries.current > 0) void run()
    }
    const onOffline = () => setIsOnline(false)
    globalThis.addEventListener('online', onOnline)
    globalThis.addEventListener('offline', onOffline)
    return () => {
      globalThis.removeEventListener('online', onOnline)
      globalThis.removeEventListener('offline', onOffline)
    }
  }, [run])

  // Closing the screen saves what was still waiting for its delay.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(retryTimer.current)
      void run()
    },
    [run]
  )

  /** Saves now rather than after the delay — on leaving a field, or to retry. */
  const flush = useCallback(
    (value?: T) => {
      clearTimeout(timer.current)
      // Asked for by hand, so the retry schedule starts over from its first wait.
      retries.current = 0
      void run(value)
    },
    [run]
  )
  // Called with no argument by the page, which knows nothing of T.
  const flushNow = useCallback(() => flush(), [flush])

  const invalid = enabled && draft !== undefined ? validate?.(draft) : undefined
  const hasChanges =
    enabled && draftKey !== undefined && baseline.current !== undefined && draftKey !== baseline.current

  let status: AutoSaveStatus = state.status
  if (state.status === 'saving') status = 'saving'
  else if (hasChanges && invalid) status = 'invalid'
  else if (state.status === 'error') status = 'error'
  else if (hasChanges) status = 'pending'
  else if (state.status !== 'saved') status = 'idle'

  let error = status === 'invalid' ? invalid : status === 'error' ? state.error : undefined
  let retrying = status === 'error' && state.retrying
  if (!isOnline && (status === 'saving' || status === 'pending')) {
    status = 'error'
    error = __('You’re offline. Changes save when the connection is back.')
    retrying = false
  }

  useEffect(() => {
    if (key) report?.(key, { error, flush: flushNow, retrying, status })
  }, [error, flushNow, key, report, retrying, status])
  useEffect(() => () => (key ? report?.(key) : undefined), [key, report])

  // Anything not yet on the server — waiting, in flight, refused or failed —
  // is lost to a reload or a closed tab, so the browser asks first.
  const isUnsaved = hasChanges || status === 'saving'
  useEffect(() => {
    if (!isUnsaved) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    globalThis.addEventListener('beforeunload', warn)
    return () => globalThis.removeEventListener('beforeunload', warn)
  }, [isUnsaved])

  return { error, flush, flushNow, hasChanges, retrying, status }
}
