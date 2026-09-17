import { __ } from '@common/helpers/i18nWrap'

import { type ArchiveSegment, type SeoDiagnostics, type SeoSettings } from '../shared/types'
import SeoFieldRows, { type SeoField } from './seo-field-rows'

const SEGMENT_LABELS: Record<ArchiveSegment, string> = {
  department: __('Departments'),
  stage: __('Stages'),
  status: __('Statuses'),
  tag: __('Tags'),
  topic: __('Topic types')
}

/**
 * How public one taxonomy's archives are.
 *
 * These four are the whole of it. The screen used to offer three switches per
 * taxonomy — served, indexed, listed — which is eight combinations, of which
 * four are contradictions the backend refuses to honour: it will not index an
 * archive it does not serve, and will not list one it marks noindex. Those four
 * were reachable in the UI and did nothing, so Stages showed an "In sitemap"
 * switch sitting in the on position while the sitemap ignored it.
 *
 * Each step here adds to the one before it, which is exactly how the backend
 * gates them — see SeoSettings::archiveIndexable() and
 * PortalTaxonomies::isSitemapListed().
 */
export type ArchiveVisibility = 'indexed' | 'listed' | 'noindex' | 'off'

const VISIBILITY_ORDER: ArchiveVisibility[] = ['off', 'noindex', 'indexed', 'listed']

const VISIBILITY_LABELS: Record<ArchiveVisibility, string> = {
  indexed: __('Indexed, not in sitemap'),
  listed: __('Indexed and in sitemap'),
  noindex: __('Served, hidden from search'),
  off: __('Not served (404)')
}

/** The stored flags each choice writes. Later steps keep the earlier ones on. */
const VISIBILITY_FLAGS: Record<ArchiveVisibility, { index: boolean; route: boolean; sitemap: boolean }> =
  {
    indexed: { index: true, route: true, sitemap: false },
    listed: { index: true, route: true, sitemap: true },
    noindex: { index: false, route: true, sitemap: false },
    off: { index: false, route: false, sitemap: false }
  }

/** Which choice the stored flags amount to, read outermost gate first. */
export function visibilityOf(form: SeoSettings, segment: ArchiveSegment): ArchiveVisibility {
  if (!form.archives[segment]) return 'off'
  if (!form.indexArchives[segment]) return 'noindex'
  if (!form.sitemap.archives[segment]) return 'indexed'

  return 'listed'
}

interface ArchiveRowsProps {
  diagnostics: SeoDiagnostics
  disabled: boolean
  form: SeoSettings
  onChange: (segment: ArchiveSegment, visibility: ArchiveVisibility) => void
}

/**
 * One row per taxonomy: what it is, and how public its archives are.
 */
export default function ArchiveRows({ diagnostics, disabled, form, onChange }: ArchiveRowsProps) {
  const fields: SeoField[] = (Object.keys(SEGMENT_LABELS) as ArchiveSegment[]).map(segment => ({
    control: 'select',
    description: `/${segment}/${__('{name}')} · ${
      diagnostics.archives[segment]?.terms ?? 0
    } ${__('terms')}`,
    key: segment,
    label: SEGMENT_LABELS[segment],
    onChange: value => onChange(segment, value as ArchiveVisibility),
    options: VISIBILITY_ORDER.map(visibility => ({
      label: VISIBILITY_LABELS[visibility],
      value: visibility
    })),
    value: visibilityOf(form, segment)
  }))

  return <SeoFieldRows disabled={disabled} fields={fields} />
}

export { VISIBILITY_FLAGS }
