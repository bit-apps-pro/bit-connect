/**
 * Who the "@" picker can offer.
 *
 * A thin read of `mentions/search`. The server decides what a member looks like
 * and builds the profile URL, because only it knows where the portal answers —
 * at the site root on one install, under a slug on the next — and a mention
 * pointing at a path this app guessed would resolve for some forums and 404 for
 * the rest.
 */

import get from '@/utils/request/get'

export interface MentionCandidate {
  avatar: string
  /**
   * What the mention links to, root-relative (`/portal/user/aiden-carter`).
   *
   * Relative on purpose. Both sanitizers this content passes through treat an
   * `http…` href as somebody else's site — one adds `rel="nofollow ugc"`, the
   * other `target="_blank"` — so an absolute URL would open a colleague's own
   * profile in a new tab, marked as untrusted.
   */
  href: string
  id: number
  name: string
  /** Profile slug. Shown beside the name, which is not always unique. */
  slug: string
}

export async function searchMembers(term: string, signal?: AbortSignal): Promise<MentionCandidate[]> {
  const response = await get<MentionCandidate[]>('mentions/search', {
    queryParam: { q: term },
    signal
  })

  // A picker that throws on an unexpected payload would break typing itself, so
  // anything that is not a list is simply nobody to suggest.
  return Array.isArray(response?.data) ? response.data : []
}
