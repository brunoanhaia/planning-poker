import { expect, test, type Page } from '@playwright/test';

import { createRoom } from './support/room-session';

test.use({ locale: 'en-US' });

/** Copy the superseded tab renders once another tab of the same browser takes over. */
const REPLACED_NOTICE = 'This room was opened in another tab. This tab stopped updating.';

/**
 * Joins `roomCode` from an already open page.
 *
 * The room code in the URL hash makes the join tab the active one and pre-fills
 * the code field, so the visitor only picks a display name. Being inside the
 * room is confirmed by the estimation deck rather than by the join form closing.
 */
const joinInTab = async (page: Page, roomCode: string, name: string): Promise<void> => {
    await page.goto(`/#${roomCode}`);
    await page.locator('#profile-display-name').fill(name);
    await page.getByRole('button', { name: 'Join Room Now' }).click();
    await expect(
        page.getByRole('button', { name: 'Select estimate 5', exact: true })
    ).toBeVisible();
};

test.describe('Session Identity', () => {
    test('a second tab of the same browser takes over the participant', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        const voterContext = await browser.newContext({ locale: 'en-US' });
        const otherContext = await browser.newContext({ locale: 'en-US' });

        try {
            const rosterRows = adminPage.locator('li').filter({ hasText: 'dddd' });

            const tabA = await voterContext.newPage();
            await joinInTab(tabA, roomCode, 'dddd');
            await expect(rosterRows).toHaveCount(1);

            // Same context means the same browser, so the stored participant
            // token is reused instead of minting a second participant.
            const tabB = await voterContext.newPage();
            await joinInTab(tabB, roomCode, 'dddd');

            await expect(rosterRows).toHaveCount(1);
            await expect(tabA.getByText(REPLACED_NOTICE)).toBeVisible();

            // A separate context is a separate browser, so the name no longer
            // identifies the participant and a second row is expected.
            const otherTab = await otherContext.newPage();
            await joinInTab(otherTab, roomCode, 'dddd');

            await expect(rosterRows).toHaveCount(2);
        } finally {
            await otherContext.close();
            await voterContext.close();
            await adminContext.close();
        }
    });
});
