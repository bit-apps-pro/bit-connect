import { ConfigProvider, Segmented, theme } from 'antd'
import { type ReactNode, useMemo } from 'react'

export interface PageTab {
  icon: ReactNode
  key: string
  label: string
}

interface PageTabsProps {
  onChange: (key: string) => void
  /** Built once: new option nodes mid-switch cut antd's thumb slide short. */
  tabs: PageTab[]
  value: string
}

/**
 * The tab bar a settings page switches its panels with: a filled pill for the
 * open tab, so it reads as a switch between panels rather than as links.
 *
 * The same bar the General page draws, and kept identical to it — theme tokens,
 * spacing and the width-holding labels — so moving between the two screens
 * does not change how a tab looks.
 */
export default function PageTabs({ onChange, tabs, value }: PageTabsProps) {
  const { token } = theme.useToken()

  // The bold copy is invisible and only holds width, so the open tab turning
  // semibold does not nudge its neighbours sideways.
  const options = useMemo(
    () =>
      tabs.map(tab => ({
        label: (
          <span className="bc-flex bc-items-center bc-gap-2 bc-leading-none">
            {tab.icon}
            <span className="bc-grid">
              <span aria-hidden className="bc-invisible bc-col-start-1 bc-row-start-1 bc-font-semibold">
                {tab.label}
              </span>
              <span className="bc-col-start-1 bc-row-start-1">{tab.label}</span>
            </span>
          </span>
        ),
        value: tab.key
      })),
    [tabs]
  )

  return (
    <ConfigProvider
      theme={{
        components: {
          Segmented: {
            // Hover a shade lighter than antd's, so it reads as a hint and
            // never as a second open tab beside the blue one.
            itemActiveBg: token.colorFillSecondary,
            itemHoverBg: token.colorFillTertiary,
            itemHoverColor: token.colorText,
            itemSelectedBg: token.colorPrimary,
            itemSelectedColor: token.colorTextLightSolid,
            trackBg: 'var(--bc-surface)',
            trackPadding: 8
          }
        },
        // A 36px pill and 20px either side of each label; radii here rather
        // than as classes, which antd's own styles outrank. See General.
        token: {
          borderRadius: 14,
          borderRadiusSM: 8,
          controlHeight: 52,
          controlPaddingHorizontal: 21,
          motionDurationMid: '0.15s',
          motionDurationSlow: '0.45s',
          motionEaseInOut: 'cubic-bezier(0.32, 0.72, 0, 1)'
        }
      }}
    >
      <Segmented
        className="bc-max-w-full bc-overflow-x-auto bc-border bc-border-solid bc-border-line [&_.ant-segmented-item-label]:bc-flex [&_.ant-segmented-item-label]:bc-items-center [&_.ant-segmented-item-selected]:bc-font-semibold [&_.ant-segmented-group]:bc-gap-1"
        onChange={next => onChange(String(next))}
        options={options}
        value={value}
      />
    </ConfigProvider>
  )
}
