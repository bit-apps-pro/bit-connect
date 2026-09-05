#!/usr/bin/env node

/* eslint-disable no-console */
import { program } from 'commander'
import fse from 'fs-extra'
import path from 'node:path'

import { getPluginVersion, rootDirectory } from './plugin-version.mjs'

program
  .name('rename-build-zip')
  .description('Append the plugin version to zip files produced by bitapps-plugin-build')
  .option('-o, --outdir <char>', 'specify output directory', 'build')
  .requiredOption('-s, --slug <char>', 'specify plugin slug')
  .parse()

const { outdir, slug: pluginSlug } = program.opts()
const pluginVersion = getPluginVersion(pluginSlug)

// bitapps-plugin-build emits `<slug>.zip` (free) and `<slug>-pro.zip` (pro).
const zipNames = [pluginSlug, `${pluginSlug}-pro`]

for (const name of zipNames) {
  const source = path.resolve(rootDirectory, outdir, `${name}.zip`)

  if (!(await fse.pathExists(source))) continue

  const destination = path.resolve(rootDirectory, outdir, `${name}-${pluginVersion}.zip`)
  await fse.move(source, destination, { overwrite: true })
  console.log(`Renamed: ${path.basename(source)} -> ${path.basename(destination)}`)
}
