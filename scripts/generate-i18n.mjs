#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Regenerates this plugin's translation template and frontend string catalogue.
 *
 * `bitapps-plugin-i18n`, the shared generator in `bitapps-dev-utils`, cannot be
 * used here — it is written for a repository that keeps the add-on inside the
 * free plugin, and this one deliberately does not:
 *
 *  - it extracts from `./pro/frontend-pro/pro-module/src/**` as well as
 *    `./frontend/**`, and passes `--include='backend,pro/backend/,languages'`
 *    to `make-pot`. Run from this repository's root — where `pro/` is a sibling
 *    of `free/` — that is how nine add-on strings, "Please activate Bit Connect
 *    Pro with a valid license." among them, ended up in the free plugin's
 *    shipped `.pot`. A free plugin's translation template naming the add-on's
 *    licence screen is the WordPress.org trialware signal, in an artefact no
 *    one thinks to read;
 *
 *  - it writes the frontend catalogue to `languages/`, where a `.php` file
 *    reads as a compiled translation to the directory's scanners. The
 *    catalogue is plugin source; `harden-extracted-strings.mjs` moves it to
 *    `backend/i18n/`.
 *
 * The three steps are the shared script's, minus the add-on:
 *
 *  1. `react-gettext-parser` over `frontend/` → `languages/frontend.pot`.
 *  2. That template, converted to the PHP catalogue `Views\Head` includes to
 *     hand the bundle its translations — the only way strings living in
 *     compiled JS reach translate.wordpress.org.
 *  3. `wp i18n make-pot` over `backend/` (which now holds the catalogue) and
 *     the plugin file → `languages/bit-connect.pot`.
 *
 * `languages/` is left holding templates only, which is what it is for.
 */
import { convertPOTToPHP } from 'bitapps-dev-utils/utils/pot-to-php.mjs'
import fse from 'fs-extra'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

import { rootDirectory } from './plugin-version.mjs'

/** The text domain, which WordPress.org requires to equal the plugin slug. */
const SLUG = 'bit-connect'

const frontendPot = path.resolve(rootDirectory, 'languages/frontend.pot')
const pluginPot = path.resolve(rootDirectory, `languages/${SLUG}.pot`)

/**
 * Where the shared converter writes, and where `harden-extracted-strings.mjs`
 * moves it to. Kept as the converter's target so the harden step stays the one
 * place that knows about the move.
 */
const generatedCatalogue = path.resolve(rootDirectory, 'languages/frontend-extracted-strings.php')

const potHeaders = JSON.stringify({
  'Language-Team': 'Bit Apps <support@bitapps.pro>',
  'Last-Translator': 'Bit Apps <developer@bitapps.pro>',
  'Report-Msgid-Bugs-To': `https://wordpress.org/support/plugin/${SLUG}`,
})

/**
 * `react-gettext-parser` is a dependency of `bitapps-dev-utils`, not of this
 * plugin, so pnpm's strict layout keeps it out of `node_modules/.bin`. Resolve
 * it through the package that does depend on it rather than hoisting it.
 */
function resolveParserBin() {
  const requireHere = createRequire(import.meta.url)
  const requireFromDevelopmentUtils = createRequire(requireHere.resolve('bitapps-dev-utils/package.json'))
  const parserManifest = requireFromDevelopmentUtils.resolve('react-gettext-parser/package.json')

  return path.resolve(path.dirname(parserManifest), 'lib/bin.js')
}

console.log('generate-i18n: extracting frontend strings')

execFileSync(
  process.execPath,
  [
    resolveParserBin(),
    // Paths stay relative: the parser joins whatever it is given onto its
    // working directory, so an absolute one resolves under itself and the
    // config "cannot be found".
    '--output',
    path.relative(rootDirectory, frontendPot),
    '--config',
    '.config/_plugin-commons/.gettext-parser.config.cjs',
    // This plugin's own tree, and nothing else. The overlay is a separate
    // plugin with a separate text domain and its own template.
    './frontend/**/{*.js,*.jsx,*.ts,*.tsx}',
  ],
  { cwd: rootDirectory, stdio: 'inherit' }
)

console.log('generate-i18n: converting the frontend template to a PHP catalogue')
convertPOTToPHP(frontendPot, generatedCatalogue, SLUG)

console.log('generate-i18n: hardening and relocating the catalogue')
execFileSync(process.execPath, [path.resolve(rootDirectory, 'scripts/harden-extracted-strings.mjs')], {
  cwd: rootDirectory,
  stdio: 'inherit',
})

console.log('generate-i18n: building the plugin template')

execFileSync(
  'wp',
  [
    'i18n',
    'make-pot',
    '.',
    pluginPot,
    `--slug=${SLUG}`,
    '--ignore-domain',
    // The frontend's strings arrive through the PHP catalogue under
    // `backend/i18n/`; scanning the TS sources as well would duplicate them
    // against paths that never ship.
    '--skip-js',
    // `backend/` alone. Not `pro/backend/`, and not `languages/` — that holds
    // templates now, and make-pot reading its own output is how a `.pot` grows
    // stale references to files that have moved.
    '--include=backend',
    `--headers=${potHeaders}`,
  ],
  { cwd: rootDirectory, stdio: 'inherit' }
)

if (await fse.pathExists(generatedCatalogue)) {
  await fse.remove(generatedCatalogue)
}

console.log('generate-i18n: done')
