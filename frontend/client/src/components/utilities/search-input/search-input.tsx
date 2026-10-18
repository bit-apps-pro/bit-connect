import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { userProfilePath } from '@utilities/user-link'
import { archivePath } from '@utils/listing-path'
import { routePath } from '@utils/route-path'
import { Input, type InputRef } from 'antd'
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useDebounce } from 'react-use'

import { clearRecentSearches, forgetSearch, readRecentSearches, rememberSearch } from './recent-searches'
import SearchSuggestions, { type SuggestionOption, type SuggestionSection } from './search-suggestions'
import useSearchScope, { type SearchScope } from './use-search-scope'
import useSearchSuggestions from './use-search-suggestions'

const QUERY_KEY = 'search'

/** Wait this long after the last keystroke before asking the server. */
const SUGGEST_DELAY_MS = 200

interface SearchInputProps {
  className?: string
  /** Take focus on mount — the phone-width row opens because someone tapped search. */
  focusOnMount?: boolean
  /** Escape pressed, or a suggestion chosen — the phone-width row closes itself on it. */
  onDismiss?: () => void
  /** Show the `/` shortcut hint and listen for it. Desktop only: phones have no key to press. */
  withShortcut?: boolean
}

/** Whether focus is somewhere typing already means something. */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

/**
 * The portal's one search box, in the header on every page.
 *
 * Works the way large forums' boxes do: focus it and your recent searches
 * drop down; type and it suggests topics, the tags and other terms whose
 * name matches, and members, with "Search for …" last. Arrow keys move
 * through them and Enter opens the one highlighted — or, with none, runs the
 * full search, whose results are the topic list at `/?search=…`.
 *
 * On a term archive — a board, a tag — the box searches inside it, shown as a
 * chip before the text: suggestions and results stay in that archive, whose
 * results are its own page with `?search=…`. Removing the chip (its ×, or
 * Backspace in an empty field) searches everything instead, and "Search for
 * … " everywhere is always offered beside the scoped row.
 */
