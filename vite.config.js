import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Vite 8 warns when react-swc delegates production JSX through esbuild.
      // An explicit no-op SWC plugin list keeps the production transform on SWC.
      plugins: [],
      disableOxcRecommendation: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        login: resolve(rootDir, 'login.html'),
        lobby: resolve(rootDir, 'lobby.html'),
        arena: resolve(rootDir, 'arena.html'),
        battle: resolve(rootDir, 'battle.html'),
        rulebook: resolve(rootDir, 'rulebook.html'),
        about: resolve(rootDir, 'about.html'),
        devs: resolve(rootDir, 'devs.html'),
        admin: resolve(rootDir, 'admin.html'),
      }
    }
  }
})
