import { __ } from '@common/helpers/i18nWrap'
import { userProfilePath } from '@utilities/user-link'
import { Link } from 'react-router'

import { type EditAttribution } from '@/types/edit-attribution'

interface EditedNoteProps {
  className?: string
  edited: EditAttribution | undefined
}

/** Full timestamp for the tooltip, so the note itself stays to one word. */
const fullTime = (at: string) => {
  // The server sends GMT without a zone marker, which Safari reads as local.
  const date = new Date(at.replace(' ', 'T') + 'Z')

  return Number.isNaN(date.getTime()) ? at : date.toLocaleString()
}

/**
 * The "edited" note beside a byline.
 *
 * Two forms from one record. The author editing their own words gets the plain
 * "(edited)". Anyone else gets named, because on this forum that is a teammate
 * correcting a colleague's reply — credit rather than a warning — and a reader
 * is owed the fact that the words are no longer only the author's.
 *
 * Renders nothing for content nobody has edited.
 */
export default function EditedNote({ className = '', edited }: EditedNoteProps) {
  if (!edited) return <></>

  const shared = `bc-text-[12px] bc-leading-tight bc-text-ink-muted ${className}`
  const when = fullTime(edited.at)

  // No name to print when the editor's account is gone, so it falls back to the
  // plain form rather than reading "Edited by " and stopping.
  if (edited.byAuthor || !edited.byName) {
    return (
      <span className={shared} title={when}>
        {__('(edited)')}
      </span>
    )
  }

  return (
    <span className={shared} title={when}>
      {__('Edited by')}{' '}
      {edited.bySlug ? (
        <Link className="bc-text-inherit bc-underline" to={userProfilePath(edited.bySlug)}>
          {edited.byName}
        </Link>
      ) : (
        edited.byName
      )}
    </span>
  )
}
