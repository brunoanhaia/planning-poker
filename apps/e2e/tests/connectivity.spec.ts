import { expect, test, type Page } from '@playwright/test';

import { holdSocketOpen } from './support/connection';

/** Counts the room-creation frames the app sends through the browser socket. */
const countCreateFrames = (page: Page): string[] => {
    const frames: string[] = [];
    page.on('websocket', (socket) => {
        socket.on('framesent', (event) => {
            const frame = String(event.payload);
            if (frame.includes('CREATE_ROOM')) {
                frames.push(frame);
            }
        });
    });
    return frames;
};

test.describe('Connection lifecycle', () => {
    test('queues a create while the socket is held open and sends it exactly once', async ({
        page,
    }) => {
        const socket = await holdSocketOpen(page);
        const createFrames = countCreateFrames(page);

        await page.goto('/');
        await page.getByLabel(/Your Display Name/i).fill('Queued Host');

        const create = page.getByRole('button', { name: 'Enter Room', exact: true });
        // The second click lands while the first request is still queued; the
        // provider must ignore it instead of creating a second room.
        await create.click({ clickCount: 2, delay: 20 });

        await expect(page.getByText(/Your request will run as soon as/)).toBeVisible();
        expect(createFrames).toHaveLength(0);

        await socket.release();

        await expect(page.getByText(/^Room: /)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Queued Host', { exact: true })).toBeVisible();
        await expect(page.getByText(/Participants \(1\)/)).toBeVisible();
        expect(createFrames).toHaveLength(1);
    });

    test('offers a retry after the grace period and the retry sends the queued create', async ({
        page,
    }) => {
        const socket = await holdSocketOpen(page);
        const createFrames = countCreateFrames(page);

        await page.goto('/');
        await page.getByLabel(/Your Display Name/i).fill('Slow Host');
        await page.getByRole('button', { name: 'Enter Room', exact: true }).click();

        await expect(page.getByRole('alert')).toContainText('Waking the server', {
            timeout: 8000,
        });
        const retry = page.getByRole('button', { name: 'Retry now' });
        await expect(retry).toBeVisible();

        // Keep the original dial blocked so only a replacement can send the create.
        await retry.click();
        await socket.release('replacements');

        await expect(page.getByText(/^Room: /)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Slow Host', { exact: true })).toBeVisible();
        expect(createFrames).toHaveLength(1);
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
