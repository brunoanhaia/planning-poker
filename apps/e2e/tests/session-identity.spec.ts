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

    test('opening another room ends the session this browser left behind', async ({ browser }) => {
        const roomA = await createRoom(browser);
        const roomB = await createRoom(browser);
        const userContext = await browser.newContext({ locale: 'en-US' });

        try {
            const tabA = await userContext.newPage();
            await joinInTab(tabA, roomA.roomCode, 'dddd');
            await expect(roomA.adminPage.getByText('Participants (2)')).toBeVisible();

            // The same browser opening a second room is a switch, so the second
            // tab asks before the session the first tab holds is ended.
            const tabB = await userContext.newPage();
            await tabB.goto(`/#${roomB.roomCode}`);
            await tabB.locator('#profile-display-name').fill('dddd');
            await tabB.getByRole('button', { name: 'Join Room Now' }).click();

            const switchDialog = tabB.getByRole('dialog');
            await expect(switchDialog).toContainText('Another session is open');
            await expect(switchDialog).toContainText(roomA.roomCode);

            await tabB.getByRole('button', { name: 'End it and continue' }).click();
            await expect(
                tabB.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toBeVisible();

            // The superseded tab returns to the lobby with the reason stated.
            await expect(
                tabA.getByText(
                    'This session ended because the room was opened somewhere else in this browser.'
                )
            ).toBeVisible();
            await expect(tabA.locator('#join-session-room-code')).toBeVisible();

            // Room A lost the participant and room B has it exactly once.
            await expect(roomA.adminPage.getByText('Participants (1)')).toBeVisible();
            await expect(roomA.adminPage.locator('li').filter({ hasText: 'dddd' })).toHaveCount(0);
            await expect(roomB.adminPage.getByText('Participants (2)')).toBeVisible();
            await expect(roomB.adminPage.locator('li').filter({ hasText: 'dddd' })).toHaveCount(1);
        } finally {
            await userContext.close();
            await roomB.adminContext.close();
            await roomA.adminContext.close();
        }
    });
});
