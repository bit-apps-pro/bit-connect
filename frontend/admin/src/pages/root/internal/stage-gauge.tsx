import { __, sprintf } from '@common/helpers/i18nWrap'

import { type StageProgress } from '../shared/types'

const CX = 120
/** Room under the baseline for the rounding to spill into. */
const CY = 112
const OUTER = 106
const INNER = 76
/**
 * Half the stroke drawn round each band in its own colour. The stroke grows the
 * band by this much on every side and rounds its corners to this radius, so the
 * path itself is drawn that much smaller.
 */
const ROUNDING = 6
/** The visible space between two bands, the same width from rim to hub. */
const GAP = 5
/** The narrowest a stage with any topics is drawn, so a stage of one never vanishes. */
const MIN_SWEEP = 9

/** A point on a circle of `radius`, `degrees` of the way round from the left end. */
function pointAt(degrees: number, radius: number): string {
  const angle = Math.PI * (1 - degrees / 180)
  return `${CX + radius * Math.cos(angle)} ${CY - radius * Math.sin(angle)}`
}

/**
 * How many degrees to pull a band's edge back at `radius` so the space left
 * beside it is `half` wide: the same width in pixels needs more degrees near
 * the hub than at the rim, which is what keeps the gaps parallel rather than
 * wedge-shaped.
 */
const inset = (half: number, radius: number) => (half / radius) * (180 / Math.PI)

/**
 * One band of the half ring between the `start` and `end` boundaries, in
 * degrees. Ends that meet another band are trimmed for the gap; the two that
 * sit on the baseline are not.
 */
function bandPath(start: number, end: number): string {
  const outer = OUTER - ROUNDING
  const inner = INNER + ROUNDING
  const half = GAP / 2 + ROUNDING
  const trim = (at: number, radius: number, sign: -1 | 1) =>
    at <= 0 || at >= 180 ? at : at + sign * inset(half, radius)

  return [
    `M ${pointAt(trim(start, outer, 1), outer)}`,
    `A ${outer} ${outer} 0 0 1 ${pointAt(trim(end, outer, -1), outer)}`,
    `L ${pointAt(trim(end, inner, -1), inner)}`,
    `A ${inner} ${inner} 0 0 0 ${pointAt(trim(start, inner, 1), inner)}`,
    'Z'
  ].join(' ')
}

/**
 * Each stage's share of the 180 degrees. Stages under the minimum are lifted to
 * it and the others give up the difference in proportion, so the bands still
 * read largest to smallest in the right order.
 */
function sweeps(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0)
  const raw = counts.map(count => (count / total) * 180)
  const small = raw.map(sweep => sweep < MIN_SWEEP)
  const lifted = small.filter(Boolean).length * MIN_SWEEP
  const rest = raw.reduce((sum, sweep, index) => (small[index] ? sum : sum + sweep), 0)

  return raw.map((sweep, index) => (small[index] ? MIN_SWEEP : (sweep / rest) * (180 - lifted)))
}

interface StageGaugeProps {
  hues: Map<string, string>
  stages: StageProgress[]
}

/** Every topic on the roadmap as one half ring, a band per stage in the admin's order. */
export default function StageGauge({ hues, stages }: StageGaugeProps) {
  const filled = stages.filter(stage => stage.count > 0)
  const total = filled.reduce((sum, stage) => sum + stage.count, 0)
  const bands = filled.length > 0 ? sweeps(filled.map(stage => stage.count)) : []

  let cursor = 0
  const paths = filled.map((stage, index) => {
    const start = cursor
    cursor += bands[index]
    const color = hues.get(stage.name)

    return (
      <path
        d={bandPath(start, start + bands[index])}
        fill={color}
        key={stage.id}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={ROUNDING * 2}
      >
        <title>{sprintf(__('%1$s: %2$d'), stage.name, stage.count)}</title>
      </path>
    )
  })

  return (
    <div className="bc-relative bc-mx-auto bc-w-full bc-max-w-80">
      <svg
        aria-label={sprintf(
          __('%d topics: %s'),
          total,
          stages.map(stage => `${stage.name} ${stage.count}`).join(', ')
        )}
        className="bc-block bc-w-full bc-overflow-visible"
        role="img"
        viewBox={`0 0 ${CX * 2} ${CY + ROUNDING}`}
      >
        {total === 0 ? (
          <path
            d={bandPath(0, 180)}
            fill="var(--bc-surface-sunken)"
            stroke="var(--bc-surface-sunken)"
            strokeLinejoin="round"
            strokeWidth={ROUNDING * 2}
          />
        ) : (
          paths
        )}
      </svg>

      {/* In the bowl of the ring, as on a dial. */}
      <div aria-hidden className="bc-absolute bc-inset-x-0 bc-bottom-0 bc-text-center">
        <div className="bc-text-base bc-text-ink-muted">{__('Total topics')}</div>
        <div className="bc-text-5xl bc-font-bold bc-leading-tight bc-text-ink">
          {total.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
