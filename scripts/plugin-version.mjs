import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Read the plugin version from the main plugin file header, falling back to
 * package.json. Both are kept in sync by `pnpm update-ver`.
 *
 * @param {string} pluginSlug
 * @returns {string}
 */
export function getPluginVersion(pluginSlug) {
  // The pro add-on's header lives one level down, in `pro/`. Without this the
  // lookup misses and every pro zip silently inherits package.json's version,
  // which tracks the free plugin.
  const pluginFile = pluginSlug.endsWith('-pro')
    ? path.resolve(rootDirectory, 'pro', `${pluginSlug}.php`)
    : path.resolve(rootDirectory, `${pluginSlug}.php`)

  if (fs.existsSync(pluginFile)) {
    const header = fs.readFileSync(pluginFile, 'utf8').match(/^\s*\*\s*Version:\s*([\d.]+)/m)
    if (header) return header[1]
  }

  const { version } = JSON.parse(fs.readFileSync(path.resolve(rootDirectory, 'package.json'), 'utf8'))

  if (!version) throw new Error(`Unable to resolve plugin version for "${pluginSlug}"`)

  return version
}
