import { __ } from '../../admin/src/common/helpers/i18nWrap'
import fbCommunityImg from '../resources/img/fbCommunity.webp'
import { Button, Flex, theme, Typography } from 'antd'
import { LuFacebook } from 'react-icons/lu'

interface FBCommunityCardProps {
  facebookCommunityLink: string
}

const { Title } = Typography

export default function FacebookCommunityCard({ facebookCommunityLink }: FBCommunityCardProps) {
  const { token } = theme.useToken()

  return (
    <Flex
      align="center"
      className="bc-bg-white dark:bc-bg-slate-900"
      css={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 10,
        marginTop: 30,
        overflow: 'hidden',
        position: 'relative'
      }}
      gap={20}
      justify="center"
      vertical
    >
      <div
        css={{
          backgroundImage: `url(${fbCommunityImg})`,
          backgroundSize: 'cover',
          height: 165,
          width: '100%'
        }}
      />
      <Flex
        css={{
          background: 'linear-gradient(0deg, #00169a, transparent)',
          height: 205,
          paddingLeft: 20,
          position: 'absolute',
          top: '-11%',
          width: '100%'
        }}
        justify="end"
        vertical
      >
        <Title level={3} style={{ color: 'white' }}>
          {__('Join Our Facebook Community')}
        </Title>
        <p css={{ color: 'white', fontSize: 18 }}>
          {__('Connect, share, and grow with like-minded individuals')}
        </p>
      </Flex>
      <Flex css={{ marginBlock: 0 }} gap={15} justify="center" wrap>
        <span className="bc-whitespace-nowrap">🌟 {__('Exclusive Content')}</span>
        <span className="bc-whitespace-nowrap">💬 {__('Daily Discussion')}</span>
        <span className="bc-whitespace-nowrap">🎉 {__('Special Events')}</span>
      </Flex>

      <Button
        block
        css={{
          background: '#1877F2 !important',
          borderRadius: '100px !important',
          color: 'white !important',
          marginBottom: 20,
          width: '90%!important'
        }}
        href={facebookCommunityLink}
        icon={<LuFacebook />}
        size="large"
        target="_blank"
      >
        {__('Join Now')}
      </Button>
    </Flex>
  )
}
