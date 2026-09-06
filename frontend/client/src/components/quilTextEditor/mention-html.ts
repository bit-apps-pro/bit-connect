/**
 * A mention the app writes, rather than one the author picked.
 *
 * Normally a mention is built by the "@" picker out of a candidate the server
 * described (mention-source.ts). This is for the one case where who is being
 * addressed is known before a character is typed — opening a reply under
 * somebody's comment — and the editor has to be handed a mention it will read
 * back as one.
 *
 * The markup has to satisfy three readers at once:
 *
 *   - Quill, which turns a link carrying MENTION_CLASS back into the mention
 *     blot, so it sits in the box as a chip rather than a blue link.
 *   - MentionService on the server, which parses the *stored* words to decide
 *     who was named — the class is what marks a bare name as a mention there.
 *   - whoever reads the posted reply, for whom this is simply a name.
 *
 * The trailing space is a non-breaking one because Quill's clipboard drops
 * ordinary whitespace at the end of a line: without it the author's first
 * keystroke would land inside the link and extend the mention.
 */

import { userProfilePath } from '@utilities/user-link'

import { portalPath } from '@/utils/auth-urls'

import { MENTION_CLASS } from './mention-markup'

/**
 * Text safe to drop into markup, as element content or inside a quoted
 * attribute.
 *
 * A display name is whatever its owner typed into their profile, so it reaches
 * here unfiltered — and this string is parsed as HTML by the very next thing
 * that touches it.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * A paragraph naming one member, ready to seed an editor with.
 *
 * @param name the member's display name — what the mention reads as
 * @param slug the member's profile slug, which is what the link points at
 */
export function mentionHtml({ name, slug }: { name: string; slug: string }): string {
  const href = escapeHtml(portalPath(userProfilePath(slug)))

  return `<p><a class="${MENTION_CLASS}" href="${href}">${escapeHtml(name)}</a>&nbsp;</p>`
}
