import { __ } from '@common/helpers/i18nWrap'
import { Button, Checkbox, Modal, Spin, Typography } from 'antd'
import { useMemo, useState } from 'react'

import useCapabilityGroups, { type CapabilityGroup } from '../data/use-capability-groups'
import useCapabilitySettings, { type RoleCapabilities } from '../data/use-capability-settings'
import useUpdateRoleCapabilities from '../data/use-update-role-capabilities'
import { FORUM_CAPABILITY_LABELS, type ForumCapability } from '../shared/types'

const { Text, Title } = Typography

/**
 * What to call a capability on screen.
 *
 * The server sends a translated label for every capability it recognises, so
 * that is the first answer. A group may carry its own labels — that is how a
 * plugin adding a capability names it, since the server's map covers only the
 * ones declared here. The last resort spells the slug out rather than leaving
 * the checkbox blank, and strips the plugin prefix so it reads as an action
 * rather than as a stored key.
 */
function capabilityLabel(
  cap: string,
  fromServer: Record<string, string> | undefined,
  fromGroup: Record<string, string> | undefined
) {
  return (
    fromGroup?.[cap]
    ?? fromServer?.[cap]
    ?? FORUM_CAPABILITY_LABELS[cap as ForumCapability]
    ?? cap.replace(/^bit_connect_(forum_)?/, '').replaceAll('_', ' ')
  )
}

const CAP_GROUPS: CapabilityGroup[] = [
  {
    caps: ['bit_connect_forum_create_post', 'bit_connect_forum_edit_own_post', 'bit_connect_forum_delete_own_post'],
    label: __('Posts')
  },
  {
    caps: ['bit_connect_forum_create_comment', 'bit_connect_forum_edit_own_comment', 'bit_connect_forum_delete_own_comment'],
    label: __('Comments')
  },
  {
    // Topics only. Voting on a reply is the add-on's capability, and the
    // add-on contributes its own row — see use-capability-groups.
    caps: ['bit_connect_forum_vote_post'],
    label: __('Voting')
  },
  {
    caps: ['bit_connect_forum_delete_any'],
    label: __('Other People\u2019s Content')
  },
  {
    caps: ['bit_connect_forum_moderate', 'bit_connect_forum_pin_post', 'bit_connect_forum_lock_post', 'bit_connect_forum_manage'],
    label: __('Moderation & Admin')
  }
]

interface RoleRowProps {
  /** The server's translated label per capability slug. */
  capabilityLabels?: Record<string, string>
  disabled: boolean
  role: RoleCapabilities
}

function RoleRow({ capabilityLabels, disabled, role }: RoleRowProps) {
  const [draft, setDraft] = useState<Record<string, boolean>>(() => ({ ...role.capabilities }))
  const [saving, setSaving] = useState(false)
  const { updateRoleCapabilities } = useUpdateRoleCapabilities()
  // Empty without the add-on. See use-capability-groups.
  const extraGroups = useCapabilityGroups()
  const groups = useMemo(() => [...CAP_GROUPS, ...extraGroups], [extraGroups])

  const toggle = (cap: string, checked: boolean) => setDraft(prev => ({ ...prev, [cap]: checked }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRoleCapabilities({ capabilities: draft, role: role.slug })
    } finally {
      setSaving(false)
    }
  }

  const isBusy = disabled || saving

  return (
    <div className="bc-border bc-border-solid bc-border-line bc-rounded-lg bc-p-4">
      <div className="bc-flex bc-items-center bc-justify-between bc-mb-4">
        <div>
          <Text strong>{role.name}</Text>
          <Text className="bc-block bc-text-xs" type="secondary">
            {role.slug}
          </Text>
        </div>
        <Button disabled={isBusy} loading={saving} onClick={handleSave} size="small" type="primary">
          {__('Save')}
        </Button>
      </div>

      <div className="bc-grid bc-grid-cols-2 md:bc-grid-cols-4 bc-gap-4">
        {groups.map(group => (
          <div key={group.label}>
            <Text
              className="bc-block bc-mb-2 bc-text-xs bc-uppercase bc-tracking-wide bc-font-semibold"
              type="secondary"
            >
              {group.label}
            </Text>
            <div className="bc-flex bc-flex-col bc-gap-1.5">
              {group.caps.map(cap => (
                <Checkbox
                  checked={!!draft[cap]}
                  disabled={isBusy}
                  key={cap}
                  onChange={e => toggle(cap, e.target.checked)}
                >
                  <span className="bc-text-sm bc-leading-tight">
                    {capabilityLabel(cap, capabilityLabels, group.labels)}
                  </span>
                </Checkbox>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface RoleCapabilitiesModalProps {
  onClose: () => void
  open: boolean
}

export default function RoleCapabilitiesModal({ onClose, open }: RoleCapabilitiesModalProps) {
  const { capabilitySettings, isCapabilitySettingsFetching } = useCapabilitySettings()
  const { isUpdatingRoleCapabilities } = useUpdateRoleCapabilities()

  return (
    <Modal
      // No footer: each role saves with its own button. `undefined` would
      // render antd's default Cancel/OK, and OK had nothing to confirm.
      // eslint-disable-next-line unicorn/no-null
      footer={null}
      onCancel={onClose}
      open={open}
      title={
        <div>
          <Title className="bc-mb-0" level={4}>
            {__('Forum Capabilities by Role')}
          </Title>
          <Text className="bc-text-sm bc-font-normal" type="secondary">
            {__(
              'Set which forum actions each WordPress role can perform. Changes apply immediately to all users of that role.'
            )}
          </Text>
        </div>
      }
      width={800}
    >
      {isCapabilitySettingsFetching ? (
        <div className="bc-flex bc-justify-center bc-py-10">
          <Spin size="large" />
        </div>
      ) : (
        <div className="bc-flex bc-flex-col bc-gap-4 bc-py-2">
          {capabilitySettings?.roles?.map(role => (
            <RoleRow
              capabilityLabels={capabilitySettings.capabilityLabels}
              disabled={isUpdatingRoleCapabilities}
              key={role.slug}
              role={role}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}
