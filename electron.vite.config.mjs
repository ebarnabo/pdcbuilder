import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve('src/main/index.js') } }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.js') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: { input: { index: resolve('src/renderer/index.html') } }
    },
    plugins: [react()]
  }
})
