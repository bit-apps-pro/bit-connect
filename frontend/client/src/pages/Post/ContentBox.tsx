import { __ } from '@common/helpers/i18nWrap'
import { isEmojiImage, isEmojiOnly } from '@components/quilTextEditor/quill-emoji'
import { sanitizeHtml } from '@components/quilTextEditor/quill-validation'
import { Image } from 'antd'
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from 'react'

import styles from './ContentBox.module.css'

/**
 * Posted images render at one consistent size so a thread of mixed photos reads
 * evenly. Tapping one opens it full size — the inline copy is deliberately
 * small, so there has to be a way to actually see the picture.
 */
const SHARED_IMAGE_CLASSES = [
  '[&_img]:bc-rounded-lg',
  '[&_img]:bc-shadow-sm',
  '[&_img]:bc-cursor-zoom-in'
].join(' ')

/**
 * A lone image in a post body: never upscaled past its natural size and never
 * cropped — `w-auto` plus `object-contain` keep the original ratio so a portrait
 * screenshot stays portrait. Tapping it opens the full-size view.
 *
 * From md the column width is what sizes the picture, and it is a ceiling rather
 * than a target: an image smaller than the column keeps its own size instead of
 * being blown up soft. A fixed 280px width instead left a photo under half of a
 * 531px desktop column — narrower than the same photo posted as a comment right
 * below it.
 *
 * The height ceiling is what to be careful with, because `object-contain` pays
 * for it in width: whenever the height binds first the picture goes narrow again,
 * which is the original complaint. 760px did that to any ratio past 1.43 — a
 * plain 9:16 phone photo. It is set high enough here that a full-height phone
 * screenshot (about 2.2:1) still fills the column, and only a whole-page capture
 * beyond that trades width for a post that ends somewhere.
 *
 * The phone sizes are unchanged: 220px there is already two thirds of the column.
 */
const SINGLE_IMAGE_CLASSES = [
  SHARED_IMAGE_CLASSES,
  '[&_img]:bc-block',
  '[&_img]:bc-w-auto',
  '[&_img]:bc-h-auto',
  '[&_img]:bc-object-contain',
  '[&_img]:bc-max-w-[220px]',
  'md:[&_img]:bc-max-w-full',
  '[&_img]:bc-max-h-[280px]',
  'md:[&_img]:bc-max-h-[1200px]',
  '[&_img]:bc-my-2'
].join(' ')

/**
 * A gallery pasted into a post body becomes a wrapping thumbnail row, like a
 * Facebook collage: at full size four photos would bury the writing under
 * screens of scrolling. These are square-cropped on purpose so the row stays
 * even — the untouched image is one tap away.
 *
 * Post bodies only. A comment is already short, so there is no wall of text for
 * a picture to bury and the crop is all cost: the same 2560px-wide screenshot
 * came out 340px and readable in a one-image comment, and a cropped 160px square
 * in a two-image one, which is a difference the reader cannot account for.
 *
 * The desktop tile is sized so three still sit on one row of a 531px column,
 * which is what keeps this a collage; 128px only used a quarter of the width
 * the row had and made each picture too small to tell apart.
 */
const MULTI_IMAGE_CLASSES = [
  SHARED_IMAGE_CLASSES,
  '[&_img]:bc-inline-block',
  '[&_img]:bc-align-top',
  '[&_img]:bc-object-cover',
  '[&_img]:bc-w-[104px]',
  'md:[&_img]:bc-w-[160px]',
  '[&_img]:bc-h-[104px]',
  'md:[&_img]:bc-h-[160px]',
  '[&_img]:bc-mr-2',
  '[&_img]:bc-my-1'
].join(' ')

