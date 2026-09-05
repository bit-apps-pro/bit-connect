import { __ } from '@common/helpers/i18nWrap'
import { Input, Switch, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'

import { type Promo } from '../shared/types'
import { revealVariants } from './motion'
import PromoPreview from './promo-preview'
import SectionCard from './section-card'

const { Text } = Typography
const { TextArea } = Input

/** Mirrors the server's per-line cap on the promo card's copy. */
const PROMO_TEXT_MAX = 80

/** Mirrors the server's cap on how many phrases the card rotates through. */
const PROMO_PHRASE_MAX = 10

/**
 * The textarea, one phrase per line, as the card will read them.
 *
 * Blank lines are dropped rather than stored: an empty phrase types nothing and
 * reads as the animation having stalled.
 */
const splitPhrases = (value: string) =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, PROMO_PHRASE_MAX)

interface PromoSectionProps {
  disabled: boolean
  onPatch: (values: Partial<Promo>) => void
  onPhrasesDraftChange: (value: string) => void
  phrasesDraft: string
  promo: Promo
}

/** A labelled field with its own hint, for the promo card's free-text rows. */
function Field({ children, hint, label }: { children: React.ReactNode; hint?: string; label: string }) {
  return (
    <div>
      <Text className="bc-mb-2 bc-block" strong>
        {label}
      </Text>
      {children}
      {hint && (
        <Text className="bc-mt-1 bc-block bc-text-sm" type="secondary">
          {hint}
        </Text>
      )}
    </div>
  )
}

export default function PromoSection({
  disabled,
  onPatch,
  onPhrasesDraftChange,
  phrasesDraft,
  promo
}: PromoSectionProps) {
  return (
    <SectionCard
      extra={
        <div className="bc-flex bc-items-center bc-gap-2">
          <Text type="secondary">{__('Show the card')}</Text>
          <Switch
            checked={promo.enabled}
            disabled={disabled}
            onChange={checked => onPatch({ enabled: checked })}
          />
        </div>
      }
      subtitle={__(
        'A small card at the foot of the portal sidebar: a headline, a rotating line of text, and a link. Off by default — it appears on your public pages, so it is your call.'
      )}
      title={__('Sidebar promo card')}
    >
      {/* Only once it is on: a column of empty fields under an off switch
          reads as something waiting to be filled in. The fields open out of the
          switch rather than appearing whole, so it is obvious that the switch
          is what put them there. */}
      <AnimatePresence initial={false} mode="wait">
        {promo.enabled ? (
          <motion.div
            animate="show"
            className="bc-overflow-hidden"
            exit="exit"
            initial="hidden"
            key="fields"
            variants={revealVariants}
          >
            <div className="bc-grid bc-gap-6 bc-py-5 lg:bc-grid-cols-[minmax(0,1fr)_260px]">
              <div className="bc-flex bc-flex-col bc-gap-4">
                <Text className="bc-text-sm" type="secondary">
                  {__(
                    'Every line is yours to write, and any you leave empty is simply left off the card. Fill in none of them and no card is shown.'
                  )}
                </Text>

                <div className="bc-grid bc-gap-4 md:bc-grid-cols-2">
                  <Field label={__('Top line')}>
                    <Input
                      disabled={disabled}
                      maxLength={PROMO_TEXT_MAX}
                      onChange={e => onPatch({ eyebrow: e.target.value })}
                      placeholder={__('e.g. A Bit Apps product')}
                      value={promo.eyebrow}
                    />
                  </Field>

                  <Field label={__('Headline')}>
                    <Input
                      disabled={disabled}
                      maxLength={PROMO_TEXT_MAX}
                      onChange={e => onPatch({ headline: e.target.value })}
                      placeholder={__('e.g. Built with Bit Connect')}
                      value={promo.headline}
                    />
                  </Field>
                </div>

                <Field
                  hint={__('Stays put while the phrases below are typed out after it.')}
                  label={__('Text before the rotating line')}
                >
                  <Input
                    disabled={disabled}
                    maxLength={PROMO_TEXT_MAX}
                    onChange={e => onPatch({ prefix: e.target.value })}
                    placeholder={__('e.g. We also build')}
                    value={promo.prefix}
                  />
                </Field>

                <Field
                  hint={__(
                    'One phrase per line, typed out in turn. Up to 10, and short ones read best in a narrow sidebar.'
                  )}
                  label={__('Rotating text')}
                >
                  {/* Bound to a draft string, not to the array: cleaning as you
                  type would eat the newline the moment you press Enter. */}
                  <TextArea
                    disabled={disabled}
                    onChange={e => {
                      onPhrasesDraftChange(e.target.value)
                      onPatch({ phrases: splitPhrases(e.target.value) })
                    }}
                    placeholder={[
                      __('e.g. smart WordPress forms'),
                      __('no-code automations'),
                      __('communities like this')
                    ].join('\n')}
                    rows={4}
                    value={phrasesDraft}
                  />
                </Field>

                <div className="bc-grid bc-gap-4 md:bc-grid-cols-2">
                  <Field label={__('Link label')}>
                    <Input
                      disabled={disabled}
                      maxLength={PROMO_TEXT_MAX}
                      onChange={e => onPatch({ cta: e.target.value })}
                      placeholder={__('e.g. Explore our plugins')}
                      value={promo.cta}
                    />
                  </Field>

                  <Field
                    hint={__(
                      'Opened in a new tab. Without one the card is plain text rather than a link.'
                    )}
                    label={__('Link')}
                  >
                    <Input
                      disabled={disabled}
                      onChange={e => onPatch({ url: e.target.value })}
                      placeholder="https://bitapps.pro"
                      value={promo.url}
                    />
                  </Field>
                </div>
              </div>

              <PromoPreview promo={promo} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            animate="show"
            className="bc-overflow-hidden"
            exit="exit"
            initial="hidden"
            key="hidden-note"
            variants={revealVariants}
          >
            <div className="bc-py-5">
              <Text type="secondary">{__('The card is hidden. Turn it on to write what it says.')}</Text>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionCard>
  )
}
