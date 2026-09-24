/**
 * Builds a variant of this plugin from an optional second source tree.
 *
 * This repository is the whole of this plugin, and a plain build of it needs
 * nothing here. The plugin exists for the other case: building a *variant* —
 * a distribution that replaces some of these modules with its own — without
 * copying this tree, forking it, or leaving placeholders in it for the
 * variant's benefit.
 *
 * A variant supplies a directory that mirrors `frontend/`'s layout. Any module
 * whose path exists in that directory is resolved there instead of here:
 *
 *     frontend/client/src/store/helper/comment-order.ts   <- this tree
 *     <overlay>/client/src/store/helper/comment-order.ts  <- wins, if present
 *
 * Nothing in this tree names, imports or tests for the overlay, and no file
 * here changes when one is used. Import sites are ordinary relative or aliased
 * imports; a module is simply resolved to a different file. That is the whole
 * mechanism.
 *
 * Unless `BIT_OVERLAY` is true *and* `BIT_OVERLAY_DIR` is set, this plugin
 * resolves nothing at all, so a build run from a clone of this repository
 * behaves exactly as it would if the plugin were not installed. Both conditions
 * are required: an overlay directory merely being *present* on disk must never
 * be enough to graft another tree's modules into this plugin's build. Anything
 * that sets the path globally — a docker-compose `environment:` block, an
 * exported shell variable — would otherwise reach this plugin's own dev server.
 *
 * ## The rules overlay files follow
 *
 * An overlay file reaches **this tree** through a tsconfig alias, and its
 * **own** neighbours through a relative path:
 *
 *     import { type CapPopoverProps } from '@pages/manager/shared/types'  // here
 *     import useProfileBadges from './use-profile-badges'                 // overlay
 *
 * Relative paths keep working on their own because the overlay mirrors this
 * layout, so a sibling really is a sibling. Aliases need this plugin: the app's
 * tsconfig only covers files under its own root, and an overlay file sits
 * outside it, so `vite-tsconfig-paths` never sees it.
 *
 * Alias resolution here is deliberately scoped to importers inside the overlay.
 * This tree's own alias imports stay with `vite-tsconfig-paths`, so both builds
 * resolve this tree's code through exactly the same code path and cannot
 * quietly disagree.
 *
 * ## Replacing versus extending
 *
 * A shadow *replaces* the module it shares a path with, so by default the
 * original is unreachable — an overlay file importing its own path would
 * resolve to itself. The `@base/` prefix is the way out: it resolves into this
 * tree with shadowing switched off, and is the only specifier that does.
 *
 *     import baseOptions from '@base/client/src/.../use-visibility-options'
 *
 * That is how a shadow keeps this plugin's behaviour and adds to it, rather
 * than restating it. It is available only to overlay files; nothing in this
 * tree can use it, because nothing in this tree knows an overlay exists.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Resolves into the mirrored tree without shadowing — see the header. */
const BASE_PREFIX = '@base/'

/** Tried in order when an import omits the extension, as they usually do. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

/**
 * @param {string} file
 * @returns {null | string} the file itself, or the first extension that exists
 */
