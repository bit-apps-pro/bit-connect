#!/usr/bin/env node
/**
 * Asserts that this repository is the whole of this plugin.
 *
 * This plugin is published on WordPress.org, where a plugin may not ship a
 * feature that is present but switched off — code held back behind a licence
 * test, a control rendered disabled, a build flag selecting between a real
 * implementation and a placeholder. The way this tree avoids that is simply to
 * contain no such machinery at all: where a feature is not part of this plugin,
 * the module here is the whole of what this plugin does, and says so.
 *
 * That is a property worth checking rather than remembering, because it is easy
 * to reintroduce by accident — a variant build's helper copied back, a
 * conditional added "just for now". This fails the build if any of it reappears.
 *
 * Run by CI and before publishing. It reads only this tree and knows nothing
 * about any other.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/** Directories that hold build output, dependencies or history. */
const SKIP_DIRS = new Set([
  '.git',
  'assets',
  'build',
  'coverage',
  'dist',
  'languages',
  'node_modules',
  'vendor'
])

/**
 * Identifiers that only make sense if this tree were half of something.
 *
 * Each is an edition flag, a licence test or a placeholder selector. None has a
 * legitimate use here: this plugin has one implementation of everything it
 * does, chosen by nothing.
 */
const FORBIDDEN_IDENTIFIERS = [
  'IS_PRO_ACTIVE',
  'IS_PRO_EXIST',
  'BIT_CONNECT_PRO_BUILD',
  'isAddonActive',
  'VITE_PRO',
  'BitConnectPro'
]

/**
 * Filename shapes that mean "one of two implementations".
 *
 * A tree with no editions has no siblings to choose between, so neither suffix
 * should ever appear.
 */
const FORBIDDEN_SUFFIXES = ['.pro.', '.free.']

/**
 * Files allowed to name the variant build's environment variables.
 *
 * The build supports resolving some module paths to a second tree, which is how
 * a variant of this plugin is built from these sources without copying them.
 * That is ordinary build configuration and is described in neutral terms where
 * it lives — but it belongs only there, never in plugin source.
 */
const BUILD_CONFIG = new Set([
  'scripts/vite-plugin-overlay.mjs',
  'vite.config.mts',
  'vite.config.client.mts'
])

const BUILD_ONLY_IDENTIFIERS = ['BIT_OVERLAY']

/** @returns {string[]} every file in the tree worth reading */
function walk(dir) {
  const out = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      out.push(...walk(path.join(dir, entry.name)))
    } else if (entry.isFile()) {
      out.push(path.join(dir, entry.name))
    }
  }

  return out
}

const failures = []

for (const absolute of walk(ROOT)) {
  const rel = path.relative(ROOT, absolute).split(path.sep).join('/')

  if (rel === 'scripts/assert-self-contained.mjs') continue

  const base = path.basename(rel)

  for (const suffix of FORBIDDEN_SUFFIXES) {
    if (base.includes(suffix)) {
      failures.push(
        `${rel}: a "${suffix.slice(0, -1)}" filename means two implementations of one ` +
          'module. This plugin has one.'
      )
    }
  }

  if (!/\.(mts|cts|[jt]sx?|mjs|cjs|php|json|md|txt|ya?ml)$/.test(base)) continue

  let text
  try {
    text = fs.readFileSync(absolute, 'utf8')
  } catch {
    continue
  }

  for (const identifier of FORBIDDEN_IDENTIFIERS) {
    if (text.includes(identifier)) {
      failures.push(`${rel}: contains "${identifier}" — an edition flag or licence test.`)
    }
  }

  if (BUILD_CONFIG.has(rel)) continue

  for (const identifier of BUILD_ONLY_IDENTIFIERS) {
    if (text.includes(identifier)) {
      failures.push(
        `${rel}: contains "${identifier}". The variant build is configured in ` +
          `${[...BUILD_CONFIG].join(', ')} and nowhere else — plugin source must not ` +
          'know a variant build exists.'
      )
    }
  }
}

if (failures.length > 0) {
  console.error(`\nassert-self-contained: ${failures.length} problem(s)\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error('')
  process.exit(1)
}

console.log('assert-self-contained: this repository is the whole of this plugin')
