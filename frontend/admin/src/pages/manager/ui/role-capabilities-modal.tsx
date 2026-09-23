import { __ } from '@common/helpers/i18nWrap'
import { Button, Checkbox, Modal, Spin, Typography } from 'antd'
import { useMemo, useState } from 'react'

import useCapabilityGroups from '../data/use-capability-groups'
import useCapabilitySettings, { type RoleCapabilities } from '../data/use-capability-settings'
import useUpdateRoleCapabilities from '../data/use-update-role-capabilities'

const { Text, Title } = Typography

const CAP_GROUPS: { caps: string[]; label: string }[] = [
  {
    caps: ['forum_create_post', 'forum_edit_own_post', 'forum_delete_own_post'],
    label: __('Posts')
  },
  {
    caps: ['forum_create_comment', 'forum_edit_own_comment', 'forum_delete_own_comment'],
    label: __('Comments')
  },
  {
    // Topics only. Voting on a reply is the add-on's capability, and the
    // add-on contributes its own row — see use-capability-groups.
    caps: ['forum_vote_post'],
    label: __('Voting')
  },
  {
    caps: ['forum_delete_any'],
    label: __('Other People\u2019s Content')
  },
  {
    caps: ['forum_moderate', 'forum_pin_post', 'forum_lock_post', 'forum_manage'],
    label: __('Moderation & Admin')
  }
]

interface RoleRowProps {
  disabled: boolean
  role: RoleCapabilities
}

function RoleRow({ disabled, role }: RoleRowProps) {
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
                    {cap.replace('forum_', '').replaceAll('_', ' ')}
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
            <RoleRow disabled={isUpdatingRoleCapabilities} key={role.slug} role={role} />
          ))}
        </div>
      )}
    </Modal>
  )
}
