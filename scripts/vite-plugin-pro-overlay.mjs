/**
 * Resolves `.pro` modules to a private overlay tree.
 *
 * This plugin is what lets one source tree build two editions while only one of
 * them is public. The free plugin is published as open source, so it cannot
 * contain the add-on's code — what it ships instead is a stub per `.pro` module:
 * the same filename, a `return null` body, and no implementation. That is what
 * `IS_PRO_ACTIVE` already folds away in the free build, so the free bundle is
 * the same either way.
 *
 * The pro build then points `BIT_PRO_OVERLAY_DIR` at a private directory that
 * mirrors the free tree's layout, and every `.pro` import resolves to the real
 * module there instead of to the stub beside it. Nothing is copied into the free
 * tree and nothing is generated: free source exists in exactly one place, and a
 * change to it reaches the pro bundle on the next build.
 *
 * Unless `VITE_PRO` is true *and* `BIT_PRO_OVERLAY_DIR` is set, the plugin
 * resolves nothing at all, so a free build — including one run by somebody who
 * only has the public repository — behaves exactly as it would if the plugin
 * were not installed. Both conditions are required: see the note where they are
 * checked for why an available overlay must not be sufficient on its own.
 *
 * ## The rule overlay files follow
 *
 * An overlay file reaches **free** code through a tsconfig alias, and its
 * **own** neighbours through a relative path:
 *
 *     import { type CapPopoverProps } from '@pages/manager/shared/types'  // free
 *     import useProfileBadges from './use-profile-badges'                 // overlay
 *
 * Relative paths keep working on their own because the overlay mirrors the free
 * layout, so a sibling really is a sibling. Aliases need this plugin: the app's
 * tsconfig only covers files under its own root, and an overlay file sits
 * outside it, so `vite-tsconfig-paths` never sees it.
 *
 * Alias resolution here is deliberately scoped to importers inside the overlay.
 * The free tree's own alias imports stay with `vite-tsconfig-paths`, so the free
 * and pro builds resolve free code through exactly the same code path and cannot
 * quietly disagree.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Matches a `.pro` module, with or without an explicit extension. */
const PRO_SUFFIX = /\.pro(\.[jt]sx?)?$/

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
 * failure when they did would be a pro-only build error nobody sees until
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
      `pro-overlay: could not read ${tsconfigPath} as JSON (${error.message}). ` +
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
 * @param {string} options.mirrorRoot the directory whose layout the overlay mirrors —
 *                                    `frontend/`, so a free module at
 *                                    `frontend/admin/src/x.pro.tsx` is overridden by
 *                                    `<overlayDir>/admin/src/x.pro.tsx`
 * @param {string} [options.overlayDir] absolute path to the pro overlay; when absent
 *                                      the plugin does nothing
 * @returns {import('vite').Plugin}
 */
export default function proOverlay({ appRoot, overlayDir, mirrorRoot }) {
  // Both conditions, and the second one is the safety property: an overlay
  // directory being *available* must never be enough to graft pro modules into
  // a free build. Anything that sets the path globally — a docker-compose
  // `environment:` block, an exported shell variable — would otherwise reach
  // the free dev server too, and it would serve the add-on's source to the
  // browser while the UI, correctly, showed the free edition. Checking
  // `VITE_PRO` here means the guarantee holds wherever the plugin is used,
  // rather than depending on every caller remembering to withhold the path.
  const isProBuild = process.env.VITE_PRO === 'true'
  const overlay = overlayDir && isProBuild ? path.resolve(overlayDir) : null

  if (overlay && !fs.existsSync(overlay)) {
    throw new Error(
      `pro-overlay: BIT_PRO_OVERLAY_DIR points at ${overlay}, which does not exist. ` +
        'Unset it, or set VITE_PRO=false, to build the free edition.'
    )
  }

  let aliases = []

  return {
    name: 'vite-plugin-pro-overlay',
    // Ahead of vite-tsconfig-paths, so a `.pro` specifier is redirected before
    // anything else has a chance to bind it to the stub.
    enforce: 'pre',
    buildStart() {
      if (overlay) aliases = readAliases(appRoot)
    },
    resolveId(source, importer) {
      if (!overlay || !importer) return null

      const fromOverlay = isInside(importer, overlay)
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

      if (PRO_SUFFIX.test(absolute)) {
        // Already in the overlay: an overlay module importing a sibling.
        if (isInside(absolute, overlay)) return resolveFile(absolute)

        if (isInside(absolute, mirrorRoot)) {
          const mirrored = path.join(overlay, path.relative(mirrorRoot, absolute))
          const found = resolveFile(mirrored)

          // No overlay file means the add-on does not override this one, so the
          // stub in the free tree stands. That is a legitimate state, not an
          // error: a `.pro` module may exist purely to keep a dispatch honest.
          if (found) return found
        }
      }

      // A relative import resolves on its own; an alias from an overlay file
      // does not, because the app's tsconfig does not reach outside its root.
      return fromOverlay && !source.startsWith('.') ? resolveFile(absolute) : null
    }
  }
}
