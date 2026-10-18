import { __, sprintf } from '@common/helpers/i18nWrap'

import { type BulkResult } from './types'

/**
 * What a bulk action did, in one line: "3 updated, 1 already done".
 *
 * Skipped is not failed — locking a topic that is already locked did what was
 * asked — so the two are told apart, and only a failure makes it an error.
 */
export default function bulkSummary({ counts }: BulkResult): { text: string; type: 'error' | 'success' } {
  const parts: string[] = []

  if (counts.done > 0) parts.push(sprintf(__('%d updated'), counts.done))
  if (counts.skipped > 0) parts.push(sprintf(__('%d already done'), counts.skipped))
  if (counts.failed > 0) parts.push(sprintf(__('%d could not be changed'), counts.failed))

  return {
    text: parts.length > 0 ? parts.join(', ') : __('Nothing changed.'),
    type: counts.failed > 0 ? 'error' : 'success'
  }
}
