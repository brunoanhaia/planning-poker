import { expect, test } from '@playwright/test';

import {
    castVote,
    createRoom,
    endSessionViaSettings,
    joinRoom,
    readDownloadContent,
} from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Rounds and Session Summary', () => {
    test('two voting rounds on the same story update statistics and preserve history', async ({
        browser,
    }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            'Two Rounds Session'
        );
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');
        // The contexts are closed in `finally` below, so a failed assertion
        // cannot leave sockets open for the rest of the worker.
        try {
            // Round 1: Both cast votes
            await castVote(adminPage, 3);
            await castVote(voterPage, 5);

            // Admin reveals votes
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            // Assert results panel shows "Round 1" and computed statistics
            const resultsPanel = adminPage.locator('.results-panel');
            await expect(resultsPanel).toBeVisible();
            await expect(resultsPanel.getByText('Round 1')).toBeVisible();
            await expect(resultsPanel.getByText('Average')).toBeVisible();
            await expect(
                resultsPanel
                    .locator('.ant-statistic')
                    .filter({ hasText: 'Average' })
                    .getByText('4.0')
            ).toBeVisible();
            await expect(resultsPanel.getByText('Voters')).toBeVisible();
            await expect(
                resultsPanel.locator('.ant-statistic').filter({ hasText: 'Voters' }).getByText('2')
            ).toBeVisible();

            // Story backlog reflects 1 round
            await expect(adminPage.getByText('1 round').first()).toBeVisible();

            // Admin resets votes for a new round
            await adminPage.getByRole('button', { name: /Reset Votes/i }).click();
            await expect(resultsPanel).toBeHidden();

            // Round 2: Both vote again with different cards
            await castVote(adminPage, 8);
            await castVote(voterPage, 13);

            // Admin reveals round 2
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            // Assert "Round 2" appears and statistics reflect the second round
            await expect(resultsPanel).toBeVisible();
            await expect(resultsPanel.getByText('Round 2')).toBeVisible();
            await expect(
                resultsPanel
                    .locator('.ant-statistic')
                    .filter({ hasText: 'Average' })
                    .getByText('10.5')
            ).toBeVisible();
            await expect(
                resultsPanel.locator('.ant-statistic').filter({ hasText: 'Voters' }).getByText('2')
            ).toBeVisible();

            // Assert the first round is preserved server-side (backlog shows 2 rounds)
            await expect(adminPage.getByText('2 rounds').first()).toBeVisible();

            // Verify round history through the story breakdown modal
            await adminPage
                .getByRole('button', { name: /Breakdown/i })
                .first()
                .click();
            const breakdownModal = adminPage.getByRole('dialog', { name: /Breakdown/i });
            await expect(breakdownModal).toBeVisible();
            await expect(breakdownModal.getByText('Round 1')).toBeVisible();
            await expect(breakdownModal.getByText('Round 2')).toBeVisible();
        } finally {
            await voterContext.close();
            await adminContext.close();
        }
    });

    test('session summary opens with totals and per-story breakdown when ending session', async ({
        browser,
    }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            'Summary Test Session'
        );
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');

        try {
            // Cast votes and reveal
            await castVote(adminPage, 5);
            await castVote(voterPage, 5);
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            // Score the story by accepting the consensus estimate
            await adminPage.getByRole('button', { name: /Accept/i }).click();
            const confirmModal = adminPage.getByRole('dialog', { name: /Confirm Story Change/i });
            await expect(confirmModal).toBeVisible();
            await confirmModal.getByRole('button', { name: /Save & Advance/i }).click();
            await expect(confirmModal).toBeHidden();

            // End session through room settings
            await endSessionViaSettings(adminPage);

            // Assert summary dialog opens automatically
            const summaryDialog = adminPage.getByRole('dialog', { name: /Session Summary/i });
            await expect(summaryDialog).toBeVisible();

            // Assert totals: estimated stories, total points, rounds, duration
            await expect(
                summaryDialog.locator('.ant-statistic').filter({ hasText: 'Estimated stories' })
            ).toContainText('1/1');
            await expect(
                summaryDialog.locator('.ant-statistic').filter({ hasText: 'Total points' })
            ).toContainText('5');
            await expect(
                summaryDialog.locator('.ant-statistic').filter({ hasText: 'Rounds' })
            ).toContainText('1');
            await expect(
                summaryDialog.locator('.ant-statistic').filter({ hasText: 'Duration' })
            ).toBeVisible();

            // Assert per-story section
            await expect(summaryDialog.getByText('1. First User Story')).toBeVisible();
            await summaryDialog.getByText('1. First User Story').click();
            await expect(summaryDialog.getByText(/Final estimate:/i)).toBeVisible();
        } finally {
            await voterContext.close();
            await adminContext.close();
        }
    });

    test('summary CSV export downloads header and rows per revealed round', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            'Export Test Session'
        );
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');

        try {
            // Round 1
            await castVote(adminPage, 3);
            await castVote(voterPage, 5);
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            // Reset and Round 2
            await adminPage.getByRole('button', { name: /Reset Votes/i }).click();
            await castVote(adminPage, 8);
            await castVote(voterPage, 13);
            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            // Score the story
            await adminPage.getByRole('button', { name: /Accept/i }).click();
            const confirmModal = adminPage.getByRole('dialog', { name: /Confirm Story Change/i });
            await expect(confirmModal).toBeVisible();
            await confirmModal.getByRole('button', { name: /Save & Advance/i }).click();
            await expect(confirmModal).toBeHidden();

            // End session through room settings
            await endSessionViaSettings(adminPage);

            // Summary dialog opens
            const summaryDialog = adminPage.getByRole('dialog', { name: /Session Summary/i });
            await expect(summaryDialog).toBeVisible();

            // Trigger CSV export and intercept the download
            const downloadPromise = adminPage.waitForEvent('download');
            await summaryDialog.getByRole('button', { name: /Export/i }).click();
            const download = await downloadPromise;

            // Verify CSV content
            const csvContent = await readDownloadContent(download);
            const lines = csvContent
                .trim()
                .split(/\r?\n/)
                .filter((line) => line.length > 0);

            expect(lines[0]).toBe(
                '"Story","Final Estimate","Round","Votes","Average","Median","Std. Deviation","Outliers"'
            );
            // Header + 2 revealed rounds = 3 rows
            expect(lines).toHaveLength(3);
            expect(lines[1]).toContain('"First User Story"');
            expect(lines[1]).toContain('"1"');
            expect(lines[2]).toContain('"First User Story"');
            expect(lines[2]).toContain('"2"');
        } finally {
            await voterContext.close();
            await adminContext.close();
        }
    });
});
