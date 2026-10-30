import { expect, test, type BrowserContext } from '@playwright/test';
import { createRoom, joinRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Timer', () => {
    test('timer start, pause and reset stay in sync', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode);
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await expect(voterPage.getByRole('button', { name: 'Start Timer' })).toHaveCount(0);

            await adminPage.getByRole('button', { name: 'Start Timer' }).click();
            await adminPage.getByRole('menuitem', { name: '30 Seconds' }).click();

            // The reset control only exists once the timer does, so the role gate
            // has to be asserted here rather than before the countdown starts.
            await expect(voterPage.getByRole('button', { name: 'Reset Timer' })).toHaveCount(0);

            const adminTimer = adminPage.getByText(/^\d:\d{2}$/);
            const voterTimer = voterPage.getByText(/^\d:\d{2}$/);
            await expect(adminTimer).toBeVisible();
            await expect(voterTimer).toBeVisible();

            const initialVoterText = await voterTimer.innerText();
            await voterPage.waitForTimeout(2000);
            await expect(voterTimer).not.toHaveText(initialVoterText);

            await adminPage.getByRole('button', { name: 'Toggle timer' }).click();
            await adminPage.waitForTimeout(1500);
            const pausedAdminText = await adminTimer.innerText();
            const pausedVoterText = await voterTimer.innerText();
            await adminPage.waitForTimeout(1600);
            await expect(adminTimer).toHaveText(pausedAdminText);
            await expect(voterTimer).toHaveText(pausedVoterText);

            await adminPage.getByRole('button', { name: 'Reset Timer' }).click();
            await expect(adminTimer).toHaveText('0:30');
            await expect(voterTimer).toHaveText('0:30');
            await adminPage.waitForTimeout(1600);
            await expect(adminTimer).toHaveText('0:30');
            await expect(voterTimer).toHaveText('0:30');
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
