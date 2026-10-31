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
            await expect(voterTimer).not.toHaveText(initialVoterText, { timeout: 5000 });
            await expect(adminPage.getByRole('button', { name: 'Toggle timer' })).toHaveAttribute(
                'aria-pressed',
                'true'
            );

            await adminPage.getByRole('button', { name: 'Toggle timer' }).click();
            await expect(adminPage.getByRole('button', { name: 'Toggle timer' })).toHaveAttribute(
                'aria-pressed',
                'false'
            );
            const pausedText = await adminTimer.innerText();
            await expect(voterTimer).toHaveText(pausedText);

            // Freezing is the one property that needs real elapsed time: a tick
            // would have fired inside the window if the pause had not landed.
            await adminPage.waitForTimeout(1600);
            await expect(adminTimer).toHaveText(pausedText);
            await expect(voterTimer).toHaveText(pausedText);

            await adminPage.getByRole('button', { name: 'Reset Timer' }).click();
            await expect(adminTimer).toHaveText('0:30');
            await expect(voterTimer).toHaveText('0:30');
            // Same window after the reset, proving it did not restart the countdown.
            await adminPage.waitForTimeout(1600);
            await expect(adminTimer).toHaveText('0:30');
            await expect(voterTimer).toHaveText('0:30');
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