/**
 * Pictures in a comment, however many: sized the way Facebook sizes one, scaled
 * to a standard width and never cropped, each on its own line.
 *
 * The width is what makes a thread even — every screenshot lands at the same
 * 340px — while the height follows the picture. Squaring them off instead made
 * the common case useless: a wide code screenshot, the thing people actually
 * paste into a bug report, got its sides cut away and its text crushed to
 * nothing. A consistent width is worth having; a consistent shape is not, when
 * the shape is the content.
 *
 * The height ceiling is a backstop, not the usual limit. It has to stay above
 * what 340px implies for ordinary portrait ratios, because `object-contain`
 * pays for a height cap in width: at 380px anything past 1.12 — which is to say
 * nearly every portrait photo — was held back to under 340px wide for no reason
 * the reader could see.
 *
 * The standard width is a ceiling the bubble can lower, not a width to hold
 * against it. A bare 340px is wider than the bubble itself once the thread
 * indents a reply or the 54ch measure binds — at 768px it put 16px of every
 * picture outside the rounded grey and under the card's clip.
 */
const COMMENT_IMAGE_CLASSES = [
  SHARED_IMAGE_CLASSES,
  '[&_img]:bc-block',
  '[&_img]:bc-w-auto',
  '[&_img]:bc-h-auto',
  '[&_img]:bc-object-contain',
  '[&_img]:bc-max-w-full',
  'md:[&_img]:bc-max-w-[min(340px,100%)]',
  '[&_img]:bc-max-h-[320px]',
  'md:[&_img]:bc-max-h-[620px]',
  '[&_img]:bc-my-2'
].join(' ')

/**
 * Three or more pictures in a comment become a two-column grid.
 *
 * Stacked at the standard width they are legible but endless — three of them is
 * most of a screen before the next reply starts, which is what a grid is for.
 * Three small columns, because a grid of this kind is scanned rather than read:
 * it says how many pictures came with the reply and roughly what they are, and
 * the one being asked about is a tap from full size.
 *
 * The columns divide the width the bubble has rather than each claiming a fixed
 * one. Three 90px tracks and their gaps come to 286px whatever the reader is
 * holding, and a comment bubble is nowhere near that on a phone — it hugs its
 * content behind an avatar column and a nesting indent, leaving 180px at 320px
 * wide. The third tile went 58px past the edge of the screen, and nothing
 * scrolls sideways to reach it, so the picture was gone: no crop, no hint, and
 * no way to tap it open. `max-w` keeps the desktop tile at the 140px it was.
 *
 * The paragraph is the grid, not the body: the editor puts a run of pasted
 * pictures in one <p> separated by <br>, and text of its own into other
 * paragraphs. Selecting the paragraph that holds them (`:has(> img ~ img)`)
 * leaves any prose in the same comment laid out normally. Nothing rewrites the
 * injected HTML, so the prerendered markup is unaffected.
 *
 * The tiles are square-cropped, which is the one place that treatment earns its
 * keep — a grid only reads as a grid if the cells line up.
 *
 * Every class here is written out in full. Tailwind finds classes by scanning
 * this file as text, so a name assembled from a shared prefix at runtime is a
 * name it never sees: the rules for the cells silently failed to exist while the
 * ones for the paragraph, written literally, worked.
 */
const COMMENT_GRID_CLASSES = [
  COMMENT_IMAGE_CLASSES,
  '[&_p:has(>img~img)]:bc-grid',
  '[&_p:has(>img~img)]:bc-w-full',
  '[&_p:has(>img~img)]:bc-max-w-[436px]',
  '[&_p:has(>img~img)]:bc-grid-cols-[repeat(3,minmax(0,1fr))]',
  '[&_p:has(>img~img)]:bc-gap-2',
  // The <br> the editor leaves between two pasted pictures would take a cell of
  // its own and push every tile after it one place along.
  '[&_p:has(>img~img)>br]:bc-hidden',
  '[&_p:has(>img~img)>img]:bc-w-full',
  '[&_p:has(>img~img)>img]:bc-aspect-square',
  '[&_p:has(>img~img)>img]:bc-object-cover',
  '[&_p:has(>img~img)>img]:bc-max-w-none',
  '[&_p:has(>img~img)>img]:bc-max-h-none',
  '[&_p:has(>img~img)>img]:bc-m-0'
].join(' ')

