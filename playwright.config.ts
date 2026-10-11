import { defineConfig, devices } from '@playwright/test'

// PW_PORT lets a run avoid a port another project already holds.
const PORT = Number(process.env.PW_PORT ?? 4173)
// Production base path (see vite.config.ts) — the preview server serves the
// build under this sub-path, matching GitHub Pages.
const BASE_URL = `http://localhost:${PORT}/dead-of-winner/`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Each spec drives a full 3D table; 12 parallel headless WebGL pages (the 24-core default) starve one another past
  // the 30 s default. Four workers and a 90 s budget keep runs green without hiding real hangs.
  workers: 4,
  timeout: 90_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
