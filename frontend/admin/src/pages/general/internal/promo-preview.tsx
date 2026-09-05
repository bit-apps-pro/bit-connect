import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { LuArrowUpRight, LuSparkles } from 'react-icons/lu'

import { type Promo } from '../shared/types'

const { Text } = Typography

/** How long each phrase is held before the next one takes its place. */
const ROTATE_MS = 2200

/**
 * The promo card as the sidebar will render it.
 *
 * Six separate fields with no default copy are hard to picture from the form
 * alone — an empty one is a row that simply will not be there. This shows the
 * card that is actually going to appear, at roughly the width it appears at.
 */
export default function PromoPreview({ promo }: { promo: Promo }) {
  const phrases = promo.phrases.map(phrase => phrase.trim()).filter(Boolean)
  const [index, setIndex] = useState(0)
  // The card on the portal types its phrases out; this one swaps them. Either
  // way it is an advert animating on its own, so someone who asked for less
  // motion gets the first phrase and nothing moving.
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (phrases.length < 2 || shouldReduceMotion) return
    const id = window.setInterval(() => setIndex(current => current + 1), ROTATE_MS)
    return () => window.clearInterval(id)
  }, [phrases.length, shouldReduceMotion])

  const eyebrow = promo.eyebrow.trim()
  const headline = promo.headline.trim()
  const prefix = promo.prefix.trim()
  const cta = promo.cta.trim()
  const phrase = phrases.length > 0 ? phrases[index % phrases.length] : ''
  const isEmpty =
    eyebrow === '' && headline === '' && cta === '' && prefix === '' && phrases.length === 0

  return (
    <div className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface-sunken bc-p-4">
      <Text className="bc-mb-3 bc-block bc-text-xs bc-uppercase bc-tracking-wide" type="secondary">
        {__('Preview')}
      </Text>

      {isEmpty ? (
        <div className="bc-rounded-md bc-border bc-border-dashed bc-border-line-strong bc-px-3 bc-py-6 bc-text-center">
          <Text className="bc-text-sm" type="secondary">
            {__('Every field is empty, so no card is shown.')}
          </Text>
        </div>
      ) : (
        // `layout` on the card: rows come and go as fields are filled in, and
        // the preview should grow into its new size rather than jump while
        // someone is still typing into the field that caused it.
        <motion.div
          className="bc-max-w-[240px] bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-gradient-to-br bc-from-primary/10 bc-via-transparent bc-to-primary/5 bc-px-3 bc-py-2.5"
          layout
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {eyebrow !== '' && (
            <span className="bc-flex bc-items-center bc-gap-1.5 bc-text-[11px] bc-font-medium bc-uppercase bc-tracking-wide bc-text-ink-muted">
              <LuSparkles aria-hidden className="bc-shrink-0 bc-text-primary" size={12} />
              {eyebrow}
            </span>
          )}

          {headline !== '' && (
            <span className="bc-mt-1 bc-block bc-text-sm bc-font-semibold bc-text-ink">{headline}</span>
          )}

          {(prefix !== '' || phrase !== '') && (
            <span className="bc-mt-1 bc-block bc-min-h-[2rem] bc-text-[11px] bc-leading-[1.4] bc-text-ink-subtle">
              {prefix !== '' && `${prefix} `}
              {/* One phrase leaves before the next arrives, in the same place:
                  two lines crossing over each other in a 240px card is just a
                  smudge. */}
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="bc-inline-block bc-font-medium bc-text-info"
                  exit={{ opacity: 0, y: -4 }}
                  initial={{ opacity: 0, y: 4 }}
                  key={phrase}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {phrase}
                </motion.span>
              </AnimatePresence>
            </span>
          )}

          {cta !== '' && (
            <span className="bc-mt-1 bc-flex bc-items-center bc-gap-1 bc-text-[11px] bc-text-ink-subtle">
              {cta}
              {promo.url.trim() !== '' && (
                <LuArrowUpRight aria-hidden className="bc-shrink-0" size={12} />
              )}
            </span>
          )}
        </motion.div>
      )}

      <Text className="bc-mt-3 bc-block bc-text-xs" type="secondary">
        {phrases.length > 1
          ? __('The last line is typed out one phrase at a time.')
          : __('Shown at the foot of the portal sidebar.')}
      </Text>
    </div>
  )
}