export default function SearchInput({
  className,
  focusOnMount = false,
  onDismiss,
  withShortcut = false
}: SearchInputProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef<InputRef>(null)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recent, setRecent] = useState<string[]>([])

  const scope = useSearchScope()
  const scopeKey = scope ? `${scope.archive.filter}/${scope.slug}` : ''
  const [scopeDropped, setScopeDropped] = useState(false)
  // Each archive offers its scope afresh, however the last one was left.
  useEffect(() => {
    setScopeDropped(false)
  }, [scopeKey])
  const activeScope = scopeDropped ? undefined : scope

  const onResults = location.pathname.split('/').filter(Boolean).length === 0
  const urlTerm = onResults || scope ? searchParams.get(QUERY_KEY) || '' : ''
  const [term, setTerm] = useState(urlTerm)

  // Follow the URL when it moves underneath the field — Back, a link to the
  // list, leaving it for a topic.
  useEffect(() => {
    setTerm(urlTerm)
  }, [urlTerm])

  const [suggestTerm, setSuggestTerm] = useState(term)
  useDebounce(() => setSuggestTerm(term), SUGGEST_DELAY_MS, [term])
  const suggestions = useSearchSuggestions(suggestTerm, activeScope)

  const query = term.trim()

  const sections = useMemo<SuggestionSection[]>(() => {
    if (query === '') {
      return recent.length > 0
        ? [
            {
              action: { label: __('Clear'), onClick: () => setRecent(clearRecentSearches()) },
              key: 'recent',
              label: __('Recent searches'),
              options: recent.map(item => ({ kind: 'recent' as const, term: item }))
            }
          ]
        : []
    }

    // Rows for a term the debounce has not caught up with yet would be the
    // previous term's, so until it has, only "Search for" is offered.
    const current = suggestTerm.trim() === query && suggestions.enabled

    return [
      ...(current && (suggestions.topics.length > 0 || suggestions.isFetching)
        ? [
            {
              key: 'topics',
              label: __('Topics'),
              loading: suggestions.isFetching,
              options: suggestions.topics.map(topic => ({ kind: 'topic' as const, topic }))
            }
          ]
        : []),
      ...(current && suggestions.terms.length > 0
        ? [
            {
              key: 'terms',
              label: __('Browse'),
              options: suggestions.terms.map(suggestion => ({ kind: 'term' as const, suggestion }))
            }
          ]
        : []),
      ...(current && suggestions.people.length > 0
        ? [
            {
              key: 'people',
              label: __('People'),
              options: suggestions.people.map(person => ({ kind: 'person' as const, person }))
            }
          ]
        : []),
      {
        key: 'search',
        options: [
          ...(activeScope ? [{ kind: 'search' as const, scope: activeScope, term: query }] : []),
          { kind: 'search' as const, term: query }
        ]
      }
    ]
  }, [activeScope, query, recent, suggestTerm, suggestions])

  const options = useMemo(() => sections.flatMap(section => section.options), [sections])
  const panelOpen = open && options.length > 0

  // A new list of rows starts with none highlighted, so Enter means "search".
  useEffect(() => {
    setActiveIndex(-1)
  }, [options.length, query])

  const openPanel = () => {
    setRecent(readRecentSearches())
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setActiveIndex(-1)
  }

  const finish = () => {
    close()
    inputRef.current?.blur()
    onDismiss?.()
  }

  const runSearch = (value: string, within: SearchScope | undefined) => {
    const next = value.trim()
    if (next === '') return

    setRecent(rememberSearch(next))
    setTerm(next)

    if (within) {
      // The archive's own page, fresh: a board's other tabs and the list's
      // filters belong to browsing it, not to a search inside it.
      navigate(`${archivePath(within.archive.filter, within.slug)}?${QUERY_KEY}=${encodeURIComponent(next)}`)
    } else if (onResults) {
      // On the list already: keep its sort and filters, start from page one.
      setSearchParams(prev => {
        if (prev.has('page')) prev.set('page', '1')
        prev.set(QUERY_KEY, next)
        return prev
      })
    } else {
      navigate(routePath(`/?${QUERY_KEY}=${encodeURIComponent(next)}`))
    }

    finish()
  }

  const select = (option: SuggestionOption) => {
    switch (option.kind) {
      case 'person': {
        navigate(userProfilePath(option.person.slug || String(option.person.id)))
        break
      }
      case 'recent': {
        runSearch(option.term, activeScope)
        return
      }
      case 'search': {
        runSearch(option.term, option.scope)
        return
      }
      case 'term': {
        navigate(archivePath(option.suggestion.archive.filter, option.suggestion.slug))
        break
      }
      case 'topic': {
        navigate(routePath(`/${option.topic.post_name}`))
        break
      }
    }

    // Opening a suggestion still counts as having searched for the term.
    if (query !== '') rememberSearch(query)
    setTerm(urlTerm)
    finish()
  }

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus()
  }, [focusOnMount])

  useEffect(() => {
    if (!withShortcut) return

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      inputRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [withShortcut])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!panelOpen) {
          openPanel()
          return
        }
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        // -1 is the field itself, between the last row and the first.
        setActiveIndex(current => ((current + step + 1 + options.length + 1) % (options.length + 1)) - 1)
        break
      }
      case 'Backspace': {
        // As in other forums' boxes: backspacing past the start of the text
        // removes the scope chip, leaving a search of everything.
        if (activeScope && term === '') setScopeDropped(true)
        break
      }
      case 'Enter': {
        event.preventDefault()
        const active = panelOpen ? options[activeIndex] : undefined
        if (active) select(active)
        else runSearch(term, activeScope)
        break
      }
      case 'Escape': {
        if (panelOpen) close()
        else finish()
        break
      }
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`
  const showHint = withShortcut && !focused && term === ''

  const scopeChip = activeScope && (
    <span className="bc-mr-1 bc-inline-flex bc-max-w-[160px] bc-shrink-0 bc-items-center bc-gap-1 bc-rounded-full bc-border bc-border-solid bc-border-line bc-bg-surface bc-py-0.5 bc-pl-2.5 bc-pr-1 bc-text-xs bc-font-medium bc-text-ink">
      <span className="bc-truncate" title={`${activeScope.archive.label}: ${activeScope.name}`}>
        {activeScope.name}
      </span>
      <button
        aria-label={sprintf(__('Search everywhere, not only in %s'), activeScope.name)}
        className="bc-flex bc-h-4 bc-w-4 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded-full bc-border-0 bc-bg-transparent bc-p-0 bc-text-ink-subtle hover:bc-bg-line hover:bc-text-ink"
        onClick={() => {
          setScopeDropped(true)
          inputRef.current?.focus()
        }}
        // Keep the field's focus, so the panel stays open across the click.
        onMouseDown={event => event.preventDefault()}
        type="button"
      >
        <LuX size={12} />
      </button>
    </span>
  )

  return (
    <div className={cn(className, 'bc-relative bc-w-full')} role="search">
      {/* Outlined on a light fill rather than antd's filled variant: the rule
          gives the field an edge against a white page, and outlined keeps
          antd's brand border on focus. */}
      <Input
        allowClear
        aria-activedescendant={panelOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-controls={panelOpen ? listId : undefined}
        aria-expanded={panelOpen}
        aria-label={__('Search topics')}
        autoComplete="off"
        className={cn([
          'bc-h-10 bc-rounded-[8px] bc-border-line bc-bg-surface-hover bc-pl-3 bc-text-[14px] focus-within:bc-border-primary hover:bc-border-primary',
          focused && 'bc-bg-surface'
        ])}
        name="search"
        onBlur={() => {
          setFocused(false)
          close()
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setTerm(event.target.value)
          if (!open) openPanel()
        }}
        onClick={() => {
          if (!open) openPanel()
        }}
        onFocus={() => {
          setFocused(true)
          openPanel()
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          activeScope
            ? // translators: %s: the board, tag or other term the search is limited to
              sprintf(__('Search in %s'), activeScope.name)
            : __('Search topic, tag, etc.')
        }
        prefix={
          <>
            <LuSearch className="bc-mr-1.5 bc-shrink-0 bc-text-ink-subtle" size={18} />
            {scopeChip}
          </>
        }
        ref={inputRef}
        role="combobox"
        size="large"
        suffix={
          showHint ? (
            <kbd className="bc-rounded bc-border bc-border-solid bc-border-line bc-px-1.5 bc-font-sans bc-text-xs bc-leading-5 bc-text-ink-subtle">
              /
            </kbd>
          ) : (
            // A suffix that comes and goes would remount the input and drop
            // focus; an empty span keeps antd's wrapper stable.
            <span />
          )
        }
        type="search"
        value={term}
      />
      {panelOpen && (
        <SearchSuggestions
          activeIndex={activeIndex}
          id={listId}
          onActivate={setActiveIndex}
          onForgetRecent={item => setRecent(forgetSearch(item))}
          onSelect={select}
          optionId={optionId}
          query={query}
          sections={sections}
        />
      )}
    </div>
  )
}
