import { __ } from '@common/helpers/i18nWrap'
import { Button, Modal, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

import { type ProfileBadgesModalProps } from './profile-badges-modal.pro'

const { Text, Title } = Typography

/**
 * Example badges, shown as badges and nothing else.
 *
 * These illustrate the shape a badge takes; they are not rows of a catalog,
 * because the free build has no catalog to read — those routes live in the pro
 * add-on. They are deliberately not laid out as a list of records, and there is
 * deliberately no name field or Add button anywhere on this screen: a mocked-up
 * form reads as a control that has stopped working, which is not something a
 * free plugin should draw.
 */
const EXAMPLE_BADGES = [
  { id: 'developer', label: __('Developer'), tone: 'bc-bg-blue-100 bc-text-blue-700' },
  { id: 'support', label: __('Support'), tone: 'bc-bg-green-100 bc-text-green-700' },
  { id: 'group-expert', label: __('Group Expert'), tone: 'bc-bg-amber-100 bc-text-amber-700' }
]

/**
 * What profile badges are, for a site without the add-on.
 *
 * Same modal, same trigger, same route — an admin who clicks Profile Badges in
 * the free plugin gets an explanation rather than nothing, which is the answer
 * to "where did that button go". What it does not do is imitate the pro screen.
 */
export default function ProfileBadgesModalFree({ onClose, open }: ProfileBadgesModalProps) {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <Modal
      // antd hides the footer on null and renders the default OK/Cancel pair
      // on undefined, so this one has to stay null.
      // eslint-disable-next-line unicorn/no-null
      footer={null}
      onCancel={onClose}
      open={open}
      title={__('Profile Badges')}
      width={640}
    >
      <Text className="bc-block bc-mb-4" type="secondary">
        {__(
          'Name your people beyond what their permissions make them — Developer, Support, Group Expert — and hand the badges out per member.'
        )}
      </Text>

      <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-p-4">
        <Title className="bc-mb-3" level={5}>
          {__('For example')}
        </Title>
        <div className="bc-mb-4 bc-flex bc-flex-wrap bc-gap-2">
          {EXAMPLE_BADGES.map(badge => (
            <span className={`bc-rounded-full bc-px-3 bc-py-1 bc-text-xs ${badge.tone}`} key={badge.id}>
              {badge.label}
            </span>
          ))}
        </div>
        <Text className="bc-block bc-text-sm" type="secondary">
          {__(
            'With the Pro add-on you write your own badges — name and colour — and assign them to members from the Badges column of this screen. Members see them beside their name across the forum.'
          )}
        </Text>
      </div>

      <div className="bc-mt-4 bc-flex bc-items-center bc-justify-between bc-gap-4">
        <Text className="bc-text-xs" type="secondary">
          {__('Authoring and assigning profile badges is a Pro feature.')}
        </Text>
        <Button icon={<LuCrown size={16} />} onClick={() => setBuyProOpen(true)} type="primary">
          {__('Buy Pro')}
        </Button>
      </div>
    </Modal>
  )
}
