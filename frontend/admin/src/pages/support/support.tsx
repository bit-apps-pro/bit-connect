import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import Changelog from '@plugin-commons/components/Changelog'
import FacebookCommunityCard from '@plugin-commons/components/FacebookCommunityCard'
import pluginInfoData from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import Improvement from '@plugin-commons/components/SupportPage/Imporvement'
import SupportLinks from '@plugin-commons/components/SupportPage/SupportLinks'
import { Col, Row, theme, Typography } from 'antd'

import RecommendedPlugins from './internal/recommended-plugins'
import VersionPanel from './internal/version-panel'

const { Paragraph, Title } = Typography

/**
 * Support.
 *
 * Named for what it is in this plugin. There is no licence here to manage — no
 * key, no activation, no check — so "License & Support", which is what this
 * screen used to be called, named a thing that is not present. The add-on adds
 * activation and renames the entry to "Support & License"; see
 * `Menu.php::getLicenseMenuAttributes` and the add-on's `adminSidebarMenu`.
 *
 * Composed here rather than by importing the commons `SupportPage`, and the
 * reason is a WordPress.org rule rather than a preference. `SupportPage`
 * imports `License.pro` unconditionally — no `isPro()` guard, no stub — so
 * rendering it compiled the add-on's licence machinery into *this* plugin's
 * bundle: an activation call, a deactivation call, and a request to
 * `wp-api.bitapps.pro/public/verify-site` every 24 hours whose only job is to
 * decide whether paid features may run. Guideline 6 does not permit a hosted
 * plugin to carry that, dormant or not.
 *
 * It is done here, in Bit Connect's own tree, and not by patching the commons:
 * `pnpm plugin:commons:sync` empties and re-copies `frontend/_plugin-commons`
 * from the shared submodule, so a fix there would not survive the next sync.
 * Everything below is a commons component that makes no licence decision and
 * no undisclosed request, used unchanged; the licence half is reached through
 * the `.free`/`.pro` split every other pro surface already uses.
 *
 * The pro edition loses nothing: `version-panel.pro` renders the same commons
 * `License` component this screen used to, so activation, deactivation and the
 * update check are all still there — compiled from `pro/frontend`, into the
 * add-on's bundle only.
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

          {/*
            Always shown, unlike the other Bit Apps plugins, which gate this on
            the pro plugin existing. Bit Connect reports from the *free* plugin
            (Plugin::initWPTelemetry), so consent has to be reachable whether or
            not pro is installed — hiding it would mean reporting with no way to
            see that or stop it.
          */}
          <Improvement />

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
