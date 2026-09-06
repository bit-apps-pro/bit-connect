import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { type InputProps } from 'antd'
import { Input } from 'antd'
import { type ChangeEvent, useRef, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { useSearchParams } from 'react-router'
import { useDebounce } from 'react-use'

interface SearchInputProps extends InputProps {
  queryKey?: string
}

export default function SearchInput({
  className = '',
  queryKey = 'search',
  ...props
}: SearchInputProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchTerm, setSearchTerm] = useState(searchParams.get(queryKey) || '')

  // `useDebounce` also runs on mount, so without this the first pass rewrites
  // the URL with the value it already holds. That write pushes a history entry
  // (React Router pushes unless told otherwise) — twice over, since the mobile
  // and desktop layouts both mount this input — leaving Back stranded on
  // duplicate entries and, once it reaches the original document entry,
  // forcing a full page reload.
  //
  // Only the mount pass is skipped, and the effect stays keyed to this input's
  // own `searchTerm`. Comparing against the URL instead would make the two
  // mounted instances overwrite each other's value in a loop, since only the
  // one the user typed into holds the current term.
  const hasRunOnce = useRef(false)
  useDebounce(
    () => {
      if (!hasRunOnce.current) {
        hasRunOnce.current = true
        return
      }

      setSearchParams(
        prev => {
          if (prev.has('page')) {
            prev.set('page', '1')
          }
          if (!searchTerm) {
            prev.delete(queryKey)
            return prev
          }
          prev.set(queryKey, searchTerm)
          return prev
        },
        // Searching refines the current view rather than moving to a new one:
        // Back should leave the listing, not replay each keystroke.
        { replace: true }
      )
    },
    500, // ms to wait after typing stops before updating the search query
    [searchTerm]
  )

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  return (
    <div className={cn(className, 'bc-relative bc-w-full')}>
      <div className="bc-absolute bc-left-3.5 bc-top-1/2 bc-z-10 bc-flex bc--translate-y-1/2">
        <LuSearch className="bc-text-ink-subtle" size={20} />
      </div>
      <Input
        allowClear
        className="bc-rounded-full bc-pl-11"
        name="search"
        onChange={handleSearchChange}
        placeholder={__('Search topic, tag, etc.')}
        size="large"
        type="search"
        variant="filled"
        {...props}
      />
    </div>
  )
}
