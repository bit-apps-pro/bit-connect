import { describe, expect, it } from 'vitest'

import { capabilitiesOf, hasCapability } from './capabilities'

describe('capabilitiesOf', () => {
  it('hands back the map the server sent, whatever the role is called', () => {
    const caps = capabilitiesOf({
      capabilities: { forum_edit_own_post: true, forum_moderate: true },
      role: 'editor',
      roles: ['editor']
    })

    expect(hasCapability(caps, 'forum_moderate')).toBe(true)
    expect(hasCapability(caps, 'forum_edit_own_post')).toBe(true)
  })

  it('trusts the map over the role name — an administrator can be denied', () => {
    const caps = capabilitiesOf({
      capabilities: { forum_moderate: false },
      role: 'administrator',
      roles: ['administrator']
    })

    expect(hasCapability(caps, 'forum_moderate')).toBe(false)
  })

  it('treats a capability absent from the map as not granted', () => {
    const caps = capabilitiesOf({ capabilities: { forum_vote_post: true } })

    expect(hasCapability(caps, 'forum_moderate')).toBe(false)
  })

  it('grants a guest nothing', () => {
    const caps = capabilitiesOf()

    expect(hasCapability(caps, 'forum_create_post')).toBe(false)
    expect(hasCapability(caps, 'forum_moderate')).toBe(false)
  })

  describe('when no map was sent (WP-core fallback, or an older payload)', () => {
    it('reads moderation off the legacy role names', () => {
      expect(hasCapability(capabilitiesOf({ roles: ['administrator'] }), 'forum_moderate')).toBe(true)
      expect(hasCapability(capabilitiesOf({ role: 'bit_connect_moderator' }), 'forum_moderate')).toBe(
        true
      )
      expect(hasCapability(capabilitiesOf({ roles: ['subscriber'] }), 'forum_moderate')).toBe(false)
    })

    it('keeps own-content actions visible, as the portal did before', () => {
      const caps = capabilitiesOf({ roles: ['subscriber'] })

      expect(hasCapability(caps, 'forum_edit_own_post')).toBe(true)
      expect(hasCapability(caps, 'forum_delete_own_comment')).toBe(true)
    })
  })
})
