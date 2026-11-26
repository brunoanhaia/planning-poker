import { expect, test } from '@playwright/test';

import { delaySocketOpen } from './support/connection';

test.describe('Connection lifecycle', () => {
    test('queues a create while the socket opens and sends it exactly once', async ({ page }) => {
        await delaySocketOpen(page, 2000);

        const createFrames: string[] = [];
        page.on('websocket', (socket) => {
            socket.on('framesent', (event) => {
                const frame = String(event.payload);
                if (frame.includes('CREATE_ROOM')) {
                    createFrames.push(frame);
                }
            });
        });

        await page.goto('/');
        await page.getByLabel(/Your Display Name/i).fill('Queued Host');

        const create = page.getByRole('button', { name: 'Enter Room', exact: true });
        // The second click lands while the first request is still queued; the
        // provider must ignore it instead of creating a second room.
        await create.click({ clickCount: 2, delay: 20 });

        await expect(page.getByRole('alert')).toContainText('Connecting to the server');
        await expect(page.getByText(/Your request will run as soon as/)).toBeVisible();
        await expect(page.getByText(/^Room: /)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Queued Host', { exact: true })).toBeVisible();
        await expect(page.getByText(/Participants \(1\)/)).toBeVisible();
        expect(createFrames).toHaveLength(1);
    });

    test('reports a cold start after the grace period and offers a retry', async ({ page }) => {
        await delaySocketOpen(page, 6000);

        await page.goto('/');
        await page.getByLabel(/Your Display Name/i).fill('Slow Host');
        await page.getByRole('button', { name: 'Enter Room', exact: true }).click();

        await expect(page.getByRole('alert')).toContainText('Waking the server', {
            timeout: 8000,
        });
        await expect(page.getByRole('button', { name: 'Retry now' })).toBeVisible();
        // The queued create still runs when the delayed socket finally opens.
        await expect(page.getByText(/^Room: /)).toBeVisible({ timeout: 12000 });
        await expect(page.getByText('Slow Host', { exact: true })).toBeVisible();
    });

    test('reports offline and recovers when the browser reconnects', async ({ context, page }) => {
        await page.goto('/');
        await expect(page.getByRole('alert')).toHaveCount(0);

        await context.setOffline(true);
        await expect(page.getByRole('alert')).toContainText('You are offline');

        await context.setOffline(false);
        await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 10000 });
    });
});
