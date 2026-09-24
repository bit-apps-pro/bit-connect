import { type ReactNode } from 'react'

import { type ProfileBadgesModalProps } from '../shared/types'

/**
 * The badge catalog editor: this plugin has no catalog, so there is no editor.
 *
 * Nothing opens it — the Manager header draws the Profile Badges button only
 * where `useBadgesAdmin` reports a catalog, and here it never does.
 *
 * No explanatory modal is drawn in its place either. A screen that describes a
 * feature this plugin does not have, reached from a button shaped like the
 * feature, is a placeholder for it.
 *
 * It still takes the editor's props so the call site stays typed against what
 * a catalog editor needs, rather than against the fact that this one is empty.
 */
export default function ProfileBadgesModal(_props: ProfileBadgesModalProps): ReactNode {
  // eslint-disable-next-line unicorn/no-null
  return null
}
