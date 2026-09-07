import { useQuery } from '@tanstack/react-query'
import { Avatar, Card, Flex, Skeleton, theme, Typography } from 'antd'
import { useState } from 'react'
import { LuMoveUpRight } from 'react-icons/lu'

import { __ } from '../../../admin/src/common/helpers/i18nWrap'
import config from '../../../admin/src/config/config'

interface Plugin {
  description: string
  doc: string
  icon: string
  name: string
  slug: string
  url: string
}

interface SupportObject {
  bitAppsLogo: string
  pluginsList: Plugin[]
  supportEmail: string
  supportLink: string
}

const { Meta } = Card

const { Link, Text, Title } = Typography

/**
 * Where the recommended-plugin list comes from.
 *
 * Written out plainly. This endpoint is contacted from the admin screen and has
 * to be declared in each plugin's readme under External Services, so hiding it
 * from a source search would put the code and that declaration at odds — and a
 * split-up string is exactly what a plugin reviewer reads as something being
 * concealed.
 */
const SUPPORT_FETCH_URL = 'https://wp-api.bitapps.pro/public/plugins-info'

function RecommendedPlugins() {
  const { token } = theme.useToken()

  const [loading] = useState(false)

  const { data: supportInfo } = useQuery<SupportObject, Error>({
    queryFn: () => fetch(`${SUPPORT_FETCH_URL}`).then(res => res.json() as Promise<SupportObject>),
    queryKey: ['support'],
    staleTime: 1000 * 60 * 60 * 12 // 12 hours
  })

  return (
    <>
      <Title level={5}>{__('Recommended Plugins')}</Title>

      <Flex gap={15} wrap>
        {supportInfo?.pluginsList
          .filter(item => item.slug !== config.PLUGIN_SLUG)
          .map((plugin, index: number) => (
            <Card
              css={{ width: 400 }}
              key={`${index * 2}`}
              styles={{ body: { marginTop: 10, padding: 16 } }}
            >
              <Skeleton active avatar loading={loading}>
                <Meta
                  avatar={
                    <Link
                      css={{ '&:focus': { boxShadow: 'none' } }}
                      href={plugin.url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      <Avatar shape="square" src={plugin.icon} style={{ height: 70, width: 70 }} />
                    </Link>
                  }
                  description={
                    <Text style={{ color: token.colorTextSecondary }}>{plugin.description}</Text>
                  }
                  title={
                    <Link
                      css={{
                        '&:focus': { boxShadow: 'none' },
                        '&:hover': { textDecoration: 'underline !important' }
                      }}
                      href={plugin.url}
                      rel="noopener noreferrer nofollow"
                      style={{ color: token.colorTextSecondary, fontSize: '1rem' }}
                      target="_blank"
                    >
                      {plugin.name} <LuMoveUpRight size={12} style={{ transform: 'translateY(-4px)' }} />
                    </Link>
                  }
                />
              </Skeleton>
            </Card>
          ))}
      </Flex>
    </>
  )
}

export default RecommendedPlugins
