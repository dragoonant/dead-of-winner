import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path (github.com/<org>/dead-of-winner ->
// <org>.github.io/dead-of-winner/) in production; dev server stays at root.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/dead-of-winner/' : '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // manualChunks-style split (Rolldown's codeSplitting groups): the 3D stack (three + R3F + drei), the rules engine + card data
        // (+ ajv), and the in-game client UI each get their own chunk; the title screen (index) stays light.
        codeSplitting: {
          groups: [
            { name: 'react', priority: 40, test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/ },
            { name: 'three', priority: 30, test: /node_modules[\\/](three|@react-three|three-stdlib|camera-controls|maath|troika[^\\/]*|meshline|@monogrid|stats-gl|suspend-react|its-fine|react-use-measure|hls\.js|@use-gesture|detect-gpu|tunnel-rat|@mediapipe|potpack|bidi-js|webgl-sdf-generator|lil-gui|three-mesh-bvh)[\\/]/ },
            { name: 'engine', priority: 20, test: /([\\/]src[\\/](engine|data|ai)[\\/])|([\\/]src[\\/]client[\\/]dataBundle\.ts$)|(node_modules[\\/](ajv|ajv-formats|fast-deep-equal|fast-uri|json-schema-traverse|require-from-string)[\\/])/ },
            // the title screen's own modules stay out of the game chunks so the start screen loads without three or the engine
            { name: 'title', priority: 35, test: /[\/]src[\/](main\.tsx|client[\/]((App|launch|data|dataLoad)\.tsx?|audio[\/][^\/]+\.tsx?|ui[\/](StartScreen\.tsx|hud\.css)|store[\/](settingsStore|savePeek|storage)\.ts|table[\/]seats\.ts|cards[\/]art\.ts))$/ },
            { name: 'client', priority: 10, test: /[\\/]src[\\/]client[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000, // CI runners are ~2x slower than local; heavy engine tests (charge search) exceed 5s there
  },
}))
