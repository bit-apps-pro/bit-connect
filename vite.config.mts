import react from '@vitejs/plugin-react'
import { checkSubmoduleUpdatesPlugin } from 'bitapps-dev-utils'
import detectPort from 'detect-port'
import { humanId } from 'human-id'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import fs from 'node:fs'
import { type AddressInfo } from 'node:net'
import path, { join } from 'node:path'
import { type Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import developmentServerOrigin from './scripts/development-server-origin.mjs'
import overlay from './scripts/vite-plugin-overlay.mjs'

const PLUGIN_SLUG = 'bit-connect'
// The global the PHP side prints the server payload onto: Head.php writes
// `window.<Config::VAR_PREFIX>`, and every bare SERVER_VARIABLES read in the
// source is `define`d to it below. `.env` may override the name, but it must
// never be *required* — without a default, a clean clone builds
// `window.undefined` and the admin app dies on its first config read.
// Derived from the slug so it cannot drift from VAR_PREFIX.
const DEFAULT_SERVER_VARIABLES = `${PLUGIN_SLUG.replace(/-/g, '_')}_`
// An optional second source tree whose modules replace this one's where their
// paths match, used to build a variant of this plugin from these sources
// without copying them — see scripts/vite-plugin-overlay.mjs. Both variables
// are unset for a build of this plugin itself, and every line below then
// describes that build exactly.
const OVERLAY_DIR = process.env.BIT_OVERLAY_DIR
const ASSETS_DIR = process.env.BIT_ASSETS_OUT_DIR
  ? path.resolve(process.env.BIT_ASSETS_OUT_DIR)
  : path.resolve(import.meta.dirname, 'assets')
const codeName = humanId({ capitalize: false, separator: '-' })

// const getVersion = () => {
//   let version = '1.0.0'
//   if (fs.existsSync('readme.txt')) {
//     const readme = fs.readFileSync('readme.txt').toString()
//     const regex = /Stable\s+tag:\s+(\d+\.\d+(\.?\d+)*)/
//     const match = readme.match(regex)
//     version = match ? match[1] : '1.0.0'
//   }
//   return version
// }
export default defineConfig(({ command, mode }) => {
  const { DEV_SSL, DEV_SSL_CERT_PATH, DEV_SSL_KEY_PATH, SERVER_VARIABLES } = loadEnv(
    mode,
    process.cwd(),
    ''
  )

  const isTest = mode === 'test'

  return {
    assetsDir: 'assets/admin',
    base: '',
    cacheDir: 'node_modules/.vite-admin',
    build: {
      emptyOutDir: true,
      outDir: ASSETS_DIR,
      rollupOptions: {
        input: path.resolve(import.meta.dirname, 'frontend/admin/src/main.tsx'),
        output: {
          assetFileNames: fInfo => {
            const pathArr = fInfo?.name?.split('/')
            const fileName = pathArr?.at(-1)

            if (fileName === 'main.css') {
              return `main-${PLUGIN_SLUG}-ba-assets-${codeName}.css`
            }

            if (fileName === 'logo.svg') {
              return `logo.svg`
            }

            // Content hash — collision-free and cache-busting. The previous
            // Math.random() over 999 buckets could clobber assets in one build.
            return `${PLUGIN_SLUG}-[hash].[ext]`
          },
          chunkFileNames: fInfo => {
            const name = typeof fInfo.name === 'string' ? fInfo.name.slice(0, 8).toLowerCase() : ''
            const chunkName = `${name}-[hash].js`
            return chunkName
          },
          entryFileNames: `main-${codeName}.js`,
          generatedCode: {
            arrowFunctions: true,
            constBindings: true,
            objectShorthand: true,
            preset: 'es2015'
          }
        }
      }
    },
    define: {
      ...(!isTest && { SERVER_VARIABLES: `window.${SERVER_VARIABLES || DEFAULT_SERVER_VARIABLES}` })
    },
    envPrefix: 'BIT_CONNECT_VITE_',
    plugins: [
      react({
        babel: {
          plugins: ['@emotion/babel-plugin'],
          // The jotai preset serves the dev server: debug labels and the
          // `jotaiAtomCache` preamble that keeps atoms stable across HMR. In a
          // production build that preamble is dead weight in every module and
          // keeps otherwise-empty helper modules alive as their own chunks.
          presets: command === 'serve' ? ['jotai/babel/preset'] : []
        },
        jsxImportSource: '@emotion/react',
        jsxRuntime: 'automatic'
      }),
      overlay({
        appRoot: path.resolve(import.meta.dirname, 'frontend/admin'),
        overlayDir: OVERLAY_DIR,
        mirrorRoot: path.resolve(import.meta.dirname, 'frontend')
      }),
      tsconfigPaths({
        root: path.resolve(import.meta.dirname, 'frontend/admin/')
      }),
      checkSubmoduleUpdatesPlugin(),
      {
        name: 'vite-plugin-build-code-name',
        closeBundle() {
          if (process.env.NODE_ENV !== 'production') return
          const filePath = join(ASSETS_DIR, 'build-code-name.txt')
          if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true })
          writeFileSync(filePath, codeName, { encoding: 'utf-8' })
        }
      },
      ...([
        process.env.BIT_CONNECT_FRONTEND_ADMIN_HOST ? undefined : setDevelopmentServerConfig()
      ].filter(Boolean) as Plugin[])
      // viteStaticCopy({
      //   targets: [
      //     {
      //       src: normalizePath(path.resolve(__dirname, './frontend/_plugin-commons/resources/css/antd-reset.css')),
      //       dest: `../${ASSETS_DIR}/`
      //     }
      //   ]
      // })
    ],
    root: 'frontend/admin',
    server: {
      ...(DEV_SSL === 'true' && {
        https: {
          cert: DEV_SSL_CERT_PATH,
          key: DEV_SSL_KEY_PATH
        }
      }),
      allowedHosts: true,
      cors: true, // required to load scripts from custom host
      hmr: {
        host: process.env.BIT_CONNECT_FRONTEND_ADMIN_HOST ?? 'localhost'
      },
      host: '0.0.0.0',
      // Absolute asset URLs, so a CSS url() resolves on this server rather
      // than on the WordPress page that embeds the bundle — see the helper.
      // The port-detecting plugin above repeats this with the port it found.
      origin: developmentServerOrigin(process.env.BIT_CONNECT_FRONTEND_ADMIN_HOST, 3000),
      port: 3000,
      strictPort: true, // strict port to match on PHP side
      watch: {
        // Keep the inotify watch count low: skip vendored, generated and
        // tooling output dirs. A lockfile-triggered re-optimize otherwise
        // re-watches these and can exhaust fs.inotify.max_user_watches.
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/build',
          '**/vendor',
          '**/.fallow',
          '**/assets',
          '**/playwright-report',
          '**/.playwright-mcp',
          '**/test-results'
        ]
      }
    },
    ssr: {
      noExternal: isTest ? ['@vitejs/plugin-react'] : []
    },
    test: {
      environment: 'happy-dom',
      // environment: 'jsdom',
      globals: true,
      include: ['frontend/admin/src/**/*.test.{tsx,ts}', '_bitapps-plugin-commons/**/*.test.{tsx,ts}'],
      root: './',
      setupFiles: ['./frontend/admin/src/config/test.setup.ts'],
      testTimeout: 10_000
    }
  }
})

