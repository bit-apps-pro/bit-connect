import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import pluginInfo from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import { Badge, Button, Space, Typography } from 'antd'
import { LuCrown } from 'react-icons/lu'

import { type VersionPanelProps } from '../shared/types'

const { Title } = Typography

/**
 * The version panel: what is installed, and a link out.
 *
 * The add-on's features are in the add-on, which is a separate plugin
 * distributed separately. The only outbound thing on this screen is the link
 * below, which opens a page in a new tab.
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
