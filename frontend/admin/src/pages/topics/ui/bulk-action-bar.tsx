import { __, sprintf } from '@common/helpers/i18nWrap'
import { Button, Select } from 'antd'
import { type ReactNode, useState } from 'react'
import { LuX } from 'react-icons/lu'

import { type TopicAction } from '../shared/types'
import TermSelect, { type TermOption } from './term-select'

/** A bulk action that first needs a status or a stage picked. */
export interface TermAction {
  key: string
  label: string
  run: (ids: number[], termId: number) => Promise<unknown>
  terms: TermOption[]
}

interface BulkActionBarProps {
  /** Run as soon as it is picked — after its confirmation, when it has one. */
  actions: TopicAction[]
  isRunning: boolean
  onClear: () => void
  onRun: (action: TopicAction) => void
  selected: number[]
  termActions: TermAction[]
}

/**
 * What can be done to every selected topic at once. Sits above the table, and
 * only while something is selected.
 */
export default function BulkActionBar({
  actions,
  isRunning,
  onClear,
  onRun,
  selected,
  termActions
}: BulkActionBarProps): ReactNode {
  const [termActionKey, setTermActionKey] = useState<string>()
  const [termId, setTermId] = useState<number>()
  const termAction = termActions.find(action => action.key === termActionKey)

  if (selected.length === 0) return undefined

  return (
    <div className="bc-sticky bc-top-8 bc-z-10 bc-mb-3 bc-flex bc-flex-wrap bc-items-center bc-gap-2 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface-sunken bc-px-4 bc-py-3">
      <span className="bc-mr-2 bc-font-medium bc-text-ink">{sprintf(__('%d selected'), selected.length)}</span>

      {termActions.length > 0 && (
        <span className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
          <Select
            className="bc-min-w-[130px]"
            onChange={key => {
              setTermActionKey(key)
              setTermId(undefined)
            }}
            options={termActions.map(action => ({ label: action.label, value: action.key }))}
            placeholder={__('Set…')}
            size="small"
            value={termActionKey}
          />
          {termAction && (
            <TermSelect
              className="bc-min-w-[160px]"
              onChange={setTermId}
              placeholder={__('Choose')}
              size="small"
              terms={termAction.terms}
              value={termId}
            />
          )}
          <Button
            disabled={!termAction || !termId}
            loading={isRunning && Boolean(termAction)}
            onClick={() =>
              termAction &&
              termId &&
              void termAction.run(selected, termId).then(() => {
                setTermActionKey(undefined)
                setTermId(undefined)
              })
            }
            size="small"
            type="primary"
          >
            {__('Apply')}
          </Button>
        </span>
      )}

      {termActions.length > 0 && actions.length > 0 && <span aria-hidden className="bc-mx-1 bc-h-5 bc-w-px bc-bg-line" />}

      {actions.map(action => (
        <Button
          danger={action.danger}
          disabled={isRunning}
          icon={action.icon}
          key={action.key}
          onClick={() => onRun(action)}
          size="small"
        >
          {action.label}
        </Button>
      ))}

      <Button className="bc-ml-auto" icon={<LuX aria-hidden />} onClick={onClear} size="small" type="text">
        {__('Clear selection')}
      </Button>
    </div>
  )
}
