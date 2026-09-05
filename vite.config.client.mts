import react from '@vitejs/plugin-react'
import { humanId } from 'human-id'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path, { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const PLUGIN_SLUG = 'bit-connect'
// See vite.config.mts — BaseView.php prints the portal payload onto this same
// global, and the default keeps a clean clone (no `.env`) from building
// `window.undefined`.
const DEFAULT_SERVER_VARIABLES = `${PLUGIN_SLUG.replace(/-/g, '_')}_`
// See vite.config.mts — same two-build scheme, one level deeper because the
// portal bundle lives under the admin bundle's directory.
const isPro = process.env.VITE_PRO === 'true'
const ASSETS_DIR = path.resolve(import.meta.dirname, isPro ? 'pro/assets/client' : 'assets/client')
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
    assetsDir: 'assets/client',
    base: '',
    cacheDir: 'node_modules/.vite-client',
    build: {
      emptyOutDir: true,
      outDir: ASSETS_DIR,
      rollupOptions: {
        external: ['@wordpress/interactivity'],
        input: path.resolve(import.meta.dirname, 'frontend/client/src/main.tsx'),
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
      },
      target: 'es2022'
    },
    define: {
      ...(!isTest && { SERVER_VARIABLES: `window.${SERVER_VARIABLES || DEFAULT_SERVER_VARIABLES}` })
    },
    optimizeDeps: {
      exclude: ['@wordpress/interactivity'],
      include: ['quill']
    },
    plugins: [
      react({
        babel: {
          plugins: ['@emotion/babel-plugin'],
          presets: ['jotai/babel/preset']
        },
        jsxImportSource: '@emotion/react',
        jsxRuntime: 'automatic'
      }),
      tsconfigPaths({
        root: path.resolve(import.meta.dirname, 'frontend/client/')
      }),
      {
        name: 'vite-plugin-build-code-name',
        closeBundle() {
          // Gate on vite's own command, not NODE_ENV — a `--mode development`
          // build still needs build-code-name.txt or PHP enqueues `main-.js`.
          if (command !== 'build') return
          const filePath = join(ASSETS_DIR, 'build-code-name.txt')
          if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true })
          writeFileSync(filePath, codeName, { encoding: 'utf-8' })
        }
      }
      // viteStaticCopy({
      //   targets: [
      //     {
      //       src: normalizePath(path.resolve(__dirname, './frontend/_plugin-commons/resources/css/antd-reset.css')),
      //       dest: `../${ASSETS_DIR}/`
      //     }
      //   ]
      // })
    ],
    root: 'frontend/client',
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
        host: process.env.BIT_CONNECT_FRONTEND_CLIENT_HOST ?? 'localhost'
      },
      host: '0.0.0.0',
      port: 3001,
      strictPort: true, // strict port to match on PHP side
      warmup: {
        clientFiles: ['./src/main.tsx', './src/components/quilTextEditor/QuillEditor.tsx']
      },
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
      include: [
        'frontend/client/**/*.test.{tsx,ts}',
        // Shared with the admin panel but only run here, so one suite owns it.
        'frontend/shared/**/*.test.{tsx,ts}',
        '_bitapps-plugin-commons/**/*.test.{tsx,ts}'
      ],
      root: './',
      setupFiles: ['./frontend/client/src/config/test.setup.ts'],
      testTimeout: 10_000
    }
  }
})
