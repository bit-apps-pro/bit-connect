import { htmlToText } from '../text/decode-entities'

export interface FailureEnvelope {
  code: string
  data: unknown
  message?: string
  status: 'error'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Brings a failed response into the plugin's `{ status, code, data }` envelope.
 *
 * The plugin's own endpoints already answer in it, and pass through untouched.
 * Anything WordPress answers itself — a fatal, a bad nonce, a missing route —
 * arrives as `{ code, message }`, and a fatal's message is markup: callers that
 * showed `.message` put "<p>There has been a critical error…</p>" in a toast.
 * The message comes back as plain text, as both `data` and `message`, so every
 * caller reads the same sentence whichever field it looks at.
 */
export function normalizeFailure(body: unknown, fallback: string): FailureEnvelope {
  if (isRecord(body) && body.status === 'error') {
    return body as unknown as FailureEnvelope
  }

  if (isRecord(body) && typeof body.message === 'string') {
    const text = htmlToText(body.message) || fallback

    return {
      code: typeof body.code === 'string' ? body.code : 'ERROR',
      data: text,
      message: text,
      status: 'error'
    }
  }

  return { code: 'ERROR', data: fallback, message: fallback, status: 'error' }
}
