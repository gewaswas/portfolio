import { defineConfig } from '@playwright/test';
import { testSettings } from './tests/settings.js';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: testSettings.baseURL,
    channel: 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dsdd.js',
    url: `${testSettings.baseURL}/api/health`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      STORAGE_MODE: 'file',
      DATA_DIR: 'reference/test-data',
      UPLOAD_DIR: 'reference/test-uploads',
      PORT: String(testSettings.apiPort),
      VITE_PORT: String(testSettings.webPort),
      ADMIN_PASSWORD: testSettings.adminPassword,
      PUBLIC_ORIGIN: testSettings.baseURL,
    },
    timeout: 120000,
  },
});
