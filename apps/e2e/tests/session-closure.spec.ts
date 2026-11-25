import { expect, test, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRoom, endSessionViaSettings, joinRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Session Closure', () => {
    test('an ended session refuses a new participant', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;
        let newParticipantContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode);
            voterContext = voterSession.voterContext;

            await endSessionViaSettings(adminPage);

            const summaryDialog = adminPage.getByRole('dialog', { name: /Session Summary/i });
            await expect(summaryDialog).toBeVisible();
            await summaryDialog.getByRole('button', { name: /Close/i }).click();
            await expect(summaryDialog).toBeHidden();

            newParticipantContext = await browser.newContext({ locale: 'en-US' });
            const newPage = await newParticipantContext.newPage();
            await newPage.goto('/');

            await newPage.getByRole('tab', { name: /Join Session/i }).click();
            await newPage.getByLabel(/8-Character Room Code/i).fill(roomCode);
            await newPage.getByLabel(/Your Display Name/i).fill('New Voter');
            await newPage.getByRole('button', { name: /Join Room Now/i }).click();

            await expect(
                newPage.getByRole('alert').filter({ hasText: 'This session has ended' })
            ).toBeVisible();
            await expect(
                newPage.getByRole('heading', { name: 'Planit Poker Real-Time' })
            ).toBeVisible();

            await newParticipantContext.close();
            newParticipantContext = undefined;
        } finally {
            await newParticipantContext?.close();
            await voterContext?.close();
            await adminContext.close();
        }
    });

    test('a participant already inside reconnects after the end', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(browser);
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await endSessionViaSettings(adminPage);

            const adminSummary = adminPage.getByRole('dialog', { name: /Session Summary/i });
            await expect(adminSummary).toBeVisible();
            await adminSummary.getByRole('button', { name: /Close/i }).click();
            await expect(adminSummary).toBeHidden();

            // The ended room refuses every content action, not only votes.
            await expect(adminPage.getByRole('button', { name: /Reveal Votes/i })).toHaveCount(0);
            await expect(adminPage.getByRole('button', { name: /Reset Votes/i })).toHaveCount(0);
            await expect(adminPage.getByRole('button', { name: /Start Timer/i })).toHaveCount(0);
            await expect(adminPage.getByRole('button', { name: 'Add Story' })).toHaveCount(0);

            await adminPage.getByRole('button', { name: /Room Settings/i }).click();
            const readOnlySettings = adminPage.getByRole('dialog', {
                name: /Room & Session Settings/i,
            });
            await expect(readOnlySettings).toBeVisible();
            await expect(
                readOnlySettings.getByRole('button', { name: 'Apply Settings' })
            ).toBeDisabled();
            await expect(readOnlySettings.getByLabel('Room / Sprint Title')).toBeDisabled();
            await expect(
                readOnlySettings.getByText(
                    'This session has ended, so these settings are read-only.'
                )
            ).toBeVisible();

            const accessibility = await new AxeBuilder({ page: adminPage })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
                .analyze();
            expect(accessibility.violations).toEqual([]);

            await readOnlySettings.getByRole('button', { name: 'Cancel' }).click();
            await expect(readOnlySettings).toBeHidden();

            await voterPage.reload();
            await voterPage.getByRole('tab', { name: /Join Session/i }).click();
            await voterPage.getByLabel(/8-Character Room Code/i).fill(roomCode);
            await voterPage.getByRole('button', { name: /Join Room Now/i }).click();

            // Entering an ended room opens the summary once; dismissing it
            // leaves the ended banner (with its View Summary action) behind.
            const voterSummary = voterPage.getByRole('dialog', { name: /Session Summary/i });
            await expect(voterSummary).toBeVisible({ timeout: 10_000 });
            await voterSummary.getByRole('button', { name: /Close/i }).click();
            await expect(voterSummary).toBeHidden();
            await expect(
                voterPage.getByText('Sprint Planning Estimation Session Ended!')
            ).toBeVisible();

            await expect(voterPage.getByText('Participants (2)')).toBeVisible();
            await expect(voterPage.getByText('Voter 1', { exact: true })).toHaveCount(1);
            // An ended room is read-only: the deck is visible but cannot vote.
            await expect(
                voterPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toBeDisabled();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
