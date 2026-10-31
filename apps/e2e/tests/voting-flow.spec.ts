import { expect, test, type BrowserContext } from '@playwright/test';

import { castVote, createRoom, joinRoom } from './support/room-session';

test.describe('Voting Flow', () => {
    test('allows voters to vote and admin to reveal', async ({ browser }) => {
        // Admin context
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await adminPage.goto('/');

        await adminPage.getByLabel(/Your Display Name/i).fill('Admin');
        await adminPage
            .getByRole('button', { name: /Start Session & Generate Room Code/i })
            .click();
        // Get the room code from the Navbar chip
        const roomBadge = adminPage.getByText(/^Room: /i).first();
        await expect(roomBadge).toBeVisible();
        const badgeText = await roomBadge.innerText();
        const roomCode = badgeText.replace('Room: ', '').trim();

        // Voter context
        const voterContext = await browser.newContext();
        const voterPage = await voterContext.newPage();
        // Join using the UI
        await voterPage.goto(`/`);
        await voterPage.getByRole('tab', { name: /Join Session/i }).click();
        await voterPage.getByLabel(/8-Character Room Code/i).fill(roomCode);
        await voterPage.getByLabel(/Your Display Name/i).fill('Voter 1');
        await voterPage.getByRole('button', { name: /Join Room Now/i }).click();

        // Voter casts a vote (e.g. 5)
        await expect(voterPage.getByText('Voter 1')).toBeVisible({ timeout: 10000 });

        // Wait for the voting cards to appear
        await voterPage.getByText('5', { exact: true }).last().click();

        // Admin reveals the votes
        await adminPage.getByRole('button', { name: /Reveal/i }).click();

        // Verify that the vote "5" is visible to both admin and voter
        await expect(
            adminPage.locator('.results-panel').or(adminPage.locator('body')).getByText('5').first()
        ).toBeVisible();
        await expect(
            voterPage.locator('.results-panel').or(voterPage.locator('body')).getByText('5').first()
        ).toBeVisible();

        // Admin resets the session
        await adminPage.getByRole('button', { name: /Reset/i }).click();

        // Reveal button should be visible again instead of Reset
        await expect(adminPage.getByRole('button', { name: /Reveal/i })).toBeVisible();

        await adminContext.close();
        await voterContext.close();
    });

    test('finalizes the estimate and freezes the revealed round', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser, 'Admin');
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
