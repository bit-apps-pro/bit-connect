import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Flex, Typography } from 'antd'
import { useState } from 'react'
import { LuMoveUpRight } from 'react-icons/lu'

const { Meta } = Card
const { Link, Text, Title } = Typography

/**
 * The other Bit Apps plugins, fetched from the Bit Apps API.
 *
 * A deliberate local copy of the commons `SupportPage/RecommendedPlugins`,
 * which the commons sync leaves out of this tree: that version assembles its
 * endpoint from fragments at runtime, so the address is not searchable in the
 * source. The URL below is written plainly so anyone reading this file can
 * find it, and it is the endpoint documented under *External Services* in
 * `readme.txt`.
 *
 * Nothing is sent: it is a GET with no body, no key and no site identifier.
 * It is made only after an administrator asks for the list — opening the
 * screen alone contacts nobody, so no request leaves the site that the person
 * in front of it did not choose. The response is a list of plugins to link
 * to; a failure just says the list could not be loaded.
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
  const [requested, setRequested] = useState(false)

  const { data, isError, isFetching } = useQuery<PluginsInfoResponse, Error>({
    enabled: requested,
    queryFn: () =>
      fetch(RECOMMENDED_PLUGINS_URL).then(res => res.json() as Promise<PluginsInfoResponse>),
    queryKey: ['recommended-plugins'],
    staleTime: 1000 * 60 * 60 * 12
  })

  const plugins = data?.pluginsList?.filter(plugin => plugin.slug !== config.PLUGIN_SLUG) ?? []

  return (
    <>
      <Title level={5}>{__('Recommended Plugins')}</Title>

      {!requested && (
        <Flex align="flex-start" gap={8} vertical>
          <Text type="secondary">
            {__(
              'The list of other Bit Apps plugins is loaded from bitapps.pro only when you ask for it. Nothing about this site is sent.'
            )}
          </Text>
          <Button onClick={() => setRequested(true)}>{__('Show other Bit Apps plugins')}</Button>
        </Flex>
      )}

      {requested && isFetching && <Text type="secondary">{__('Loading…')}</Text>}

      {requested && !isFetching && (isError || plugins.length === 0) && (
        <Text type="secondary">{__('The list could not be loaded right now.')}</Text>
      )}

      {plugins.length > 0 && (
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
      )}
    </>
  )
}
