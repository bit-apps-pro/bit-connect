#!/usr/bin/env node
/* eslint-disable no-console */

import fse from 'fs-extra'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

console.log('🔄️ Syncing plugin common files...')

if (process.cwd().includes('_bitapps-plugin-commons')) {
  process.chdir('..')
}

console.log('Current Working Dir', process.cwd())

await Promise.all([
  fse.emptyDir('./frontend/_plugin-commons'),
  fse.emptyDir('./.config/_plugin-commons'),
  fse.emptyDir('./pro/backend/_plugin-commons')
])

console.log('✅ Delete existing plugin common files')

await Promise.all([
  fse.ensureDir('./frontend/_plugin-commons'),
  fse.ensureDir('./.config/_plugin-commons'),
  fse.ensureDir('./pro/backend/_plugin-commons')
])

await Promise.all([
  fse.copy('./_bitapps-plugin-commons/frontend', './frontend/_plugin-commons', { overwrite: true }),
  fse.copy('./_bitapps-plugin-commons/configs', './.config/_plugin-commons', { overwrite: true }),
  fse.copy('./_bitapps-plugin-commons/backend/pro', './pro/backend/_plugin-commons', { overwrite: true })
  // fse.copy('./_bitapps-plugin-commons/backend/free', '/backend/_plugin-commons', { overwrite: true })
])
  .then(() => {
    console.log('✅ Plugin common files synced')
  })
  .catch(error => {
    console.error('❌ Error syncing plugin common files', error)
  })

const proComposerFilePath = './pro/composer.json'

const backendDirectory = './pro/backend/_plugin-commons/src'

if (!fse.existsSync(proComposerFilePath)) {
  console.error('❌️ pro/composer.json file not found')
  process.exit(1) // Exit the script
}

const composerData = await fse.readJson(proComposerFilePath)

const psr4Namespaces = composerData.autoload?.['psr-4']

if (!psr4Namespaces) {
  console.error('❌️ psr-4 autoload section not found in', proComposerFilePath)
  process.exit(1)
}

const namespaceKeys = Object.keys(psr4Namespaces)

if (!namespaceKeys[1]) {
  console.error('❌️ Common Namespace not found in', proComposerFilePath)
  process.exit(1)
}

const newNamespace = namespaceKeys[1].replace(/\\$/, '')

const targetNamespace = String.raw`BitApps\\Utils`

// Function to update namespaces
function updateNamespace(directoryPath, oldNamespace, newNamespace) {
  const filesAndFolders = fs.readdirSync(directoryPath)

  filesAndFolders.forEach(item => {
    const itemPath = path.join(directoryPath, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      updateNamespace(itemPath, oldNamespace, newNamespace)
    } else if (stat.isFile() && path.extname(itemPath) === '.php') {
      const fileContent = fs.readFileSync(itemPath, 'utf8')

      if (fileContent) {
        const updatedContent = fileContent.replaceAll(new RegExp(oldNamespace, 'g'), newNamespace)

        fs.writeFileSync(itemPath, updatedContent, 'utf8')
      }
    }
  })
}

updateNamespace(backendDirectory, targetNamespace, newNamespace)
