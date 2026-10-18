import { LazyMotion } from 'framer-motion'
import { type ReactNode } from 'react'

// framer-motion's `motion.*` components carry every animation feature with
// them. The `m.*` components are a thin shell that animates once this provider
// hands it the features — and those load as their own chunk, after the page
// has painted, instead of sitting in the bundle every visitor downloads first.
// domMax rather than domAnimation because the theme toggle and topic list use
// layout animations.
const loadFeatures = () => import('./motion-features').then(module => module.default)

/** Every `m.*` component must sit somewhere under this. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>
}
