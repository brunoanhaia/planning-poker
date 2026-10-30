import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { createRoom, joinRoom } from './support/room-session';

const serverContainer = process.env.CHAOS_SERVER_CONTAINER ?? 'planitpoker-server';
const clientContainer = process.env.CHAOS_CLIENT_CONTAINER ?? 'planitpoker-client';

test.use({ locale: 'en-US' });

/** Restarts a compose container through podman and waits for it to exit the call. */
const restartContainer = (name: string): void => {
    execFileSync('podman', ['restart', name], { stdio: 'pipe' });
};

test.describe('Deployment chaos', () => {
    test('restarting the web tier resumes the session', async ({ browser }) => {
        test.setTimeout(90_000);
        const { adminContext, adminPage, roomCode } = await createRoom(
            browser,
            'Admin',
            'Web tier'
        );
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');

        try {
            restartContainer(clientContainer);

            // The browser reconnects through the restarted proxy and rejoins on
            // its own; the server never lost the room. Retrying the click proves
            // the socket is live again, which a plain visibility check would not.
            await expect(async () => {
                await voterPage
                    .getByRole('button', { name: 'Select estimate 5', exact: true })
                    .click();
                await expect(
                    adminPage
                        .getByRole('listitem')
                        .filter({ hasText: 'Voter 1' })
                        .getByText('Voted', { exact: true })
                ).toBeVisible({ timeout: 2000 });
            }).toPass({ timeout: 20_000 });

            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();
            await expect(adminPage.locator('.results-panel')).toBeVisible();
            await expect(adminPage.getByText('Participants (2)')).toBeVisible();
            await expect(adminPage.getByText('Voter 1', { exact: true })).toHaveCount(1);
            await expect(
                adminPage
                    .locator('.results-panel .ant-statistic')
                    .filter({ hasText: 'Average' })
                    .getByText('5.0')
            ).toBeVisible();
        } finally {
            await voterContext.close();
            await adminContext.close();
        }
    });

    test('restarting the server loses the room and the client says so', async ({ browser }) => {
        test.setTimeout(90_000);
        const { adminContext, roomCode } = await createRoom(browser, 'Admin', 'Server tier');
        const { voterContext, voterPage } = await joinRoom(browser, roomCode, 'Voter 1');

        try {
            restartContainer(serverContainer);
            // Nginx keeps the resolved upstream address, so the deploy order
            // restarts the proxy right after the server.
            restartContainer(clientContainer);

            await expect(voterPage.getByText('Planit Poker Real-Time')).toBeVisible({
                timeout: 30_000,
            });
            await expect(
                voterPage.getByText('Room not found. Please check the room code.')
            ).toBeVisible();
            await expect(voterPage.getByText(/^Room: /i)).toHaveCount(0);

            await voterPage.getByLabel(/Your Display Name/i).fill('Voter 1');
            await voterPage
                .getByRole('button', { name: /Start Session & Generate Room Code/i })
                .click();
            await expect(voterPage.getByText(/^Room: /i).first()).toBeVisible();
        } finally {
            await voterContext.close();
            await adminContext.close();
        }
    });
});