function setDevelopmentServerConfig(): Plugin {
  return {
    async config(_, environment) {
      if (environment?.mode === 'development') {
        let port = getStoredPort()
        if (!port) {
          port = await detectPort(3000).then((detectedPort: number) => detectedPort)
          updateStoredPort(port)
        }
        // Absolute asset URLs, so a CSS url() resolves on this server rather
        // than on the WordPress page that embeds the bundle — see the helper.
        return { server: { origin: developmentServerOrigin(process.env.BIT_CONNECT_FRONTEND_ADMIN_HOST, port), port } }
      }
      removeStoredPort()
    },
    configureServer(server) {
      if (server.httpServer) {
        server.httpServer.once('listening', () => {
          const { port } = server.httpServer?.address() as AddressInfo
          const storedPort = getStoredPort()
          if (port !== storedPort) {
            updateStoredPort(port)
          }
        })

        server.watcher.add(['.port'])
        server.watcher.on('change', (file: string) => {
          if (file === '.port') {
            server.config.logger.warnOnce('Server restarting for origin mismatch', { timestamp: true })
            server.restart()
          }
        })

        server.httpServer.close(() => {
          server.watcher.close()
          removeStoredPort()
        })
      }
    },
    name: 'vite-plugin-set-dev-server-config'
  }
}

const portFile = path.resolve(import.meta.dirname, './.port')

function getStoredPort() {
  let port = 0
  if (fs.existsSync(portFile)) {
    port = Number(fs.readFileSync(portFile))
  }

  return port
}

function updateStoredPort(port: number) {
  fs.writeFileSync(portFile, String(port))
}

function removeStoredPort() {
  if (fs.existsSync(portFile)) {
    fs.rmSync(portFile)
  }
}
