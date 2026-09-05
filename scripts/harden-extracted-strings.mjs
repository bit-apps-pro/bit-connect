#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Post-processes `languages/frontend-extracted-strings.php`.
 *
 * That file is written by `bitapps-plugin-i18n` (from the external
 * `bitapps-dev-utils` package), so the two things the WordPress.org Plugin
 * Check wants from it cannot be added at the source:
 *
 *  1. A direct-file-access guard. The file is `include`d at runtime by
 *     `Views\Head`, so it ships in the plugin and is web-reachable.
 *
 *  2. A `translators:` comment above every `__()` whose string carries a
 *     printf placeholder. The strings are lifted verbatim out of the frontend
 *     bundle, so there is no authored context to copy — the comment names the
 *     placeholders it found and tells the translator to keep them.
 *
 * Running this twice is a no-op: both insertions are detected before they are
 * made.
 */
import fse from 'fs-extra'
import path from 'node:path'

import { rootDirectory } from './plugin-version.mjs'

const targetFile = path.resolve(rootDirectory, 'languages/frontend-extracted-strings.php')

const ABSPATH_GUARD = ["if (!defined('ABSPATH')) {", '    exit;', '}', ''].join('\n')

/** `%s`, `%d`, `%1$s`, `%05.2f` — the printf forms the i18n sniff looks for. */
const PLACEHOLDER = /%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?[bcdeEfFgGosuxX%]/g

if (!(await fse.pathExists(targetFile))) {
  console.error(`harden-extracted-strings: nothing to harden at ${targetFile}`)
  process.exit(1)
}

const originalSource = await fse.readFile(targetFile, 'utf8')
const lines = originalSource.split('\n')
const output = []

let guardAdded = false

for (const [index, line] of lines.entries()) {
  // The guard goes directly under the "generated file" banner, ahead of the
  // `return [` that opens the catalogue.
  if (!guardAdded && !originalSource.includes("defined('ABSPATH')") && line.startsWith('return [')) {
    output.push(ABSPATH_GUARD)
    guardAdded = true
  }

  const translated = line.match(/__\('((?:[^'\\]|\\.)*)'/)
  const placeholders = translated ? [...new Set(translated[1].match(PLACEHOLDER) ?? [])] : []
  const previousLine = lines[index - 1] ?? ''

  if (placeholders.length > 0 && !previousLine.includes('translators:')) {
    const indent = line.match(/^\s*/)[0]

    output.push(
      `${indent}/* translators: ${placeholders.join(', ')} — value(s) inserted by the plugin; keep them in the translation. */`
    )
  }

  output.push(line)
}

const hardenedSource = output.join('\n')

if (hardenedSource === originalSource) {
  console.log('harden-extracted-strings: already hardened, nothing to do')
  process.exit(0)
}

await fse.writeFile(targetFile, hardenedSource)
console.log(`harden-extracted-strings: hardened ${path.relative(rootDirectory, targetFile)}`)
