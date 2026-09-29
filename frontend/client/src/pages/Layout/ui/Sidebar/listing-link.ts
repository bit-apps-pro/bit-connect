import config from '@config/config'
import { routePath } from '@utils/route-path'

/**
 * Where the sidebar sends a reader for a stage and a department taken together.
 *
 * The two lists narrow one listing, so a link in either keeps what the other
 * has chosen. Each lands on the one URL search indexes for it — a department's
 * archive (`/department/bit-crm`), a stage's archive (`/stage/planned`), or the
 * portal root for the default stage — and a pair is the department's archive
 * narrowed by `?stage=`, which canonicalises to that archive: one page per
 * department and per stage, never one per combination of them.
 *
 * @param department slug of the open department, or '' for all of them
 * @param stage      slug of the stage the reader named, or '' for none
 */
export function listingLink({ department = '', stage = '' }: { department?: string; stage?: string }) {
  if (department !== '') {
    const archive = `/${config.DEPARTMENT_NAMING.slug}/${department}`

    return routePath(stage === '' ? archive : `${archive}?stage=${encodeURIComponent(stage)}`)
  }

  // `/stage/questions` lists exactly what `/` lists; the server 301s it there.
  if (stage === '' || stage === config.DEFAULT_STAGE_SLUG) return '/'

  return routePath(`/stage/${stage}`)
}
