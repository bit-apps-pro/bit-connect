/**
 * Video links a post body can show as a player.
 *
 * A stored post keeps the address exactly as the member wrote it — nothing here
 * changes what is saved, and no frame ever reaches the database or the
 * sanitizers. The portal recognises the address when it renders the post and
 * offers a player in its place, which is what bbPress and every other forum
 * does with a pasted YouTube link.
 *
 * Only two hosts, matched by exact hostname: an address is turned into a frame
 * pointing at a URL built here from the parsed ID, never at anything the member
 * typed, so a lookalike host or a crafted path has nothing to smuggle through.
 * YouTube plays from its no-cookie domain and Vimeo with Do Not Track set.
 */

export type VideoProvider = 'vimeo' | 'youtube'

export interface VideoLink {
  /** The player address, with autoplay — it only loads after a click. */
  embedUrl: string
  provider: VideoProvider
}

const YOUTUBE_ID = /^[\w-]{11}$/
const VIMEO_ID = /^\d{1,12}$/
const VIMEO_HASH = /^[\da-f]{6,20}$/i

const YOUTUBE_HOSTS = new Set(['m.youtube.com', 'music.youtube.com', 'www.youtube.com', 'youtube.com'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com'])

/**
 * A start time as YouTube writes it — `90`, `90s` or `1h2m3s` — in seconds.
 * Anything else is ignored rather than refused: the video still plays, from the
 * beginning.
 */
const parseStartTime = (value = '') => {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!match || match[0] === '') return 0
  const [, hours = '0', minutes = '0', seconds = '0'] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

const youtubeId = (url: URL) => {
  if (url.hostname === 'youtu.be') return url.pathname.slice(1)
  if (!YOUTUBE_HOSTS.has(url.hostname)) return ''
  if (url.pathname === '/watch') return url.searchParams.get('v') ?? ''
  const [, section, id] = url.pathname.split('/')
  return ['embed', 'live', 'shorts'].includes(section) ? (id ?? '') : ''
}

const toYoutube = (url: URL): undefined | VideoLink => {
  const id = youtubeId(url)
  if (!YOUTUBE_ID.test(id)) return undefined
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`)
  embed.searchParams.set('autoplay', '1')
  const start = parseStartTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? undefined)
  if (start > 0) embed.searchParams.set('start', String(start))
  return { embedUrl: embed.toString(), provider: 'youtube' }
}

const toVimeo = (url: URL): undefined | VideoLink => {
  let segments = url.pathname.split('/').filter(Boolean)
  if (url.hostname === 'player.vimeo.com') {
    if (segments[0] !== 'video') return undefined
    segments = segments.slice(1)
  } else if (!VIMEO_HOSTS.has(url.hostname)) {
    return undefined
  }

  // An unlisted video carries its privacy hash as a second path segment on
  // vimeo.com and as `h` on the player; without it the player refuses to play.
  const [id = '', pathHash, ...rest] = segments
  if (!VIMEO_ID.test(id) || rest.length > 0) return undefined
  const hash = pathHash ?? url.searchParams.get('h')
  if (hash && !VIMEO_HASH.test(hash)) return undefined

  const embed = new URL(`https://player.vimeo.com/video/${id}`)
  if (hash) embed.searchParams.set('h', hash)
  embed.searchParams.set('autoplay', '1')
  embed.searchParams.set('dnt', '1')
  return { embedUrl: embed.toString(), provider: 'vimeo' }
}

/** The player for a YouTube or Vimeo address, or undefined for anything else. */
export function parseVideoLink(address: string): undefined | VideoLink {
  let url: URL
  try {
    url = new URL(address.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  if (url.username || url.password || url.port) return undefined
  return toYoutube(url) ?? toVimeo(url)
}

/**
 * The video a paragraph stands for, when the address is all it holds.
 *
 * A link written into a sentence stays a link — that is how WordPress decides
 * what to embed, and a player dropped mid-sentence would break the sentence in
 * two. The address may be plain text, which is what pasting one leaves behind,
 * or a single link whose text is the address itself: a link labelled "my demo"
 * is the writer's own words and is left alone.
 */
export function videoOfParagraph(paragraph: Element): undefined | VideoLink {
  const text = paragraph.textContent?.trim() ?? ''
  if (!text || /\s/.test(text)) return undefined

  const elements = [...paragraph.children].filter(child => child.tagName !== 'BR')
  if (elements.length > 1) return undefined
  if (elements.length === 1) {
    const [link] = elements
    if (link.tagName !== 'A' || link.children.length > 0) return undefined
    const href = link.getAttribute('href') ?? ''
    if (href.trim() !== text) return undefined
  }

  return parseVideoLink(text)
}
