import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    testMatch: '**/chaos-container.spec.ts',
    workers: 1,
    use: { baseURL: process.env.E2E_BASE_URL, trace: 'on-first-retry' },
});
