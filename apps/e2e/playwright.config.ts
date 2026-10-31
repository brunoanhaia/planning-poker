import { defineConfig, devices } from '@playwright/test';

// An empty CI variable must mean "unset": `baseURL: ''` is invalid and `??`
// would keep the empty string, so the empty case is mapped explicitly.
const baseUrlEnv = process.env.E2E_BASE_URL;
const externalBaseUrl = baseUrlEnv === '' ? undefined : baseUrlEnv;

export default defineConfig({
    testDir: './tests',
    testIgnore: ['**/chaos-container.spec.ts'],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: externalBaseUrl ?? 'http://localhost:5173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: externalBaseUrl
        ? undefined
        : [
              {
                  command: 'npm run dev:server',
                  port: 5000,
                  reuseExistingServer: !process.env.CI,
                  cwd: '../../',
              },
              {
                  command: 'npm run dev:client',
                  port: 5173,
                  reuseExistingServer: !process.env.CI,
                  cwd: '../../',
              },
          ],
});
