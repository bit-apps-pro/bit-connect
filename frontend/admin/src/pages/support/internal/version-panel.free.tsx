import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import pluginInfo from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import { Button, Space, Typography } from 'antd'

import { type VersionPanelProps } from '../shared/types'

const { Title } = Typography

/**
 * The version panel: what is installed, and one plain link out.
 *
 * The link names a separate plugin and opens its page in a new tab. It is the
 * only place this plugin mentions it: a link, not a badge, a lock or a button
 * beside a control, and nothing on this screen or any other is held back.
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
        <div>{__('Looking for more? Bit Connect Pro is a separate plugin.')}</div>
        <Button href={aboutPlugin.buyLink} rel="noopener noreferrer nofollow" target="_blank">
          {__('Learn about Bit Connect Pro')}
        </Button>
      </Space>
    </div>
  )
}
