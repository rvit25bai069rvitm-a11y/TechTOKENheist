import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        lobby: resolve(__dirname, 'lobby.html'),
        arena: resolve(__dirname, 'arena.html'),
        battle: resolve(__dirname, 'battle.html'),
        rulebook: resolve(__dirname, 'rulebook.html'),
        about: resolve(__dirname, 'about.html'),
        devs: resolve(__dirname, 'devs.html'),
        admin: resolve(__dirname, 'admin.html'),
      }
    }
  }
})
