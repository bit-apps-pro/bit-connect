import { XOutlined } from '@ant-design/icons'
import { __ } from '../../../admin/src/common/helpers/i18nWrap'
import { Flex, theme, Typography } from 'antd'
import React from 'react'
import {
  LuBookCheck,
  LuFacebook,
  LuGlobe,
  LuLinkedin,
  LuMail,
  LuMessageCircle,
  LuMessagesSquare,
  LuMoveUpRight,
  LuYoutube
} from 'react-icons/lu'

import pluginInfoData from './data/pluginInfoData'

const { Link, Text, Title } = Typography

// Map of icon names to actual icon components
const iconMap: Record<string, React.ReactNode> = {
  'book-check': <LuBookCheck size={18} />,
  facebook: <LuFacebook size={18} />,
  globe: <LuGlobe size={18} />,
  linkedin: <LuLinkedin size={18} />,
  mail: <LuMail size={18} />,
  'message-circle': <LuMessageCircle size={18} />,
  'messages-square': <LuMessagesSquare size={18} />,
  youtube: <LuYoutube size={18} />
}

export default function SupportLinks({ pluginSlug }: { pluginSlug: string }) {
  const { token } = theme.useToken()

  const aboutPlugin = pluginInfoData.plugins[pluginSlug as keyof typeof pluginInfoData.plugins]

  const supportLinks = [
    {
      copyable: true,
      href: `mailto:${pluginInfoData.supportEmail}`,
      icon: 'mail',
      text: pluginInfoData.supportEmail
    },
    { href: aboutPlugin.website, icon: 'globe', text: 'Website' },
    { href: pluginInfoData.chatLink, icon: 'message-circle', text: 'Chat here' },
    { href: pluginInfoData.linkedIn, icon: 'linkedin', text: 'LinkedIn' },
    { href: aboutPlugin.docLink, icon: 'book-check', text: 'Documentation' },
    { href: pluginInfoData.youtubeChannel, icon: 'youtube', text: 'YouTube Channel' },
    { href: pluginInfoData.facebookCommunity, icon: 'facebook', text: 'Facebook Community' },
    { href: pluginInfoData.x, icon: <XOutlined />, text: 'X (Formerly Twitter)' },
    { href: aboutPlugin.wpSupportThread, icon: 'messages-square', text: 'WordPress Support Thread' }
  ]
  return (
    <div className="bc-mb-12">
      <Title level={5}>{__('Support')} </Title>

      <div css={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {supportLinks.map(({ copyable, href, icon, text }) => (
          <Text key={text}>
            <Flex gap={10}>
              {typeof icon === 'string' ? iconMap[icon] || undefined : icon}
              {copyable ? (
                <Text copyable={{ text }}>
                  <Link
                    href={href}
                    rel="noopener noreferrer nofollow"
                    strong
                    style={{ color: token.colorText }}
                    underline
                  >
                    {text}
                  </Link>
                </Text>
              ) : (
                <Link href={href} rel="noopener noreferrer nofollow" strong target="_blank">
                  {text}
                  <LuMoveUpRight size={12} style={{ transform: 'translateY(-4px)' }} />
                </Link>
              )}
            </Flex>
          </Text>
        ))}
      </div>
    </div>
  )
}