/**
 * Headings authored with the editor's text-format select have to read as
 * headings once posted. The portal renders inside whatever theme the site runs,
 * whose heading sizes are unknown and sometimes reset away, so they are pinned
 * here to the sizes the composer previewed while writing.
 *
 * Levels above h4 only arrive by paste; they share the smallest size rather than
 * shrinking below the body text.
 */
const HEADING_CLASSES = [
  '[&_h1]:bc-text-[1.5em]',
  '[&_h2]:bc-text-[1.5em]',
  '[&_h3]:bc-text-[1.25em]',
  '[&_h4]:bc-text-[1.1em]',
  '[&_h5]:bc-text-[1.1em]',
  '[&_h6]:bc-text-[1.1em]',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-font-semibold',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-leading-tight',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-mb-1',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-mt-3',
  // Beats the rule above on specificity, so a post opening with a heading has
  // no phantom gap above it regardless of the order Tailwind emits them in.
  '[&>:first-child]:bc-mt-0'
].join(' ')

/**
 * One-line previews: a heading keeps its weight but drops back to body size, so
 * a post that opens with one does not tower over its neighbours in the list.
 *
 * These replace HEADING_CLASSES rather than overriding them — the two sets pin
 * the same properties at the same specificity, and which one wins would come
 * down to the order Tailwind happens to emit its utilities in.
 */
const COMPACT_HEADING_CLASSES = [
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-text-[15px]',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-font-semibold',
  '[&_:is(h1,h2,h3,h4,h5,h6)]:bc-my-0'
].join(' ')

/** Visible text of a fragment of HTML, without a DOM parse — SSR safe. */
const plainTextOf = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/&nbsp;/gi, ' ')
    .trim()

const IMAGE_TAG = /<img\b[^>]*>/gi

/** Counts pictures without paying for a DOM parse — SSR safe. */
const countImages = (html: string) => (html.match(/<img\b/gi) ?? []).length

/** Pictures in a comment from here up are laid out as a grid rather than stacked. */
const COMMENT_GRID_THRESHOLD = 3

/**
 * Whether the pictures are a gallery — two or more with nothing but markup
 * between them — rather than illustrations spaced through the prose.
 *
 * The count alone decided this before, and the count cannot tell the two apart:
 * a written answer that puts a screenshot under each of its two points was read
 * as a gallery and both screenshots were cropped to a 160px square, which is not
 * a size a UI screenshot says anything at. A picture with text either side of it
 * is part of the sentence and is sized like a lone one; only an uninterrupted run
 * of them is the collage the thumbnail treatment was written for.
 *
 * String-scanned rather than parsed, because this also runs during SSR prerender
 * where there is no DOM.
 */
export const isGallery = (html: string) => {
  const gaps: string[] = []
  let previousEnd = -1

  for (const match of html.matchAll(IMAGE_TAG)) {
    if (previousEnd >= 0) gaps.push(html.slice(previousEnd, match.index))
    previousEnd = match.index + match[0].length
  }

  return gaps.length > 0 && gaps.every(gap => plainTextOf(gap) === '')
}

const sourceOf = (element: HTMLImageElement) => element.currentSrc || element.src

