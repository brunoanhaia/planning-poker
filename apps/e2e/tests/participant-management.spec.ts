import { expect, test, type BrowserContext } from '@playwright/test';
import { createRoom, joinRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Participant Management', () => {
    test('kick removes the participant and shows the removal notice', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await adminPage.getByRole('button', { name: 'Manage Voter 1' }).click();
            await adminPage.getByRole('menuitem', { name: 'Kick from Room' }).click();

            const noticeDialog = voterPage.getByRole('dialog', { name: /Session Notice/i });
            await expect(noticeDialog).toBeVisible();
            await expect(noticeDialog).toContainText('You have been removed from the session.');

            await noticeDialog.getByRole('button', { name: 'OK' }).click();
            await expect(
                voterPage.getByRole('heading', { name: 'Planit Poker Real-Time' })
            ).toBeVisible();

            await expect(adminPage.getByText('Participants (1)')).toBeVisible();
            await expect(adminPage.getByText('Voter 1', { exact: true })).not.toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });

    test('promotion to co-admin grants the reveal control', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await adminPage.getByRole('button', { name: 'Manage Voter 1' }).click();
            await adminPage.getByRole('menuitem', { name: 'Promote to Co-Admin' }).click();

            await expect(voterPage.getByText('Waiting for Host to reveal')).not.toBeVisible();
            await expect(voterPage.getByRole('button', { name: /Reveal Votes/i })).toBeVisible();

            await adminPage.getByRole('button', { name: 'Manage Voter 1' }).click();
            await expect(
                adminPage.getByRole('menuitem', { name: 'Demote from Co-Admin' })
            ).toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });

    test('spectator sees observer mode and no cards', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await adminPage.getByRole('button', { name: 'Manage Voter 1' }).click();
            await adminPage.getByRole('menuitem', { name: 'Make Spectator' }).click();

            await expect(voterPage.getByText('Observer Mode')).toBeVisible();
            await expect(
                voterPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toHaveCount(0);
            await expect(voterPage.getByText('Spectator')).toBeVisible();

            await adminPage.getByRole('button', { name: 'Manage Voter 1' }).click();
            const makeVoterItem = adminPage.getByRole('menuitem', { name: 'Make Voter' });
            await expect(makeVoterItem).toBeVisible();
            await makeVoterItem.click();

            await expect(
                voterPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
