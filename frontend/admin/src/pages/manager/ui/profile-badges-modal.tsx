import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import ProfileBadgesModalFree from './profile-badges-modal.free'
import ProfileBadgesModalPro, { type ProfileBadgesModalProps } from './profile-badges-modal.pro'

/**
 * The badge catalog editor.
 *
 * Dispatch only. In the free build `IS_PRO_ACTIVE` folds to `false` and Rollup
 * drops the real editor — along with its four data hooks and the endpoints they
 * call — leaving the locked preview in its place.
 */
export default function ProfileBadgesModal(props: ProfileBadgesModalProps) {
  return IS_PRO_ACTIVE ? <ProfileBadgesModalPro {...props} /> : <ProfileBadgesModalFree {...props} />
}
