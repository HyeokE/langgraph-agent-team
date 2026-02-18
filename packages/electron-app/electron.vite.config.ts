import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // workspace 패키지는 번들에 포함 (외부화 제외)
        exclude: ['@agent-team/langgraph-team-factory']
      })
    ],
    resolve: {
      // pnpm 심볼링크 해석
      preserveSymlinks: false
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    }
  }
})
