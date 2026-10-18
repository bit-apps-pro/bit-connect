import { __ } from '@common/helpers/i18nWrap'
import { type AutoSaveState } from '@common/hooks/page-save'
import { Button, Spin, Typography } from 'antd'
import { LuCircleAlert, LuCircleCheck } from 'react-icons/lu'

const { Text } = Typography

interface SaveStatusProps extends AutoSaveState {
  /** Tries a failed save again now. Shown with every failure. */
  onRetry?: () => void
}

/**
 * Where a screen's saving stands, in place of a Save button.
 *
 * A live region, so a screen reader hears "Saved" or the reason a change was
 * refused without moving focus off the control that was changed.
 */
export default function SaveStatus({ error, onRetry, retrying, status }: SaveStatusProps) {
  let content
  switch (status) {
    case 'error': {
      content = (
        <span className="bc-inline-flex bc-flex-wrap bc-items-center bc-gap-x-2 bc-gap-y-1">
          <Text className="bc-inline-flex bc-items-center bc-gap-1.5" type="danger">
            <LuCircleAlert aria-hidden className="bc-shrink-0" size={14} />
            {`${__('Not saved.')} ${error ?? __('Try the change again.')}`}
            {retrying && ` ${__('Trying again…')}`}
          </Text>
          {/* Nothing to retry against offline: the save goes by itself on reconnecting. */}
          {onRetry && navigator.onLine && (
            <Button className="bc-h-auto bc-p-0" onClick={onRetry} size="small" type="link">
              {__('Retry now')}
            </Button>
          )}
        </span>
      )
      break
    }
    case 'invalid': {
      content = (
        <Text className="bc-inline-flex bc-items-center bc-gap-1.5" type="warning">
          <LuCircleAlert aria-hidden className="bc-shrink-0" size={14} />
          {`${__('Not saved yet.')} ${error ?? ''}`}
        </Text>
      )
      break
    }
    case 'pending':
    case 'saving': {
      content = (
        <Text type="secondary">
          <Spin className="bc-mr-2" size="small" />
          {__('Saving…')}
        </Text>
      )
      break
    }
    case 'saved': {
      content = (
        <Text className="bc-inline-flex bc-items-center bc-gap-1.5" type="secondary">
          <LuCircleCheck aria-hidden size={14} />
          {__('All changes saved')}
        </Text>
      )
      break
    }
    default: {
      content = <Text type="secondary">{__('Changes save automatically')}</Text>
    }
  }

  return (
    <div aria-live="polite" className="bc-text-sm" role="status">
      {content}
    </div>
  )
}
