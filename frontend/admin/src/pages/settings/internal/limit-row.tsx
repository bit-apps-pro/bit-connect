import { Typography } from 'antd'
import { type ReactNode } from 'react'

const { Text } = Typography

export interface LimitRowProps {
  hint?: string
  label: string
  /** The limit, as text or as the control that changes it. */
  value: ReactNode
}

/**
 * One limit, styled like every other setting row on the screen: its name and
 * value — text, or the control that changes it — on one line, what it means
 * beneath. Rows go in a `LimitRows` column.
 */
export default function LimitRow({ hint, label, value }: LimitRowProps) {
  return (
    <div className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-4 bc-py-3.5">
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-4">
        <Text className="bc-text-sm bc-font-medium bc-text-ink">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="bc-min-w-0 bc-text-right bc-text-sm bc-text-ink" strong>
            {value}
          </Text>
        ) : (
          value
        )}
      </div>
      {hint && (
        <Text className="bc-mt-1.5 bc-block bc-text-sm" type="secondary">
          {hint}
        </Text>
      )}
    </div>
  )
}

/** The column LimitRows sit in, spaced like SettingsSection's. */
export function LimitRows({ children }: { children: ReactNode }) {
  return <div className="bc-flex bc-flex-col bc-gap-3">{children}</div>
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

interface WpMediaSettings {
  bigImageThresholdPx: number
  maxUploadBytes: number
}

/** What WordPress and the server allow, sent with the page by Head.php. */
export function getWpMediaSettings(): undefined | WpMediaSettings {
  return (window as unknown as { bit_connect_?: { wpMediaSettings?: WpMediaSettings } }).bit_connect_
    ?.wpMediaSettings
}

export const ALLOWED_FILE_TYPES = 'JPEG, PNG, GIF, WebP, PDF, DOC, DOCX'
