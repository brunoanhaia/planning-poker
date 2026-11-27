import { expect, test } from '@playwright/test';

import { createRoom } from './support/room-session';

test.describe('Stored room preflight', () => {
    test('a room the server no longer has is forgotten before the lobby offers it', async ({
        browser,
    }) => {
        const context = await browser.newContext({ locale: 'en-US' });
        const page = await context.newPage();
        try {
            // Reproduce a browser that still records a room the server lost
            // after every participant left (an idle sweep or a restart).
            await page.addInitScript(() => {
                localStorage.setItem('planit_active_room', 'GHZ7M9SM');
                localStorage.setItem('planit_room_token:GHZ7M9SM', 'stale-token');
                localStorage.setItem('planit_name', 'AA');
                localStorage.setItem('planit_avatar', '🚀');
                localStorage.setItem('planit_color', '#6366f1');
            });
            await page.goto('/');

            const create = page.getByRole('button', { name: 'Enter Room', exact: true });
            // The preflight holds the action until the server answers.
            await expect(create).toBeEnabled({ timeout: 10000 });
            await expect
                .poll(() => page.evaluate(() => localStorage.getItem('planit_active_room')))
                .toBeNull();
            await expect
                .poll(() => page.evaluate(() => localStorage.getItem('planit_room_token:GHZ7M9SM')))
                .toBeNull();

            await create.click();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(page.getByText(/^Room: /)).toBeVisible({ timeout: 10000 });
        } finally {
            await context.close();
        }
    });

    test('a room that still exists still opens the switch dialog', async ({ browser }) => {
        const { adminContext, roomCode } = await createRoom(browser);
        const secondPage = await adminContext.newPage();
        try {
            await secondPage.goto('/');

            const create = secondPage.getByRole('button', { name: 'Enter Room', exact: true });
            await expect(create).toBeEnabled({ timeout: 10000 });
            await create.click();

            const dialog = secondPage.getByRole('dialog', { name: /Another session is open/ });
            await expect(dialog).toBeVisible();
            await expect(dialog).toContainText(roomCode);
        } finally {
            await secondPage.close();
            await adminContext.close();
        }
    });
});
