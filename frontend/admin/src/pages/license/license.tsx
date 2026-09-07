import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import Changelog from '@plugin-commons/components/Changelog'
import FacebookCommunityCard from '@plugin-commons/components/FacebookCommunityCard'
import pluginInfoData from '@plugin-commons/components/SupportPage/data/pluginInfoData'
import Improvement from '@plugin-commons/components/SupportPage/Imporvement'
import RecommendedPlugins from '@plugin-commons/components/SupportPage/RecommendedPlugins'
import SupportLinks from '@plugin-commons/components/SupportPage/SupportLinks'
import { Col, Row, theme, Typography } from 'antd'

import LicenseSection from './internal/license-section'

const { Paragraph, Title } = Typography

/**
 * License & Support.
 *
 * Laid out the way the shared commons `SupportPage` lays it out, and built from
 * the same commons pieces — About, the diagnostic-reporting consent, the
 * changelog, support links, the community card and recommended plugins — but
 * assembled here rather than by calling `SupportPage` itself.
 *
 * That is the point of the file. `SupportPage` imports the commons `License`
 * component *unconditionally*, and that component is the add-on's licence
 * machinery: activation, deactivation, and a periodic call to a licence server.
 * Rendering it through `SupportPage` compiled all of that into the free bundle,
 * where it has no business being — a plugin on WordPress.org may not ship code
 * that decides whether its features may be used, and "it never fires without a
 * licence" is not the standard being applied. Composing the screen here lets
 * the licence half go through the `.free`/`.pro` split every other pro surface
 * in this plugin already uses, so the free build simply does not contain it.
 *
 * The cost is this file: ~40 lines of layout that has to be kept in step with
 * the commons version by hand. Worth it, and cheaper than the alternative —
 * `free/frontend/_plugin-commons` is emptied and re-copied by
 * `pnpm plugin:commons:sync`, so a fix made there would not survive the next
 * sync, while this file is the plugin's own and does.
 */
export default function License() {
  const { token } = theme.useToken()

  const aboutPlugin =
    pluginInfoData.plugins[config.PLUGIN_SLUG as keyof typeof pluginInfoData.plugins]

  return (
    <div className="bc-p-5">
      <Row gutter={20}>
        <Col md={15} sm={24}>
          <div className="bc-mb-12">
            <Title level={5}>
              {__('About')} {aboutPlugin?.title}
            </Title>
            <Paragraph style={{ color: token.colorTextSecondary }}>
              {aboutPlugin?.description}
            </Paragraph>
          </div>

          <LicenseSection />

          {/* Always on, unlike the other Bit Apps plugins, which gate this on
              the pro plugin existing. Bit Connect reports from the *free*
              plugin (Plugin::initWPTelemetry), so consent has to be reachable
              whether or not pro is installed — hiding it would mean reporting
              with no way to see that or stop it. */}
          <Improvement />

          <Changelog />

          <SupportLinks pluginSlug={config.PLUGIN_SLUG} />
        </Col>

        <Col md={9} sm={24}>
          <div className="bc-mb-5">
            {/* GiveReview deliberately absent: the cash-back offer it carries is
                a Bit Flows promotion, not something Bit Connect runs. */}
            <FacebookCommunityCard facebookCommunityLink={pluginInfoData.facebookCommunity} />
          </div>
        </Col>
      </Row>

      <RecommendedPlugins />
    </div>
  )
}
