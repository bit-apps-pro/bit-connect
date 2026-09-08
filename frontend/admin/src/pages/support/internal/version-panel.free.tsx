import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import pluginInfo from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import { Badge, Button, Space, Typography } from 'antd'
import { LuCrown } from 'react-icons/lu'

import { type VersionPanelProps } from '../shared/types'

const { Title } = Typography

/**
 * The version panel without the add-on: what is installed, and a link out.
 *
 * There is nothing here to activate, check or unlock. This plugin holds no
 * licence key, asks no server whether it may run, and has no feature waiting
 * behind an answer — the add-on's features are in the add-on, which is a
 * separate plugin distributed separately. The only outbound thing on this
 * screen is the link below, which opens a page in a new tab.
 *
 * That is a requirement, not a stylistic choice: a plugin hosted on
 * WordPress.org may not carry a mechanism that decides whether its own
 * features may be used (Plugin Directory guideline 6). The activation form,
 * the deactivation call and the periodic validity check all live in
 * `version-panel.pro`, which is compiled from the add-on's tree and is absent
 * from this bundle entirely.
 */
export default function VersionPanelFree({ pluginSlug }: VersionPanelProps) {
  const aboutPlugin = pluginInfo.plugins[pluginSlug as keyof typeof pluginInfo.plugins]

  return (
    <div className="bc-mb-12">
      <Title level={5}>{__('Version')}</Title>

      <div className="bc-mb-3">
        {__('Installed version')}: <b>{config.FREE_VERSION}</b>
      </div>

      <Space wrap>
        <div>{__('Looking for more? Bit Connect Pro is a separate add-on.')}</div>
        <Badge dot>
          <Button
            href={aboutPlugin.buyLink}
            icon={<LuCrown />}
            rel="noopener noreferrer nofollow"
            target="_blank"
            type="primary"
          >
            {__('Get Bit Connect Pro')}
          </Button>
        </Badge>
      </Space>
    </div>
  )
}
