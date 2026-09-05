#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Rewrites the shared commons' path aliases to relative paths.
 *
 * Two reasons, and the second is the one that bites hardest:
 *
 * 1. The commons are written for a plugin with one frontend. Bit Connect has
 *    two, and both tsconfigs `include` ../_plugin-commons/**, so `@common/...`
 *    in a commons file means the *client's* common directory when the client
 *    app type-checks it — a different module that happens to share a name.
 *
 * 2. vite-tsconfig-paths is rooted at frontend/admin, so aliases do not resolve
 *    for importers outside it. frontend/_plugin-commons is outside it. An alias
 *    in a commons file therefore fails at build time, not just ambiguously —
 *    which is why `@plugin-commons/resources/img/fbCommunity.webp` sat broken
 *    and unnoticed for as long as nothing rendered FacebookCommunityCard.
 *
 * This runs as part of `pnpm plugin:commons:cp`, because the sync empties the
 * directory and re-copies upstream: without it, every sync silently reintroduces
 * both problems. Re-running it is safe — rewritten imports no longer match.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COMMONS_DIR = path.join(ROOT, 'frontend', '_plugin-commons')
const ADMIN_SRC = path.join(ROOT, 'frontend', 'admin', 'src')

/** Aliases that point somewhere under the admin app's src. */
const ALIASES = {
  '@common/': 'common/',
  '@components/': 'components/',
  '@config/': 'config/',
  '@icons/': 'icons/',
  '@pages/': 'pages/',
  '@resource/': 'resource/',
  '@static/': 'static/',
  '@utilities/': 'components/utilities/'
}

function collect(directory) {
  const found = []

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      found.push(...collect(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(full)
    }
  }

  return found
}

if (!fs.existsSync(COMMONS_DIR)) {
  console.log('No frontend/_plugin-commons directory — nothing to rewrite.')
  process.exit(0)
}

let changed = 0

for (const file of collect(COMMONS_DIR)) {
  const original = fs.readFileSync(file, 'utf8')
  let updated = original

  // Posix separators: this string ends up in an import, not on disk.
  let toAdmin = path.relative(path.dirname(file), ADMIN_SRC).split(path.sep).join('/')
  if (!toAdmin.startsWith('.')) toAdmin = `./${toAdmin}`

  for (const [alias, target] of Object.entries(ALIASES)) {
    updated = updated.replaceAll(alias, `${toAdmin}/${target}`)
  }

  // `@plugin-commons/*` points back into this same directory. It still has to be
  // rewritten: the alias is unresolvable from here whichever app is building.
  let toCommons = path.relative(path.dirname(file), COMMONS_DIR).split(path.sep).join('/')
  if (toCommons === '') toCommons = '.'
  if (!toCommons.startsWith('.')) toCommons = `./${toCommons}`
  updated = updated.replaceAll('@plugin-commons/', `${toCommons}/`)

  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8')
    changed += 1
  }
}

console.log(`✅ Repointed commons aliases at the admin app in ${changed} file(s)`)
