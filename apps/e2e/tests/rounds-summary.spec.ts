import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type Download,
    type Page,
} from '@playwright/test';

test.use({ locale: 'en-US' });

interface RoomSession {
    adminContext: BrowserContext;
    adminPage: Page;
    roomCode: string;
}

interface VoterSession {
    voterContext: BrowserContext;
    voterPage: Page;
}

/**
 * Creates a new planning poker room as admin and extracts the generated room code.
 */
async function createRoom(
    browser: Browser,
    adminName = 'Admin',
    sessionTitle?: string
): Promise<RoomSession> {
    const adminContext = await browser.newContext({ locale: 'en-US' });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/');

    await adminPage.getByLabel(/Your Display Name/i).fill(adminName);
    if (sessionTitle) {
        await adminPage.getByLabel(/Session \/ Project Title/i).fill(sessionTitle);
    }
    await adminPage.getByRole('button', { name: /Start Session & Generate Room Code/i }).click();

    const roomBadge = adminPage.getByText(/^Room: /i).first();
    await expect(roomBadge).toBeVisible();
    const badgeText = await roomBadge.innerText();
    const roomCode = badgeText.replace('Room: ', '').trim();

    return { adminContext, adminPage, roomCode };
}

/**
 * Joins an existing planning poker room in a separate browser context.
 */
async function joinRoom(
    browser: Browser,
    roomCode: string,
    voterName = 'Voter 1'
): Promise<VoterSession> {
    const voterContext = await browser.newContext({ locale: 'en-US' });
    const voterPage = await voterContext.newPage();
    await voterPage.goto('/');

    await voterPage.getByRole('tab', { name: /Join Session/i }).click();
    await voterPage.getByLabel(/8-Character Room Code/i).fill(roomCode);
    await voterPage.getByLabel(/Your Display Name/i).fill(voterName);
    await voterPage.getByRole('button', { name: /Join Room Now/i }).click();

    await expect(voterPage.getByText(voterName)).toBeVisible({ timeout: 10000 });
    return { voterContext, voterPage };
}

/**
 * Casts a vote by selecting a card from the estimation deck and asserts its active state.
 */
async function castVote(page: Page, cardValue: number | string): Promise<void> {
    const card = page.getByRole('button', { name: `Select estimate ${cardValue}`, exact: true });
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
}

/**
 * Ends the planning session via the Room Settings modal and popconfirm dialog.
 */
async function endSessionViaSettings(adminPage: Page): Promise<void> {
    await adminPage.getByRole('button', { name: /Room Settings/i }).click();
    const settingsModal = adminPage.getByRole('dialog', { name: /Room & Session Settings/i });
    await expect(settingsModal).toBeVisible();

    await settingsModal.getByRole('button', { name: /End Planning Session/i }).click();
    await adminPage.getByRole('button', { name: /^End Session$/i }).click();
    await expect(settingsModal).toBeHidden();
}

/**
 * Streams the content of a Playwright Download object into a UTF-8 string.
 */
async function readDownloadContent(download: Download): Promise<string> {
    const stream = await download.createReadStream();
    if (!stream) {
        throw new Error('Download stream is null');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

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
            resultsPanel.locator('.ant-statistic').filter({ hasText: 'Average' }).getByText('4.0')
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
            resultsPanel.locator('.ant-statistic').filter({ hasText: 'Average' }).getByText('10.5')
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

        await adminContext.close();
        await voterContext.close();
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

        await adminContext.close();
        await voterContext.close();
    });

    test('summary CSV export downloads header and rows per revealed round', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            'Export Test Session'
        );
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');

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

        await adminContext.close();
        await voterContext.close();
    });
});
