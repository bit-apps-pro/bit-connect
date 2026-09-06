#!/usr/bin/env node

/* eslint-disable no-console */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { exit } from 'node:process'
import { program } from 'commander'

import fse from 'fs-extra'

import { getPluginVersion, rootDirectory } from './plugin-version.mjs'

const run = (command, options = {}) => execSync(command, { stdio: 'inherit', ...options })

const commandExistsSync = (command) => {
  try {
    execSync(command, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

program
  .name('build-plugin')
  .description('Build plugin package (without pro)')
  .option('-o, --outdir <char>', 'specify output directory', 'build')
  .option('-z, --zip', 'generate zip file', false)
  .option('-cb, --cleanbuild', 'delete staging directory after zip', false)
  .option('-nb, --nobuild', 'skip frontend build', false)
  .option('-ni, --noi18n', 'skip i18n generation', false)
  .requiredOption('-s, --slug <char>', 'specify plugin slug')
  .parse()

const {
  outdir,
  slug: pluginSlug,
  zip,
  cleanbuild,
  nobuild,
  noi18n,
} = program.opts()

const pluginVersion = getPluginVersion(pluginSlug)
// The staging directory keeps the bare slug — that becomes the installed plugin
// folder name — while only the zip carries the version.
const outputDirectory = path.resolve(rootDirectory, outdir, pluginSlug)
const outputZip = path.resolve(rootDirectory, outdir, `${pluginSlug}-${pluginVersion}.zip`)

const filesAndFolders = [
  'assets',
  'backend',
  'vendor',
  `${pluginSlug}.php`,
  'readme.txt',
  'composer.json',
]

console.log('options passed:', {
  outdir,
  pluginSlug,
  pluginVersion,
  zip,
  outputDirectory,
  cleanbuild,
  nobuild,
  noi18n,
})

if (
  !commandExistsSync('composer --version')
  || !commandExistsSync('php --version')
  || (zip && !commandExistsSync('zip --version'))
) {
  console.error('Missing required command(s): composer/php/zip')
  exit(1)
}

if (!nobuild)
  run('pnpm run build', { cwd: rootDirectory })

if (!noi18n)
  run('pnpm i18n', { cwd: rootDirectory })

run('composer install --no-dev --optimize-autoloader', { cwd: rootDirectory })

// Everything below strips the dev environment. If any staging step throws, the
// finally block must still restore dev dependencies — otherwise a failed build
// leaves the working tree without dev deps.
try {
  await Promise.all([
    fse.emptyDir(outputDirectory),
    fse.remove(outputZip),
    // drop the pre-versioning artifact so `build/*.zip` never resolves to a stale build
    fse.remove(path.resolve(rootDirectory, outdir, `${pluginSlug}.zip`)),
  ])

  for (const item of filesAndFolders) {
    const sourcePath = path.resolve(rootDirectory, item)
    const destinationPath = path.resolve(outputDirectory, item)
    await fse.copy(sourcePath, destinationPath)
  }

  if (zip)
    run(`zip -rq "${outputZip}" "${pluginSlug}"`, { cwd: path.resolve(rootDirectory, outdir) })
} finally {
  await fse.remove(path.resolve(rootDirectory, 'vendor'))
  run('composer install', { cwd: rootDirectory })
}

if (cleanbuild)
  await fse.remove(outputDirectory)

console.log(`Done: ${outputZip}`)
