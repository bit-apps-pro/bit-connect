#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Post-processes the frontend string catalogue into `backend/i18n/`.
 *
 * The catalogue is written by `bitapps-plugin-i18n` (from the external
 * `bitapps-dev-utils` package) as `languages/frontend-extracted-strings.php`,
 * so the three things it needs cannot be arranged at the source:
 *
 *  1. A home outside `languages/`. The file is plugin source — a generated
 *     list of `__()` calls that `wp i18n make-pot` reads and that `Views\Head`
 *     executes at runtime to hand the frontend bundle its translations. It is
 *     not a compiled translation, but a `.php` sitting in `languages/` reads as
 *     one to the plugin directory's scanners, which flagged it as a translation
 *     file that belongs on translate.wordpress.org. Moving it says what it is;
 *     `make-pot` walks the whole plugin tree, so extraction is unaffected.
 *
 *  2. A direct-file-access guard. The file is `include`d at runtime, so it
 *     ships in the plugin and is web-reachable.
 *
 *  3. A `translators:` comment above every `__()` whose string carries a
 *     printf placeholder. The strings are lifted verbatim out of the frontend
 *     bundle, so there is no authored context to copy — the comment names the
 *     placeholders it found and tells the translator to keep them.
 *
 * Running this twice is a no-op: the move is skipped once the generator's
 * output is gone, and both insertions are detected before they are made.
 */
import fse from 'fs-extra'
import path from 'node:path'

import { rootDirectory } from './plugin-version.mjs'

/** Where `bitapps-plugin-i18n` drops the catalogue. */
const generatedFile = path.resolve(rootDirectory, 'languages/frontend-extracted-strings.php')

/** Where it belongs, and where `Views\Head` includes it from. */
const targetFile = path.resolve(rootDirectory, 'backend/i18n/frontend-strings.php')

const ABSPATH_GUARD = ["if (!defined('ABSPATH')) {", '    exit;', '}', ''].join('\n')

/** `%s`, `%d`, `%1$s`, `%05.2f` — the printf forms the i18n sniff looks for. */
const PLACEHOLDER = /%(?:\d+\$)?[-+ 0#]*\d*(?:\.\d+)?[bcdeEfFgGosuxX%]/g

// A fresh generator run leaves the catalogue in `languages/`; a re-run over an
// already-relocated tree finds only the target. Either is fine, neither is
// "nothing to do".
const sourceFile = (await fse.pathExists(generatedFile)) ? generatedFile : targetFile

if (!(await fse.pathExists(sourceFile))) {
  console.error(
    `harden-extracted-strings: no catalogue at ${path.relative(rootDirectory, generatedFile)} or ${path.relative(rootDirectory, targetFile)}`
  )
  process.exit(1)
}

const relocating = sourceFile === generatedFile
const originalSource = await fse.readFile(sourceFile, 'utf8')
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

if (!relocating && hardenedSource === originalSource) {
  console.log('harden-extracted-strings: already hardened, nothing to do')
  process.exit(0)
}

await fse.outputFile(targetFile, hardenedSource)
console.log(`harden-extracted-strings: hardened ${path.relative(rootDirectory, targetFile)}`)

if (relocating) {
  await fse.remove(generatedFile)
  console.log(
    `harden-extracted-strings: moved out of ${path.relative(rootDirectory, generatedFile)} — languages/ holds translations only`
  )
}
