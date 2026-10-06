import config from '@config/config'
import { routePath } from '@utils/route-path'

/**
 * Where the sidebar sends a reader for a stage, within the listing's scope.
 *
 * Each lands on the one URL search indexes for it — a stage's archive
 * (`/stage/planned`), or the portal root for the default stage. A listing
 * narrowed to one archive by a choice made beside the stages keeps it: the
 * stage then narrows that archive by `?stage=`, which canonicalises to the
 * archive itself, so there is one page per archive and per stage, never one
 * per combination of them. The archive on its own lists the default stage, as
 * the root does, so that stage is the bare archive rather than a second URL
 * for it.
 *
 * @param scope router path of the archive the listing is narrowed to, or '' for none
 * @param stage slug of the stage the reader named, or '' for none
 */
export function listingLink({ scope = '', stage = '' }: { scope?: string; stage?: string }) {
  const isDefaultStage = stage === '' || stage === config.DEFAULT_STAGE_SLUG

  if (scope !== '') {
    return routePath(isDefaultStage ? scope : `${scope}?stage=${encodeURIComponent(stage)}`)
  }

  // `/stage/questions` lists exactly what `/` lists; the server 301s it there.
  if (isDefaultStage) return '/'

  return routePath(`/stage/${stage}`)
}