function resolveFile(file) {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file

  for (const extension of EXTENSIONS) {
    const candidate = file + extension

    if (fs.existsSync(candidate)) return candidate
  }

  for (const extension of EXTENSIONS) {
    const candidate = path.join(file, 'index' + extension)

    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

/**
 * @param {string} child
 * @param {string} parent
 * @returns {boolean}
 */
function isInside(child, parent) {
  const relative = path.relative(parent, child)

  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * The app's tsconfig `paths`, flattened to [prefix, absolute target] pairs.
 *
 * Read from the tsconfig rather than restated here: the two would drift, and the
 * failure when they did would be a variant-only build error nobody sees until
 * release. Longest prefix first, so `@common/` wins over `@/`.
 *
 * @param {string} appRoot absolute path to the app dir holding tsconfig.json
 * @returns {[string, string][]}
 */
function readAliases(appRoot) {
  const tsconfigPath = path.join(appRoot, 'tsconfig.json')
  let tsconfig

  try {
    tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
  } catch (error) {
    throw new Error(
      `overlay: could not read ${tsconfigPath} as JSON (${error.message}). ` +
        'The overlay resolves its alias imports from this file, so it has to stay ' +
        'comment-free — or pass an explicit `aliases` map to the plugin.'
    )
  }

  const paths = tsconfig.compilerOptions?.paths ?? {}

  return Object.entries(paths)
    .map(([pattern, [target]]) => [
      pattern.replace(/\*$/, ''),
      path.resolve(appRoot, target.replace(/\*$/, ''))
    ])
    .sort((a, b) => b[0].length - a[0].length)
}

/**
 * @param {object} options
 * @param {string} options.appRoot    absolute path to the app dir (holds tsconfig.json)
 * @param {string} options.mirrorRoot the directory whose layout an overlay mirrors —
 *                                    `frontend/`, so a module at
 *                                    `frontend/admin/src/x.tsx` is shadowed by
 *                                    `<overlayDir>/admin/src/x.tsx`
 * @param {string} [options.overlayDir] absolute path to the overlay; when absent
 *                                      the plugin does nothing
 * @returns {import('vite').Plugin}
 */
export default function overlay({ appRoot, overlayDir, mirrorRoot }) {
  // Both conditions — see the header for why an available overlay directory
  // must not be sufficient on its own.
  const isOverlayBuild = process.env.BIT_OVERLAY === 'true'
  const overlayRoot = overlayDir && isOverlayBuild ? path.resolve(overlayDir) : null

  if (overlayRoot && !fs.existsSync(overlayRoot)) {
    throw new Error(
      `overlay: BIT_OVERLAY_DIR points at ${overlayRoot}, which does not exist. ` +
        'Unset it, or set BIT_OVERLAY=false, to build this plugin on its own.'
    )
  }

  let aliases = []

  return {
    name: 'vite-plugin-overlay',
    // Ahead of vite-tsconfig-paths, so a shadowed specifier is redirected
    // before anything else has a chance to bind it to the mirrored file.
    enforce: 'pre',
    buildStart() {
      if (overlayRoot) aliases = readAliases(appRoot)
    },
    resolveId(source, importer) {
      if (!overlayRoot || !importer) return null

      const fromOverlay = isInside(importer, overlayRoot)

      // The escape hatch: into the mirrored tree, shadowing switched off. Only
      // overlay files may use it — nothing in the mirrored tree knows the
      // prefix exists, and honouring it for those importers would make this
      // plugin's own resolution depend on the overlay being present.
      if (source.startsWith(BASE_PREFIX)) {
        if (!fromOverlay) return null

        return resolveFile(path.join(mirrorRoot, source.slice(BASE_PREFIX.length)))
      }

      let absolute = null

      if (source.startsWith('.')) {
        absolute = path.resolve(path.dirname(importer), source)
      } else if (fromOverlay) {
        // Only overlay files get their aliases resolved here — see the header.
        const alias = aliases.find(([prefix]) => source.startsWith(prefix))

        if (!alias) return null

        absolute = path.join(alias[1], source.slice(alias[0].length))
      } else {
        return null
      }

      // Already in the overlay: a shadow importing one of its own neighbours.
      // Its path is real, so nothing needs redirecting.
      if (isInside(absolute, overlayRoot)) return resolveFile(absolute)

      if (isInside(absolute, mirrorRoot)) {
        const shadow = resolveFile(path.join(overlayRoot, path.relative(mirrorRoot, absolute)))

        // No file at the mirrored path means the overlay does not replace this
        // module, so the one in this tree stands — the ordinary case, and not
        // an error.
        if (shadow) return shadow
      }

      // A relative import resolves on its own; an alias from an overlay file
      // does not, because the app's tsconfig does not reach outside its root.
      return fromOverlay && !source.startsWith('.') ? resolveFile(absolute) : null
    }
  }
}
