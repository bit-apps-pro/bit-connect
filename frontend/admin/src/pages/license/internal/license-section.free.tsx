import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import pluginInfo from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import { Badge, Button, Space, Typography } from 'antd'
import Title from 'antd/es/typography/Title'
import { LuCrown } from 'react-icons/lu'

/**
 * What this screen says about versions when the add-on is not part of the build.
 *
 * The whole of it: which version is installed, and a link to the page that
 * describes the add-on. There is no licence field, no activation call, no
 * periodic re-check of anything — this plugin has nothing to unlock, so it has
 * nothing to ask a server about. The add-on is a separate plugin distributed
 * separately, and everything that talks to a licence server went with it (see
 * `license-section.pro.tsx`, a placeholder here).
 *
 * That is not tidiness. A plugin published on WordPress.org may not carry a
 * mechanism that decides whether its own features may be used, even an inert
 * one — the guidelines are explicit that such code must not be *included*, not
 * merely that it must not fire. This file is the free half of that split, and
 * it is why the free bundle contains no licence code at all rather than licence
 * code that happens to be switched off.
 *
 * Updates are not checked here either: this plugin is hosted on WordPress.org
 * and updates through WordPress itself.
 */
export default function LicenseSectionFree() {
  const aboutPlugin = pluginInfo.plugins[config.PLUGIN_SLUG as keyof typeof pluginInfo.plugins]

  return (
    <div className="bc-mb-12">
      <Title level={5}>{__('Version')}</Title>

      <div className="bc-mb-2">
        <Typography.Text>
          {aboutPlugin?.title ?? config.PRODUCT_NAME} {config.FREE_VERSION}
        </Typography.Text>
      </div>

      <Space className="bc-mb-2" wrap>
        <Typography.Text type="secondary">
          {__('Looking for badges, private topics, comment upvotes or custom notification emails?')}
        </Typography.Text>
        <Badge dot>
          <Button
            href={aboutPlugin?.buyLink}
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
