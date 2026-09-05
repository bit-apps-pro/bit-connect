import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStaticHandler } from 'react-router'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The client app graph imports browser-only modules (e.g. Quill) that touch
// `document`/`window` at module-eval time. Provide a lightweight DOM (happy-dom)
// on the Node globals before the app is loaded so those imports don't throw.
async function setupDom() {
  const { Window } = await import('happy-dom')
  const win = new Window({ url: 'http://localhost' })

  const define = (key, value) => {
    if (value === undefined) return
    try {
      if (globalThis[key] === undefined) {
        Object.defineProperty(globalThis, key, { configurable: true, value, writable: true })
      }
    } catch {
      // Some globals (e.g. navigator on newer Node) are read-only — skip them.
    }
  }

  define('window', win)
  define('document', win.document)
  define('navigator', win.navigator)
  define('location', win.location)

  const carry = [
    'HTMLElement', 'HTMLDivElement', 'HTMLInputElement', 'Node', 'Element',
    'DocumentFragment', 'Text', 'Event', 'CustomEvent', 'MutationObserver',
    'getComputedStyle', 'DOMParser', 'requestAnimationFrame', 'cancelAnimationFrame',
    'customElements', 'CSSStyleSheet', 'matchMedia', 'ResizeObserver', 'IntersectionObserver'
  ]
  for (const key of carry) define(key, win[key])
}

async function prerender() {
  console.log('Starting prerender process...')

  await setupDom()

  const vite = await createServer({
    appType: 'custom',
    configFile: path.resolve(process.cwd(), 'vite.config.client.ssr.mts'),
    mode: 'production',
    // This server exists only to ssrLoadModule() the app graph once — it never
    // serves a request or reloads. Leaving the file watcher on makes a one-shot
    // build script claim an inotify watch per directory it touches, which fails
    // outright (ENOSPC) on a machine already running editors, dev servers and
    // containers. `watch: null` disables chokidar; HMR has nothing to notify.
    server: { hmr: false, middlewareMode: true, watch: null }
  })

  try {
    const template = await fs.readFile(
      path.resolve(process.cwd(), 'frontend/client/public/index.html'),
      'utf8'
    )

    const { render, routes } = await vite.ssrLoadModule(
      path.resolve(process.cwd(), 'frontend/client/src/prerender-main.tsx')
    )
    const routePaths = []
    const handler = createStaticHandler(routes)

    console.log(`Found ${routes.length} routes to prerender`)

    const outputDir = path.resolve(process.cwd(), 'assets/client/ssr')
    await fs.mkdir(outputDir, { recursive: true })

    for (const route of routes) {
      // Only static routes can be prerendered to a single HTML file. Dynamic
      // (`:param`) and catch-all (`*`) routes can't map to one file, so they
      // fall back to client-side rendering at runtime.
      if (!route.path || route.path.includes('*') || route.path.includes(':')) continue

      console.log(`Prerendering: ${route.path}`)

      try {
        const request = new Request(`http://localhost${route.path}`)
        const context = await handler.query(request)

        if (context instanceof Response) {
          console.warn(`Skipping ${route.path} (redirect)`)
          continue
        }

        const appHtml = await render(context)
        const html = appHtml.replaceAll(/<script>[\s\S]*?<\/script>/g, '')

        let outputPath

        outputPath =
          route.path === '/'
            ? path.join(outputDir, 'index.html')
            : path.join(outputDir, `${route.path.replace(/^\//, '')}.html`)

        // Nested routes (e.g. /settings/profile) need their parent dir created.
        await fs.mkdir(path.dirname(outputPath), { recursive: true })

        routePaths.push(route.path)
        await fs.writeFile(outputPath, html)
        console.log(`✓ Generated: ${outputPath}`)
      } catch (error) {
        console.error(`Failed to prerender ${route.path}:`, error.message)
        vite.ssrFixStacktrace(error)
      }

      await fs.writeFile(
        path.resolve(process.cwd(), 'assets/client/ssr/routes.json'),
        JSON.stringify(routePaths, null, 2)
      )
    }

    console.log('Prerendering completed!')
  } catch (error) {
    console.error('Prerendering failed:', error)
    if (vite) vite.ssrFixStacktrace(error)
    process.exit(1)
  } finally {
    await vite.close()
  }
}

prerender()
