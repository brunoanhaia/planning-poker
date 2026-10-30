import { defineConfig } from '@playwright/test';

// An empty variable must mean "unset", as in the base config.
const externalBaseUrl = process.env.E2E_BASE_URL || undefined;

if (!externalBaseUrl) {
    throw new Error(
        'The chaos config restarts containers, so it needs a running stack: E2E_BASE_URL=' +
            'http://localhost:8080 npx playwright test --config=playwright.chaos.config.ts'
    );
}

export default defineConfig({
    testDir: './tests',
    testMatch: '**/chaos-container.spec.ts',
    workers: 1,
    use: { baseURL: externalBaseUrl, trace: 'on-first-retry' },
});
