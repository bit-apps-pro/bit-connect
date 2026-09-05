import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // Resolve the SERVER_VARIABLES global at build time (the client config reads
  // it as a bare identifier). The prerender provides a DOM (happy-dom), so
  // `window` exists and config.ts seeds `window.SERVER_VARIABLES` — map the bare
  // identifier there so both agree.
  define: {
    SERVER_VARIABLES: 'window.SERVER_VARIABLES'
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      external: [
        // Keep it external so SSR doesn’t bundle browser-only code
        '@wordpress/interactivity'
      ],
      input: {
        main: path.resolve(import.meta.dirname, 'frontend/client/public/index.html')
      }
    },
    sourcemap: true
  },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      less: {
        javascriptEnabled: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router', 'antd', '@ant-design/icons', 'react-use']
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
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'frontend/client/src'),
      '@wordpress/interactivity': path.resolve(
        import.meta.dirname,
        'frontend/client/src/mocks/wp-interactivity.ts'
      )
    }
  },
  ssr: {
    noExternal: [
      '@wordpress/interactivity',
      'rc-util',
      'rc-picker',
      '@ant-design/icons',
      'react-use',
      'styled-components',
      'react-router'
    ]
  }
})
