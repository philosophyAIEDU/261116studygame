import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// E2E 는 핵심 흐름만 검사한다. 실행: npm run e2e -- --trace off
// 미리 설치된 Chromium 이 있으면(클라우드 환경) 그것을 쓴다.
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (fs.existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1100, height: 720 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
