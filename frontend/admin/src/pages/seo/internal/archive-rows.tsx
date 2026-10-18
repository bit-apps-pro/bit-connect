import { __ } from '@common/helpers/i18nWrap'

import { type ArchiveSegment, type SeoDiagnostics, type SeoSettings } from '../shared/types'
import SeoFieldRows, { type SeoField } from './seo-field-rows'

/** This plugin's own archives, named here so the screen reads the same before the diagnostics load. */
const OWN_SEGMENT_LABELS: Record<string, string> = {
  stage: __('Stages'),
  status: __('Statuses'),
  tag: __('Tags'),
  topic: __('Topic types')
}

interface ArchiveRowsProps {
  diagnostics: SeoDiagnostics
  disabled: boolean
  form: SeoSettings
  onChange: (segment: ArchiveSegment, indexable: boolean) => void
}

/**
 * One row per taxonomy: what it is, and whether search engines see it.
 *
 * A single switch, because that is the whole of the choice. The screen once
 * offered four states per taxonomy; two were traps. Not serving an archive
 * 404'd the sidebar's own stage links on reload, and saved nothing a noindex
 * page does not. Indexing an archive while leaving it out of the sitemap only
 * made it slower to find. What remains is indexed and listed, or served to
 * visitors with noindex — see SeoSettings::archiveIndexable().
 *
 * The rows are the archives the server reports, so one a plugin adds is listed
 * with its own name and segment.
 */
export default function ArchiveRows({ diagnostics, disabled, form, onChange }: ArchiveRowsProps) {
  const segments = Object.keys(diagnostics.archives).length > 0
    ? Object.keys(diagnostics.archives)
    : Object.keys(OWN_SEGMENT_LABELS)

  const fields: SeoField[] = segments.map(segment => ({
    control: 'switch',
    description: (
      <span className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
        <code className="bc-rounded bc-bg-surface-sunken bc-px-1.5 bc-py-0.5 bc-text-xs bc-text-ink-muted">
          /{diagnostics.archives[segment]?.slug || segment}/{__('{name}')}
        </code>
        <span>
          {diagnostics.archives[segment]?.terms ?? 0} {__('terms')}
        </span>
      </span>
    ),
    key: segment,
    label: OWN_SEGMENT_LABELS[segment] ?? diagnostics.archives[segment]?.label ?? segment,
    onChange: value => onChange(segment, value),
    value: form.indexArchives[segment] ?? diagnostics.archives[segment]?.indexable ?? true
  }))

  return <SeoFieldRows disabled={disabled} fields={fields} />
}
