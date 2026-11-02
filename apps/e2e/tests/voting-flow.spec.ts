import { expect, test, type BrowserContext } from '@playwright/test';

import { castVote, createRoom, joinRoom } from './support/room-session';

test.describe('Voting Flow', () => {
    test('allows voters to vote and admin to reveal', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser, 'Admin');
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            // Voter casts a vote (e.g. 5)
            await castVote(voterPage, 5);

            // Admin reveals the votes
            await adminPage.getByRole('button', { name: /Reveal/i }).click();

            // Verify that the vote "5" is visible to both admin and voter
            await expect(
                adminPage
                    .locator('.results-panel')
                    .or(adminPage.locator('body'))
                    .getByText('5')
                    .first()
            ).toBeVisible();
            await expect(
                voterPage
                    .locator('.results-panel')
                    .or(voterPage.locator('body'))
                    .getByText('5')
                    .first()
            ).toBeVisible();

            // Admin resets the session
            await adminPage.getByRole('button', { name: /Reset/i }).click();

            // Reveal button should be visible again instead of Reset
            await expect(adminPage.getByRole('button', { name: /Reveal/i })).toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });

    test('finalizes the estimate and freezes the revealed round', async ({ browser }) => {
        // The admin votes in this round, so the creator has to leave spectator mode.
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            undefined,
            {
                adminVotes: true,
            }
        );
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            // The voter shows 5 and the admin 3, so the average is 4.0.
            await castVote(voterPage, 5);
            await castVote(adminPage, 3);
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            const resultsPanel = adminPage.locator('.results-panel');
            const average = resultsPanel.locator('.ant-statistic').filter({ hasText: 'Average' });
            const voters = resultsPanel.locator('.ant-statistic').filter({ hasText: 'Voters' });

            await expect(resultsPanel).toBeVisible();
            await expect(average).toContainText('4.0');
            await expect(voters).toContainText('2');

            // Accepting the average replaces the score controls with the final tag.
            await resultsPanel.getByRole('button', { name: /Accept Avg/ }).click();
            const confirmDialog = adminPage.getByRole('dialog', {
                name: /Confirm Story Change/i,
            });
            await expect(confirmDialog).toBeVisible();
            await confirmDialog.getByRole('button', { name: /Save & Advance/i }).click();
            await expect(confirmDialog).toBeHidden();

            await expect(resultsPanel.getByRole('button', { name: /Accept Avg/ })).toHaveCount(0);
            await expect(resultsPanel.getByRole('button', { name: /Custom Score/ })).toHaveCount(0);
            await expect(
                resultsPanel.getByText('Final estimate: 4', { exact: true })
            ).toBeVisible();
            await expect(average).toContainText('4.0');

            // Going spectator after the reveal must not rewrite the frozen round.
            const spectatorSwitch = adminPage.getByRole('switch');
            await expect(spectatorSwitch).toBeVisible();
            await spectatorSwitch.click();
            await expect(spectatorSwitch).toBeChecked();
            await expect(average).toContainText('4.0');
            await expect(voters).toContainText('2');

            // Resetting reopens the story for a new round.
            await adminPage.getByRole('button', { name: /Reset Votes \(Admin\)/ }).click();
            await expect(resultsPanel).toBeHidden();
            await expect(adminPage.getByRole('button', { name: /Reveal Votes/ })).toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
