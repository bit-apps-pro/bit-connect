#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Removes from a staged plugin build everything a WordPress.org reviewer would
 * ask about and no site needs.
 *
 * Two reasons this exists as its own step:
 *
 *  1. `bitapps-plugin-build` already tries to drop `composer.lock`, but the
 *     removal is not awaited and the zip is written first — so a 400 KB lock
 *     file shipped in every build. Rather than race it, we build without
 *     `--zip`, prune here, and zip afterwards.
 *
 *  2. `composer install --no-dev` prunes dev *packages*, not the dev files
 *     inside the packages it keeps. wp-kit alone ships its test suite, its
 *     PHPUnit config and a GitHub Actions workflow into the plugin.
 *
 * LICENSE files are deliberately kept: they are what evidences GPL
 * compatibility for the bundled dependencies.
 */
import { program } from 'commander'
import fse from 'fs-extra'
import path from 'node:path'

import { rootDirectory } from './plugin-version.mjs'

program
  .name('prune-build')
  .description('Strip development artefacts from a staged plugin build before zipping')
  .option('-o, --outdir <char>', 'specify output directory', 'build')
  .requiredOption('-s, --slug <char>', 'specify plugin slug')
  .parse()

const { outdir, slug: pluginSlug } = program.opts()
const buildDirectory = path.resolve(rootDirectory, outdir, pluginSlug)

if (!(await fse.pathExists(buildDirectory))) {
  console.error(`prune-build: nothing staged at ${buildDirectory}`)
  process.exit(1)
}

/** Paths relative to the build root, removed outright. */
const PATHS = [
  // Dependency resolution belongs to the repository, not to a released plugin.
  'composer.lock',
  // Emitted by the Vite build; a plugin's asset folder is not a document root.
  'assets/robots.txt',
  'assets/client/robots.txt',
]

/** Names removed wherever they appear under vendor/. */
const VENDOR_NAMES = new Set([
  'tests',
  'test',
  '.github',
  'phpunit.xml',
  'phpunit.xml.dist',
  'phpcs.xml',
  'phpcs.xml.dist',
  'captainhook.json',
  'composer.lock',
  '.php-cs-fixer.php',
  'README.md',
  'readme.md',
  'CHANGELOG.md',
])

let removed = 0

for (const relative of PATHS) {
  const target = path.join(buildDirectory, relative)

  if (await fse.pathExists(target)) {
    await fse.remove(target)
    console.log(`  removed  ${relative}`)
    removed += 1
  }
}

/**
 * Walk vendor/ and drop anything named in VENDOR_NAMES.
 *
 * @param {string} directory absolute path to walk
 */
async function pruneVendor(directory) {
  let entries

  try {
    entries = await fse.readdir(directory, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)

    if (VENDOR_NAMES.has(entry.name)) {
      await fse.remove(absolute)
      console.log(`  removed  ${path.relative(buildDirectory, absolute)}`)
      removed += 1
      continue
    }

    if (entry.isDirectory()) await pruneVendor(absolute)
  }
}

await pruneVendor(path.join(buildDirectory, 'vendor'))

console.log(`prune-build: removed ${removed} development artefact(s) from ${pluginSlug}`)