export default function ContentBox({
  className,
  compact,
  content,
  variant = 'post'
}: {
  className?: string
  compact?: boolean
  content: string
  /**
   * Comments size their pictures to one standard tile; post bodies keep the
   * looser treatment, where a single screenshot may run wider than a thumbnail.
   */
  variant?: 'comment' | 'post'
}) {
  // Client-side backstop: sanitize user-authored HTML before injecting it.
  // The server escapes with wp_kses_post(), this guards against any missed
  // server path. DOMParser is browser-only, so during SSR prerender we fall
  // back to the server-escaped content as-is.
  const safeContent = typeof DOMParser === 'undefined' ? content : sanitizeHtml(content)

  const bodyRef = useRef<HTMLDivElement>(null)
  const [previewSource, setPreviewSource] = useState('')

  const isComment = variant === 'comment'
  // One or two pictures in a comment stay stacked at the standard width, where
  // they are read rather than scanned. From three the comment is long enough
  // that the grid earns its crop.
  const commentImageClasses =
    countImages(safeContent) >= COMMENT_GRID_THRESHOLD ? COMMENT_GRID_CLASSES : COMMENT_IMAGE_CLASSES

  // The collage is a post-body treatment: only a post has enough writing for a
  // pasted gallery to bury.
  const singleImageClasses = isComment ? commentImageClasses : SINGLE_IMAGE_CLASSES
  const imageClasses = !isComment && isGallery(safeContent) ? MULTI_IMAGE_CLASSES : singleImageClasses

  // A reaction, not a sentence — Facebook renders those large, and at reading
  // size three emoji alone look like a mis-sent message.
  const emojiOnly = isComment && !compact && isEmojiOnly(plainTextOf(safeContent))

  // The body is injected HTML, so the images are not React elements and cannot
  // carry their own props. Make them reachable by keyboard after each render.
  useEffect(() => {
    if (compact) return
    for (const image of bodyRef.current?.querySelectorAll('img') ?? []) {
      // An emoji is a character that happens to be delivered as an image. It is
      // not a picture to open, and making each one a tab stop would put a dozen
      // of them between the reader and the reply button.
      if (isEmojiImage(image)) continue
      image.tabIndex = 0
      image.setAttribute('role', 'button')
      if (!image.getAttribute('aria-label')) {
        image.setAttribute('aria-label', __('View image full size'))
      }
    }
  }, [safeContent, compact])

  const openPreview = (element: HTMLElement) => {
    if (compact || element.tagName !== 'IMG' || isEmojiImage(element)) return false
    const source = sourceOf(element as HTMLImageElement)
    if (!source) return false
    setPreviewSource(source)
    return true
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    openPreview(event.target as HTMLElement)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    // Only swallow the key when it actually opened an image.
    if (openPreview(event.target as HTMLElement)) event.preventDefault()
  }

  return (
    <>
      {/* The interactive elements are the images inside this injected HTML; they
          receive role="button" and tabIndex above. This container only delegates
          their events, because they are not React elements and cannot take props. */}
      {/* `break-words` is here so an unbroken string — a pasted URL, a stack
          trace — wraps instead of running out of the card. It is deliberately
          not joined by `hyphens-auto`: that hyphenated ordinary prose mid-word
          ("ac-cess"), which reads as a typo in a forum post, and it was never
          what kept long content inside the card. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        // eslint-disable-next-line max-len -- long Tailwind utility string
        className={`${styles.body} ${emojiOnly ? styles.emojiOnly : ''} bc-mb-4 bc-w-full bc-break-words bc-text-[15px] bc-leading-[1.6] [&_strong]:bc-font-bold [&_em]:bc-italic [&_u]:bc-underline [&_a]:bc-text-blue-500 [&_a]:hover:bc-text-blue-600 [&_a]:hover:bc-underline [&_a]:bc-underline-offset-2 ${compact ? `[&_p]:bc-mb-0 [&_p]:bc-mt-0 [&_img]:bc-hidden ${COMPACT_HEADING_CLASSES}` : `${imageClasses} ${HEADING_CLASSES}`} ${className || ''}`}
        dangerouslySetInnerHTML={{ __html: safeContent }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={bodyRef}
      />

      {previewSource && (
        <Image
          alt=""
          preview={{
            onVisibleChange: visible => {
              if (!visible) setPreviewSource('')
            },
            src: previewSource,
            visible: true
          }}
          src={previewSource}
          wrapperStyle={{ display: 'none' }}
        />
      )}
    </>
  )
}
