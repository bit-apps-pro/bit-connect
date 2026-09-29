import { __, sprintf } from '@common/helpers/i18nWrap'

/**
 * Four bands across the half circle, cold to warm: little of the roadmap has
 * shipped on the left, most of it on the right.
 */
const BANDS = ['#ff6b8a', '#f9b4c4', '#fde047', '#6ee07a']

const CX = 120
const CY = 120
const RADIUS = 96
const STROKE = 16
/** Degrees left open between bands. */
const GAP = 8

/** A point on the arc, `fraction` of the way from the left end to the right. */
function pointAt(fraction: number): [number, number] {
  const angle = Math.PI * (1 - fraction)
  return [CX + RADIUS * Math.cos(angle), CY - RADIUS * Math.sin(angle)]
}

function bandPath(start: number, end: number): string {
  const [x1, y1] = pointAt(start)
  const [x2, y2] = pointAt(end)
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2}`
}

interface ShippedGaugeProps {
  shipped: number
  /** The last stage's name — what "shipped" means on this forum. */
  stageName: string
  total: number
}

/** How much of the roadmap has reached its last stage, as a half-circle dial. */
export default function ShippedGauge({ shipped, stageName, total }: ShippedGaugeProps) {
  const fraction = total > 0 ? shipped / total : 0
  const percent = Math.round(fraction * 100)
  const band = Math.min(BANDS.length - 1, Math.floor(fraction * BANDS.length))
  const [knobX, knobY] = pointAt(fraction)
  const gap = GAP / 180

  return (
    <figure className="bc-m-0 bc-flex bc-flex-col bc-items-center">
      <div className="bc-relative bc-w-full bc-max-w-72">
        <svg
          aria-label={sprintf(__('%1$d%% of topics are in %2$s'), percent, stageName)}
          className="bc-block bc-w-full"
          role="img"
          viewBox={`0 0 ${CX * 2} ${CY + STROKE}`}
        >
          {BANDS.map((color, index) => {
            const start = index / BANDS.length + (index === 0 ? 0 : gap / 2)
            const end = (index + 1) / BANDS.length - (index === BANDS.length - 1 ? 0 : gap / 2)

            return (
              <path
                d={bandPath(start, end)}
                fill="none"
                key={color}
                stroke={color}
                strokeLinecap="round"
                strokeWidth={STROKE}
              />
            )
          })}
          <circle
            cx={knobX}
            cy={knobY}
            fill="var(--bc-surface)"
            r={STROKE / 2 + 2}
            stroke={BANDS[band]}
            strokeWidth={5}
          />
        </svg>

        {/* Sits in the bowl of the arc rather than under it, as on a dial. */}
        <div className="bc-absolute bc-inset-x-0 bc-bottom-0 bc-text-center">
          <div className="bc-text-5xl bc-font-semibold bc-leading-none bc-text-ink">{percent}%</div>
        </div>
      </div>
      {/* Full width so a long stage name wraps inside the card rather than
          sizing the caption past it. */}
      <figcaption className="bc-mt-2 bc-w-full bc-break-words bc-text-center bc-text-xs bc-text-ink-subtle">
        {sprintf(__('%1$d of %2$d topics in %3$s'), shipped, total, stageName)}
      </figcaption>
    </figure>
  )
}
