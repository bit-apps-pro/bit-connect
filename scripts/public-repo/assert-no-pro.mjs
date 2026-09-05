#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Proves a free-source tree carries no pro code.
 *
 * Runs twice, in two places, on purpose:
 *
 *  - inside `publish-free-source.mjs`, against the staged mirror and with
 *    `--markers-from` pointed at this monorepo, so the built bundle can be
 *    checked against string literals lifted from the real pro modules;
 *  - inside the public repository's own workflow, against its checkout and
 *    without `--markers-from`, where the structural checks still hold and the
 *    pro sources do not exist to compare against.
 *
 * Exit code 1 means: do not publish this.
 */
import { program } from 'commander'
import fse from 'fs-extra'
import path from 'node:path'

import {
  PRO_NAMESPACE_ALLOWLIST,
  PRO_ONLY_MODULES,
  PUBLISHED_PRO_SUFFIXED,
  STRIPPED_PATHS,
  STUBBED_MODULES
} from './manifest.mjs'

program
  .name('assert-no-pro')
  .description('Fail if a free-source tree contains pro code')
  .requiredOption('-t, --tree <char>', 'root of the tree to audit')
  .option(
    '-m, --markers-from <char>',
    'monorepo root holding the real pro modules, enabling the built-bundle scan'
  )
  .parse()

const { markersFrom, tree } = program.opts()
const treeRoot = path.resolve(tree)

/** The stub header every substituted module carries. */
const STUB_MARKER = 'not part of this repository'

/** Literals shorter than this match too much ordinary code to be evidence. */
const MIN_MARKER_LENGTH = 12

const failures = []

const fail = message => failures.push(message)

/**
 * Every file under `directory`, as paths relative to the tree root.
 *
 * @param {string} directory
 * @param {(relative: string) => boolean} [keep]
 * @returns {Promise<string[]>}
 */
async function walk(directory, keep = () => true) {
  const absolute = path.resolve(treeRoot, directory)

  if (!(await fse.pathExists(absolute))) return []

  const found = []

  for (const entry of await fse.readdir(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name)

    // Never audit dependency trees: they are installed, not published, and
    // vendored packages legitimately contain the word "pro".
    if (entry.name === 'node_modules' || entry.name === 'vendor') continue

    if (entry.isDirectory()) {
      found.push(...(await walk(relative, keep)))
    } else if (keep(relative)) {
      found.push(relative)
    }
  }

  return found
}

// 1. Nothing that was supposed to be stripped survived.
for (const stripped of STRIPPED_PATHS) {
  if (await fse.pathExists(path.resolve(treeRoot, stripped))) {
    fail(`stripped path is present: ${stripped}`)
  }
}

for (const proOnly of PRO_ONLY_MODULES) {
  if (await fse.pathExists(path.resolve(treeRoot, proOnly))) {
    fail(`pro-only module is present: ${proOnly}`)
  }
}

// 2. Every `.pro` file is either a known stub or a deliberately published
//    commons component. A newly added pro module trips this and stops the
//    publish rather than riding along unnoticed.
const published = new Set(PUBLISHED_PRO_SUFFIXED)
const stubbed = new Set(STUBBED_MODULES)

const proSuffixed = await walk('frontend', relative => /\.pro\.(?:ts|tsx|js|jsx)$/.test(relative))

for (const relative of proSuffixed) {
  const normalized = relative.split(path.sep).join('/')

  if (published.has(normalized)) continue

  if (!stubbed.has(normalized)) {
    fail(`unexpected pro module: ${normalized} — add a stub or strip it, then re-run`)
    continue
  }

  const source = await fse.readFile(path.resolve(treeRoot, relative), 'utf8')

  if (!source.includes(STUB_MARKER)) {
    fail(`pro module was published unstubbed: ${normalized}`)
  }
}

for (const stub of STUBBED_MODULES) {
  if (!(await fse.pathExists(path.resolve(treeRoot, stub)))) {
    fail(`stub is missing, so the dispatch import will not resolve: ${stub}`)
  }
}

// 3. No PHP names the pro namespace outside free's own detection gates.
const phpFiles = await walk('backend', relative => relative.endsWith('.php'))

for (const relative of phpFiles) {
  const normalized = relative.split(path.sep).join('/')

  if (PRO_NAMESPACE_ALLOWLIST.includes(normalized)) continue

  const source = await fse.readFile(path.resolve(treeRoot, relative), 'utf8')

  if (source.includes('BitConnectPro')) {
    fail(`pro namespace referenced outside the detection gates: ${normalized}`)
  }
}

// 4. The built bundle contains no string that only a pro module used.
//
//    The marker list is derived rather than hand-kept: a literal counts only if
//    it appears in a pro module and in no published source file, so the check
//    keeps working as the pro UI changes.
const assetsDirectory = path.resolve(treeRoot, 'assets')

if (markersFrom && (await fse.pathExists(assetsDirectory))) {
  const proSources = [...STUBBED_MODULES, ...PRO_ONLY_MODULES]
  const literalPattern = /'((?:[^'\\\n]|\\.){12,})'|"((?:[^"\\\n]|\\.){12,})"/g

  const candidates = new Set()

  for (const relative of proSources) {
    const absolute = path.resolve(markersFrom, relative)

    if (!(await fse.pathExists(absolute))) continue

    const source = await fse.readFile(absolute, 'utf8')

    for (const match of source.matchAll(literalPattern)) {
      const literal = match[1] ?? match[2]

      // Import specifiers and path-like literals say nothing about whether pro
      // logic reached the bundle.
      if (literal.startsWith('.') || literal.startsWith('@') || literal.includes('/')) continue

      if (literal.length >= MIN_MARKER_LENGTH) candidates.add(literal)
    }
  }

  const publishedSources = await walk('frontend', relative => /\.(?:ts|tsx)$/.test(relative))
  let publishedText = ''

  for (const relative of publishedSources) {
    publishedText += await fse.readFile(path.resolve(treeRoot, relative), 'utf8')
  }

  const markers = [...candidates].filter(literal => !publishedText.includes(literal))

  let bundleText = ''

  for (const relative of await walk('assets', relative => relative.endsWith('.js'))) {
    bundleText += await fse.readFile(path.resolve(treeRoot, relative), 'utf8')
  }

  for (const marker of markers) {
    if (bundleText.includes(marker)) {
      fail(`pro-only string reached the built bundle: ${JSON.stringify(marker)}`)
    }
  }

  console.log(`  scanned the bundle for ${markers.length} pro-only strings`)
} else if (markersFrom) {
  console.log('  no assets/ in the tree — skipping the bundle scan')
}

if (failures.length > 0) {
  console.error(`\nassert-no-pro: ${failures.length} problem(s) in ${treeRoot}\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error('')
  process.exit(1)
}

console.log(`assert-no-pro: ${treeRoot} carries free code only`)
