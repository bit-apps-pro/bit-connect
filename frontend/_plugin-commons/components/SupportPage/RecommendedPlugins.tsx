import { __ } from '../../../admin/src/common/helpers/i18nWrap'
import config from '../../../admin/src/config/config'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Card, Flex, Skeleton, theme, Typography } from 'antd'
import { useState } from 'react'
import { LuMoveUpRight } from 'react-icons/lu'

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

const SUPPORT_FETCH_URL =
  'h_t_t_p_s_:_/_/w_p-ap_i_._b_i_ta_pp_s_._pro_/p_ub_li_c/p_lu_gi_ns-i_nf_o'.replaceAll('_', '')

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
