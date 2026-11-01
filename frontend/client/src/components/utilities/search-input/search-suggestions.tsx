import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { Avatar, Spin } from 'antd'
import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react'
import {
  LuArrowBigUp,
  LuClock,
  LuFileText,
  LuHash,
  LuMessageCircle,
  LuSearch,
  LuTag,
  LuUser,
  LuX
} from 'react-icons/lu'

import { type MentionCandidate } from '@/components/quilTextEditor/mention-source'

import { type SearchScope } from './use-search-scope'
import { type TermSuggestion } from './use-search-suggestions'

export type SuggestionOption =
  | { kind: 'person'; person: MentionCandidate }
  | { kind: 'recent'; term: string }
  | { kind: 'search'; scope?: SearchScope; term: string }
  | { kind: 'term'; suggestion: TermSuggestion }
  | { kind: 'topic'; topic: Topic }

export interface SuggestionSection {
  /** A small action on the section's heading row — "Clear" on recent searches. */
  action?: { label: string; onClick: () => void }
  key: string
  label?: string
  /** Shown in place of rows while the section's first answer is on its way. */
  loading?: boolean
  options: SuggestionOption[]
}

interface SearchSuggestionsProps {
  activeIndex: number
  id: string
  onActivate: (index: number) => void
  onForgetRecent: (term: string) => void
  onSelect: (option: SuggestionOption) => void
  optionId: (index: number) => string
  query: string
  sections: SuggestionSection[]
}

