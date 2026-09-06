import { __ } from '@common/helpers/i18nWrap'
import { Switch, Table, Tag, Tooltip, Typography } from 'antd'

import { type ArchiveSegment, type SeoDiagnostics, type SeoSettings } from '../shared/types'

const { Text } = Typography

const SEGMENT_LABELS: Record<ArchiveSegment, string> = {
  department: __('Departments'),
  stage: __('Stages'),
  status: __('Statuses'),
  tag: __('Tags'),
  topic: __('Topic types')
}

/** Workflow taxonomies: served for visitors, but nobody searches for a state. */
const WORKFLOW_SEGMENTS = new Set<ArchiveSegment>(['stage', 'status'])

/** The URL shape a segment serves, shown under its name. */
const urlPattern = (segment: ArchiveSegment) => `/${segment}/${__('{name}')}`

interface ArchiveMatrixProps {
  diagnostics: SeoDiagnostics
  disabled: boolean
  form: SeoSettings
  onArchive: (segment: string, value: boolean) => void
  onIndex: (segment: string, value: boolean) => void
  onSitemap: (segment: string, value: boolean) => void
}

interface Row {
  segment: ArchiveSegment
}

/**
 * Every archive decision for every taxonomy, in one grid.
 *
 * These are three switches per taxonomy — served, indexed, listed — and as
 * separate card sections they filled most of the screen while hiding the thing
 * that actually matters: how the three relate for a given taxonomy. Read across
 * a row and the dependency is obvious, which is also why the disabled states
 * carry a reason rather than just greying out.
 */
export default function ArchiveMatrix({
  diagnostics,
  disabled,
  form,
  onArchive,
  onIndex,
  onSitemap
}: ArchiveMatrixProps) {
  const rows: Row[] = (Object.keys(SEGMENT_LABELS) as ArchiveSegment[]).map(segment => ({ segment }))

  const columns = [
    {
      dataIndex: 'segment',
      key: 'taxonomy',
      render: (segment: ArchiveSegment) => (
        <div>
          <Text strong>{SEGMENT_LABELS[segment]}</Text>
          {WORKFLOW_SEGMENTS.has(segment) && (
            <Tooltip
              title={__(
                'A workflow state. Served so visitors can browse it, but left out of the index by default — nobody searches for "in progress", and the listing changes constantly.'
              )}
            >
              <Tag className="bc-ml-2" color="default">
                {__('workflow')}
              </Tag>
            </Tooltip>
          )}
          <div className="bc-text-xs bc-text-ink-subtle">
            {urlPattern(segment)} · {diagnostics.archives[segment]?.terms ?? 0} {__('terms')}
          </div>
        </div>
      ),
      title: __('Taxonomy')
    },
    {
      dataIndex: 'segment',
      key: 'route',
      render: (segment: ArchiveSegment) => (
        <Switch
          checked={form.archives[segment]}
          disabled={disabled}
          onChange={value => onArchive(segment, value)}
        />
      ),
      title: (
        <Tooltip title={__('Serve the archive URL at all. Switching this off makes it a 404.')}>
          <span>{__('Route')}</span>
        </Tooltip>
      ),
      width: 110
    },
    {
      dataIndex: 'segment',
      key: 'index',
      render: (segment: ArchiveSegment) => (
        <Tooltip title={form.archives[segment] ? '' : __('The route is switched off.')}>
          <Switch
            checked={form.indexArchives[segment]}
            disabled={disabled || !form.archives[segment]}
            onChange={value => onIndex(segment, value)}
          />
        </Tooltip>
      ),
      title: (
        <Tooltip title={__('Offer the archive to search engines rather than marking it noindex.')}>
          <span>{__('Indexed')}</span>
        </Tooltip>
      ),
      width: 110
    },
    {
      dataIndex: 'segment',
      key: 'sitemap',
      render: (segment: ArchiveSegment) => (
        <Tooltip
          title={
            form.indexArchives[segment]
              ? ''
              : __('Not indexed, so it is never listed — a sitemap asks for indexing.')
          }
        >
          <Switch
            checked={form.sitemap.archives[segment]}
            disabled={
              disabled ||
              !form.archives[segment] ||
              !form.indexArchives[segment] ||
              !form.sitemap.enabled
            }
            onChange={value => onSitemap(segment, value)}
          />
        </Tooltip>
      ),
      title: (
        <Tooltip title={__('List this taxonomy’s archives in the sitemap.')}>
          <span>{__('In sitemap')}</span>
        </Tooltip>
      ),
      width: 120
    }
  ]

  return <Table columns={columns} dataSource={rows} pagination={false} rowKey="segment" size="small" />
}
