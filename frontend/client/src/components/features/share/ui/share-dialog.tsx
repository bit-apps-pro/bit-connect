import { __ } from '@common/helpers/i18nWrap'
import useCopyToClipboard from '@common/hooks/useCopyToClipboard'
import { Button, Input, Modal, Typography } from 'antd'
import { type CSSProperties } from 'react'
import { LuCheck, LuCopy, LuShare2 } from 'react-icons/lu'

import { canShareNatively, SHARE_CHANNELS } from '../shared/share-targets'
import useShareStore from '../state/use-share-store'
import styles from './share-dialog.module.css'

const { Text } = Typography

/**
 * Dismissing the OS share sheet rejects with AbortError exactly as a real
 * failure does. Named rather than an empty arrow so the silence reads as a
 * decision — there is nothing to report when someone changes their mind, and
 * the dialog is still open behind it with every other option on it.
 */
const ignoreShareDismissal = (): void => undefined

/**
 * The share dialog, mounted once for the page.
 *
 * Opened through the store from the topic header or any comment row, which each
 * supply their own link — a thread has hundreds of rows and needs one dialog,
 * not hundreds.
 */
export default function ShareDialog() {
  const { close, isOpen, target } = useShareStore()
  const { copied, copy } = useCopyToClipboard()

  const url = target?.url ?? ''
  const title = target?.title ?? ''
  const isComment = target?.type === 'comment'

  // Read once per render rather than held in state: the answer cannot change
  // while the page is open, and calling it during render keeps the button out
  // of the tree entirely on browsers without it instead of flashing it away.
  const hasNativeShare = canShareNatively()

  const shareNatively = () => {
    navigator.share({ text: title, title, url }).catch(ignoreShareDismissal)
  }

  return (
    <Modal
      centered
      // antd reads `null` as "no footer"; `undefined` falls back to its default
      // OK/Cancel pair, which this dialog has no use for.
      // eslint-disable-next-line unicorn/no-null
      footer={null}
      onCancel={close}
      open={isOpen}
      title={isComment ? __('Share this reply') : __('Share this topic')}
      width={440}
    >
      {/* What is being sent, so the link in the field below is never a guess.
          A reply says so in words rather than showing its own text: the row it
          was opened from is still on screen behind the dialog. */}
      <Text className="bc-mb-3 bc-block bc-text-sm bc-text-ink-muted" ellipsis={{ tooltip: title }}>
        {isComment ? __('Links straight to this reply in') : ''} {title}
      </Text>

      <div className={styles.channels}>
        {SHARE_CHANNELS.map(channel => {
          const Icon = channel.icon

          return (
            <a
              className={styles.channel}
              href={channel.href(url, title)}
              key={channel.key}
              // `noopener` is what matters — a share window opened with
              // `window.opener` live can navigate this tab out from under the
              // reader. `noreferrer` goes with it so the network is not handed
              // the referring URL before anyone has agreed to share it.
              rel="noopener noreferrer"
              style={
                {
                  '--share-brand': channel.brand,
                  '--share-brand-dark': channel.brandDark ?? channel.brand
                } as CSSProperties
              }
              target="_blank"
            >
              <span className={styles.channelIcon}>
                <Icon size={20} />
              </span>
              {channel.label}
            </a>
          )
        })}
      </div>

      <Text className="bc-mb-1.5 bc-block bc-text-xs bc-font-medium bc-text-ink-muted">
        {__('Or copy the link')}
      </Text>

      <div className={styles.linkRow}>
        <Input
          aria-label={__('Link to share')}
          className={styles.linkField}
          data-testid="share-link"
          onFocus={event => event.target.select()}
          readOnly
          value={url}
        />
        {/* The label changes with the state as well as the icon: a tick alone
            asks the reader to work out what it is confirming. */}
        <Button
          data-testid="share-copy-button"
          icon={copied ? <LuCheck /> : <LuCopy />}
          onClick={() => copy(url)}
          type={copied ? 'default' : 'primary'}
        >
          {copied ? __('Copied') : __('Copy')}
        </Button>
      </div>

      {hasNativeShare && (
        <Button block className="bc-mt-3" icon={<LuShare2 />} onClick={shareNatively} type="text">
          {__('More sharing options')}
        </Button>
      )}
    </Modal>
  )
}
