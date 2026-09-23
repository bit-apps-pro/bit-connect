import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import Changelog from '@plugin-commons/components/Changelog'
import FacebookCommunityCard from '@plugin-commons/components/FacebookCommunityCard'
import pluginInfoData from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import SupportLinks from '@plugin-commons/components/SupportPage/SupportLinks'
import { Col, Row, theme, Typography } from 'antd'

import RecommendedPlugins from './internal/recommended-plugins'
import VersionPanel from './internal/version-panel'

const { Paragraph, Title } = Typography

/**
 * Support: about the plugin, the installed version, the changelog and where to
 * get help.
 *
 * Composed here from individual commons components rather than by importing
 * the commons `SupportPage`, so this screen carries exactly what Bit Connect
 * renders and nothing else. The version panel is the one piece that differs by
 * edition, reached through the same `.free`/`.pro` split as every other one.
 */
export default function Support() {
  const { token } = theme.useToken()

  const aboutPlugin = pluginInfoData.plugins[config.PLUGIN_SLUG as keyof typeof pluginInfoData.plugins]

  return (
    <div className="bc-p-5">
      <Row gutter={20}>
        <Col md={15} sm={24}>
          <div className="bc-mb-12">
            <Title level={5}>
              {__('About')} {aboutPlugin.title}
            </Title>
            <Paragraph style={{ color: token.colorTextSecondary }}>{aboutPlugin.description}</Paragraph>
          </div>

          <VersionPanel pluginSlug={config.PLUGIN_SLUG} />

          <Changelog />

          <SupportLinks pluginSlug={config.PLUGIN_SLUG} />
        </Col>

        <Col md={9} sm={24}>
          <div className="bc-mb-5">
            <FacebookCommunityCard facebookCommunityLink={pluginInfoData.facebookCommunity} />
          </div>
        </Col>
      </Row>

      <RecommendedPlugins />
    </div>
  )
}
