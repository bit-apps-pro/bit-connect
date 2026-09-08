import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Card, Flex, Typography } from 'antd'
import { LuMoveUpRight } from 'react-icons/lu'

const { Meta } = Card
const { Link, Text, Title } = Typography

/**
 * The other Bit Apps plugins, fetched from the Bit Apps API.
 *
 * A deliberate local copy of the commons `SupportPage/RecommendedPlugins`,
 * kept here for one reason: the commons version assembles its endpoint as
 * `'h_t_t_p_s_:_/_/w_p-ap_i…'.replaceAll('_', '')`, so the address never
 * appears in the source as a string a reader — or a WordPress.org reviewer —
 * could search for. The URL below is written plainly, and it is the endpoint
 * documented under *External Services* in `readme.txt`.
 *
 * Nothing is sent: it is a GET with no body, no key and no site identifier,
 * and it is made only while an administrator is looking at this screen. The
 * response is a list of plugins to link to; a failure just renders nothing.
 */
const RECOMMENDED_PLUGINS_URL = 'https://wp-api.bitapps.pro/public/plugins-info'

interface Plugin {
  description: string
  doc: string
  icon: string
  name: string
  slug: string
  url: string
}

interface PluginsInfoResponse {
  bitAppsLogo: string
  pluginsList: Plugin[]
  supportEmail: string
  supportLink: string
}

export default function RecommendedPlugins() {
  const { data } = useQuery<PluginsInfoResponse, Error>({
    queryFn: () =>
      fetch(RECOMMENDED_PLUGINS_URL).then(res => res.json() as Promise<PluginsInfoResponse>),
    queryKey: ['recommended-plugins'],
    staleTime: 1000 * 60 * 60 * 12
  })

  const plugins = data?.pluginsList?.filter(plugin => plugin.slug !== config.PLUGIN_SLUG) ?? []

  if (plugins.length === 0) return

  return (
    <>
      <Title level={5}>{__('Recommended Plugins')}</Title>

      <Flex gap={15} wrap>
        {plugins.map(plugin => (
          <Card
            css={{ width: 400 }}
            key={plugin.slug}
            styles={{ body: { marginTop: 10, padding: 16 } }}
          >
            <Meta
              avatar={
                <Link href={plugin.url} rel="noopener noreferrer nofollow" target="_blank">
                  <Avatar shape="square" src={plugin.icon} style={{ height: 70, width: 70 }} />
                </Link>
              }
              description={<Text type="secondary">{plugin.description}</Text>}
              title={
                <Link
                  href={plugin.url}
                  rel="noopener noreferrer nofollow"
                  style={{ fontSize: '1rem' }}
                  target="_blank"
                >
                  {plugin.name}{' '}
                  <LuMoveUpRight size={12} style={{ transform: 'translateY(-4px)' }} />
                </Link>
              }
            />
          </Card>
        ))}
      </Flex>
    </>
  )
}
