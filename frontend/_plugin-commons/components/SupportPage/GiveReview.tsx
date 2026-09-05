import { __, sprintf } from '../../../admin/src/common/helpers/i18nWrap'
import config from '../../../admin/src/config/config'
import { Badge, Button } from 'antd'
import Link from 'antd/es/typography/Link'
import { LuDollarSign } from 'react-icons/lu'

import pluginInfoData from './data/pluginInfoData'

export default function GiveReview({ pluginSlug }: { pluginSlug: string }) {
  const aboutPlugin = pluginInfoData.plugins[pluginSlug as keyof typeof pluginInfoData.plugins]

  return (
    <div
      css={{
        animation: 'gradient-animation 5s ease infinite',
        background:
          'linear-gradient(135deg, hsla(260, 100%, 80%, 1) 0%, hsla(338, 100%, 71%, 1) 25%, hsla(215, 95%, 78%, 1) 55%, hsla(116, 41%, 78%, 1) 79%, hsla(330, 53%, 77%, 1) 100%)',
        backgroundSize: '300% 300%',
        borderRadius: 14,
        padding: 6
      }}
    >
      <Badge.Ribbon
        color="geekblue"
        text={
          <span css={{ fontSize: 16, padding: 5 }}>
            <LuDollarSign /> {__('Cash Back')}
          </span>
        }
      >
        <div
          css={{
            background: '#0c0029',
            borderRadius: 10,
            padding: 20
          }}
        >
          <h4 css={{ color: 'white!important' }}>
            {__('Hi')} {SERVER_VARIABLES.loggedInUserName} , <span css={{ fontSize: 23 }}>👋</span>
          </h4>
          <p css={{ color: '#ccccd5', fontSize: 16 }}>
            {__('We want your feedback!')}{' '}
            <Link href={aboutPlugin.reviewLink}>{__('Write a review')}</Link>
            {sprintf(__("of your experience with %s, and we'll send you a"), config.PRODUCT_NAME)}
            <b style={{ color: 'white' }}>{__('$10 Cash back')}</b> {__('to say thanks!')}
            <br />
            {__(
              'To claim your cash back, simply reply to support with a screenshot or link of your review.'
            )}
            <br />
          </p>
          <Button
            block
            css={{
              background: '#a300ff!important',
              borderRadius: '100px!important',
              color: 'white!important',
              marginTop: 10
            }}
            href={aboutPlugin.reviewLink}
            icon="💬"
            rel="noopener noreferrer"
            size="large"
            target="_blank"
            type="primary"
          >
            {__('Review Now')}
          </Button>
        </div>
      </Badge.Ribbon>
    </div>
  )
}
