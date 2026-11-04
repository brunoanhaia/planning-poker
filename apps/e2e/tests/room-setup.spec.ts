import { expect, test, type BrowserContext } from '@playwright/test';

import { becomeVoter, completeSetup, createRoom, joinRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Room Setup', () => {
    test('a new room opens on the empty setup screen with Start disabled', async ({ browser }) => {
        const { adminContext, adminPage } = await createRoom(browser, 'Admin', undefined, {
            skipSetup: true,
        });

        try {
            await expect(adminPage.getByText('Set up your session')).toBeVisible();
            await expect(adminPage.locator('#setup-room-title')).toBeVisible();
            await expect(adminPage.locator('#setup-story-title')).toBeVisible();
            await expect(
                adminPage.getByText('No story staged yet.', { exact: false })
            ).toBeVisible();

            // Nothing is seeded any more: the room stays empty until the admin stages a story.
            await expect(adminPage.getByText('First User Story')).toHaveCount(0);
            await expect(
                adminPage.getByRole('button', { name: 'Start Estimating' })
            ).toBeDisabled();
            await expect(adminPage.getByText('Voting Progress')).toHaveCount(0);
        } finally {
            await adminContext.close();
        }
    });

    test('staging stories with a title and deck starts the room', async ({ browser }) => {
        const { adminContext, adminPage } = await createRoom(browser, 'Admin', undefined, {
            skipSetup: true,
        });

        try {
            await adminPage.locator('#setup-room-title').fill('Sprint 42');

            await adminPage.locator('#setup-deck').click();
            await adminPage.getByRole('option', { name: 'Powers of 2' }).click();
            await expect(adminPage.locator('.ant-select-content')).toHaveAttribute(
                'title',
                'Powers of 2'
            );

            // First story through the single-story form, second through the bulk field.
            await adminPage.locator('#setup-story-title').fill('Checkout flow');
            await adminPage.locator('#setup-story-description').fill('Cart survives a refresh');
            await adminPage.getByRole('button', { name: 'Add Story' }).click();
            await expect(adminPage.getByText('Checkout flow')).toBeVisible();

            await adminPage.locator('#setup-bulk-stories').fill('Search ranking');
            await adminPage.getByRole('button', { name: 'Add Stories' }).click();
            await expect(adminPage.getByText('Search ranking')).toBeVisible();

            await expect(adminPage.getByRole('button', { name: 'Start Estimating' })).toBeEnabled();
            await adminPage.getByRole('button', { name: 'Start Estimating' }).click();

            await expect(adminPage.locator('#setup-story-title')).toBeHidden();
            await expect(adminPage.getByText('Voting Progress')).toBeVisible();
            await expect(adminPage.getByText('Sprint 42')).toBeVisible();
            // Each title is both the active story card and its backlog row.
            await expect(adminPage.getByText('Checkout flow').first()).toBeVisible();
            await expect(adminPage.getByText('Search ranking').first()).toBeVisible();

            // The creator observes, so the deck only appears once it becomes a voter.
            await becomeVoter(adminPage);

            // The deck chosen in the setup screen is the one the room now deals.
            await expect(
                adminPage.getByRole('button', { name: 'Select estimate 4', exact: true })
            ).toBeVisible();
            await expect(
                adminPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toHaveCount(0);
        } finally {
            await adminContext.close();
        }
    });

    test('the creator starts as a spectator and can become a voter', async ({ browser }) => {
        const { adminContext, adminPage } = await createRoom(browser, 'Admin');

        try {
            await expect(adminPage.getByText('Observer Mode')).toBeVisible();
            const spectatorSwitch = adminPage.getByRole('switch', { name: 'Spectator mode' });
            await expect(spectatorSwitch).toBeChecked();
            await expect(
                adminPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toHaveCount(0);

            await adminPage.getByRole('button', { name: 'Switch to Voter' }).click();

            await expect(spectatorSwitch).not.toBeChecked();
            await expect(adminPage.getByText('Observer Mode')).toHaveCount(0);
            await expect(
                adminPage.getByRole('button', { name: 'Select estimate 5', exact: true })
            ).toBeVisible();
        } finally {
            await adminContext.close();
        }
    });

    test('a voter joining before Start sees the waiting state', async ({ browser }) => {
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            undefined,
            { skipSetup: true }
        );
        let voterContext: BrowserContext | undefined;

        try {
            const voterSession = await joinRoom(browser, roomCode, 'Voter 1');
            voterContext = voterSession.voterContext;
            const { voterPage } = voterSession;

            await expect(
                voterPage.getByText('Waiting for the host to set up the session')
            ).toBeVisible();
            // Only the admin gets the setup controls.
            await expect(voterPage.locator('#setup-story-title')).toHaveCount(0);

            await completeSetup(adminPage, ['First User Story']);

            await expect(
                voterPage.getByText('Waiting for the host to set up the session')
            ).toHaveCount(0);
            await expect(voterPage.getByText('First User Story').first()).toBeVisible();
        } finally {
            await voterContext?.close();
            await adminContext.close();
        }
    });
});