/** The text with each case-insensitive occurrence of `query` in bold. */
function Highlight({ query, text }: { query: string; text: string }) {
  const needle = query.trim()
  if (needle === '') return <>{text}</>

  const escaped = needle.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <strong className="bc-font-semibold bc-text-ink" key={index}>
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

const ICON_BOX = 'bc-flex bc-h-8 bc-w-8 bc-shrink-0 bc-items-center bc-justify-center bc-rounded-full bc-bg-surface-hover bc-text-ink-muted'

function Row({ icon, meta, title }: { icon: ReactNode; meta?: ReactNode; title: ReactNode }) {
  return (
    <>
      {icon}
      <span className="bc-flex bc-min-w-0 bc-flex-1 bc-flex-col">
        <span className="bc-truncate bc-text-[14px] bc-text-ink-muted">{title}</span>
        {meta && <span className="bc-truncate bc-text-xs bc-text-ink-subtle">{meta}</span>}
      </span>
    </>
  )
}

function OptionBody({ option, query }: { option: SuggestionOption; query: string }) {
  switch (option.kind) {
    case 'person': {
      return (
        <Row
          icon={<Avatar className="bc-shrink-0" icon={<LuUser />} size={32} src={option.person.avatar || undefined} />}
          meta={`@${option.person.slug}`}
          title={<Highlight query={query} text={option.person.name} />}
        />
      )
    }
    case 'recent': {
      return <Row icon={<span className={ICON_BOX}><LuClock size={16} /></span>} title={option.term} />
    }
    case 'search': {
      return (
        <Row
          icon={
            <span className={cn(ICON_BOX, 'bc-text-primary')}>
              <LuSearch size={16} />
            </span>
          }
          title={
            <span className="bc-text-ink">
              {option.scope
                ? // translators: 1: what the visitor typed into the search box, 2: the group, tag or other term searched in
                  sprintf(__('Search for “%1$s” in %2$s'), option.term, option.scope.name)
                : // translators: %s: what the visitor typed into the search box
                  sprintf(__('Search for “%s”'), option.term)}
            </span>
          }
        />
      )
    }
    case 'term': {
      const { archive, name } = option.suggestion
      const Icon = archive.filter === 'tags' ? LuHash : LuTag

      return (
        <Row
          icon={
            <span className={ICON_BOX}>
              <Icon size={16} />
            </span>
          }
          meta={archive.label}
          title={<Highlight query={query} text={name} />}
        />
      )
    }
    case 'topic': {
      const { topic } = option
      const comments = Number(topic.comments_count || topic.comment_count || 0)

      return (
        <Row
          icon={
            <span className={ICON_BOX}>
              <LuFileText size={16} />
            </span>
          }
          meta={
            <span className="bc-inline-flex bc-items-center bc-gap-3">
              <span className="bc-inline-flex bc-items-center bc-gap-1">
                <LuArrowBigUp size={13} />
                {topic.vote?.total ?? 0}
              </span>
              <span className="bc-inline-flex bc-items-center bc-gap-1">
                <LuMessageCircle size={13} />
                {comments}
              </span>
              {topic.terms?.topic_types?.name && <span>{topic.terms.topic_types.name}</span>}
            </span>
          }
          title={<Highlight query={query} text={topic.post_title} />}
        />
      )
    }
  }
}

function optionKey(option: SuggestionOption) {
  switch (option.kind) {
    case 'person': {
      return `person-${option.person.id}`
    }
    case 'recent': {
      return `recent-${option.term}`
    }
    case 'search': {
      return option.scope ? 'search-scoped' : 'search'
    }
    case 'term': {
      return `term-${option.suggestion.archive.taxonomy}-${option.suggestion.slug}`
    }
    case 'topic': {
      return `topic-${option.topic.ID}`
    }
  }
}

// Every row keeps the field's focus: a mousedown that moved it would close
// the panel (it closes on blur) before the click could land.
const keepFocus = (event: MouseEvent) => event.preventDefault()

/**
 * The panel under the search box: grouped rows, one of them active, driven
 * by the field — which keeps focus throughout and announces the active row
 * through `aria-activedescendant`.
 */
export default function SearchSuggestions({
  activeIndex,
  id,
  onActivate,
  onForgetRecent,
  onSelect,
  optionId,
  query,
  sections
}: SearchSuggestionsProps) {
  // Arrow keys can walk past the panel's fold — People sits under five topics
  // and the terms — so the active row is brought into view as it moves.
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (activeIndex >= 0) listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  let index = -1

  return (
    // Not interactive itself: the mousedown only stops the field losing focus.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="bc-absolute bc-left-0 bc-right-0 bc-top-full bc-z-30 bc-mt-2 bc-max-h-[min(70vh,560px)] bc-overflow-y-auto bc-rounded-[12px] bc-border bc-border-solid bc-border-line bc-bg-surface bc-py-2 bc-shadow-lg"
      onMouseDown={keepFocus}
    >
      <ul aria-label={__('Search suggestions')} className="bc-m-0 bc-list-none bc-p-0" id={id} ref={listRef} role="listbox">
        {sections.map(section => (
          <li className="bc-m-0 bc-p-0" key={section.key} role="presentation">
            {section.label && (
              <div className="bc-flex bc-items-center bc-justify-between bc-px-4 bc-pb-1 bc-pt-2">
                <span className="bc-text-[11px] bc-font-semibold bc-text-ink-subtle">
                  {section.label}
                </span>
                {section.action && (
                  <button
                    className="bc-cursor-pointer bc-border-0 bc-bg-transparent bc-p-0 bc-text-xs bc-text-primary hover:bc-underline"
                    onClick={section.action.onClick}
                    tabIndex={-1}
                    type="button"
                  >
                    {section.action.label}
                  </button>
                )}
              </div>
            )}
            {section.loading && section.options.length === 0 ? (
              <div className="bc-flex bc-items-center bc-gap-2 bc-px-4 bc-py-2 bc-text-xs bc-text-ink-subtle">
                <Spin size="small" />
                {__('Searching…')}
              </div>
            ) : (
              <ul aria-label={section.label} className="bc-m-0 bc-list-none bc-p-0" role="group">
                {section.options.map(option => {
                  index += 1
                  const position = index
                  const active = position === activeIndex

                  // The keyboard reaches rows through the field, which owns
                  // focus and points at the active one with
                  // aria-activedescendant — the combobox pattern.
                  return (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <li
                      aria-selected={active}
                      className={cn([
                        'bc-group bc-m-0 bc-flex bc-cursor-pointer bc-items-center bc-gap-3 bc-px-4 bc-py-2',
                        active && 'bc-bg-surface-hover'
                      ])}
                      id={optionId(position)}
                      key={optionKey(option)}
                      onClick={() => onSelect(option)}
                      onMouseMove={() => {
                        if (!active) onActivate(position)
                      }}
                      role="option"
                    >
                      <OptionBody option={option} query={query} />
                      {option.kind === 'recent' && (
                        <button
                          aria-label={sprintf(__('Remove “%s” from recent searches'), option.term)}
                          className="bc-flex bc-h-7 bc-w-7 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded-full bc-border-0 bc-bg-transparent bc-text-ink-subtle hover:bc-bg-line hover:bc-text-ink"
                          onClick={event => {
                            event.stopPropagation()
                            onForgetRecent(option.term)
                          }}
                          tabIndex={-1}
                          type="button"
                        >
                          <LuX size={14} />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
