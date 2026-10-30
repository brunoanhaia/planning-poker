import {
    expect,
    test,
    type BrowserContext,
    type Page,
    type WebSocketRoute,
} from '@playwright/test';

import { castVote, createRoom, joinRoom } from './support/room-session';

test.use({ locale: 'en-US' });

test.describe('Chaos Network & WebSocket Interception', () => {
    test('a dropped socket reconnects and resumes the session', async ({ browser }) => {
        let adminContext: BrowserContext | undefined;
        let voterContext: BrowserContext | undefined;
        let voterPage: Page | undefined;
        let currentRoute: WebSocketRoute | null = null;

        try {
            const adminSession = await createRoom(browser);
            adminContext = adminSession.adminContext;
            const { adminPage, roomCode } = adminSession;

            const voterSession = await joinRoom(browser, roomCode, 'Voter 1', {
                preparePage: async (page) => {
                    await page.routeWebSocket(
                        (url) => url.protocol === 'ws:' || url.protocol === 'wss:',
                        (ws) => {
                            currentRoute = ws;
                            ws.connectToServer();
                        }
                    );
                },
            });
            voterContext = voterSession.voterContext;
            voterPage = voterSession.voterPage;

            expect(currentRoute).not.toBeNull();
            await currentRoute!.close();

            await expect(voterPage.getByText('Connection to server lost. Retrying...')).toBeVisible(
                { timeout: 5000 }
            );

            await expect(voterPage.getByText('Connection to server lost. Retrying...')).toBeHidden({
                timeout: 10000,
            });
            await expect(voterPage.getByText('Participants (2)')).toBeVisible();

            await castVote(voterPage, 5);

            const voterRow = adminPage.locator('li').filter({ hasText: 'Voter 1' });
            await expect(voterRow.getByText('Voted')).toBeVisible();

            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            await expect(adminPage.locator('.results-panel').getByText('5').first()).toBeVisible();
        } finally {
            await voterPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterContext?.close();
            await adminContext?.close();
        }
    });

    test('a reconnect the server rejects returns to the lobby', async ({ browser }) => {
        let adminContext: BrowserContext | undefined;
        let voterContext: BrowserContext | undefined;
        let voterPage: Page | undefined;
        let currentRoute: WebSocketRoute | null = null;
        let rejectReconnects = false;

        try {
            const adminSession = await createRoom(browser);
            adminContext = adminSession.adminContext;
            const { roomCode } = adminSession;

            const voterSession = await joinRoom(browser, roomCode, 'Voter 1', {
                preparePage: async (page) => {
                    await page.routeWebSocket(
                        (url) => url.protocol === 'ws:' || url.protocol === 'wss:',
                        (ws) => {
                            if (!rejectReconnects) {
                                currentRoute = ws;
                                ws.connectToServer();
                                return;
                            }
                            // The server the client comes back to no longer
                            // knows the room, so the rejoin is answered with an
                            // error instead of a room state.
                            ws.onMessage((msg) => {
                                try {
                                    const parsed =
                                        typeof msg === 'string'
                                            ? JSON.parse(msg)
                                            : JSON.parse(msg.toString('utf-8'));
                                    if (parsed.type === 'JOIN_ROOM') {
                                        ws.send(
                                            JSON.stringify({
                                                payload: {
                                                    code: 'ROOM_NOT_FOUND',
                                                    message: 'Room not found.',
                                                },
                                                type: 'ERROR',
                                            })
                                        );
                                    }
                                } catch {
                                    // Ignore malformed frames
                                }
                            });
                        }
                    );
                },
            });
            voterContext = voterSession.voterContext;
            voterPage = voterSession.voterPage;

            expect(currentRoute).not.toBeNull();
            rejectReconnects = true;
            await currentRoute!.close();

            await expect(
                voterPage.getByRole('heading', { name: 'Planit Poker Real-Time' })
            ).toBeVisible({ timeout: 10000 });
            await expect(
                voterPage.getByText('Room not found. Please check the room code.')
            ).toBeVisible();
        } finally {
            await voterPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterContext?.close();
            await adminContext?.close();
        }
    });

    test('duplicated client frames do not duplicate state', async ({ browser }) => {
        let adminContext: BrowserContext | undefined;
        let voterContext: BrowserContext | undefined;
        let adminPage: Page | undefined;
        let voterPage: Page | undefined;
        let duplicateFrames = false;
        let adminServer: WebSocketRoute | null = null;

        /** Routes the socket through the proxy and optionally duplicates page frames. */
        const proxyAndDuplicate = (captureServerRoute: boolean) => async (page: Page) => {
            await page.routeWebSocket(
                (url) => url.protocol === 'ws:' || url.protocol === 'wss:',
                (ws) => {
                    const server = ws.connectToServer();
                    if (captureServerRoute) {
                        // The server-side half of the route is how the test plays
                        // the page: a frame sent there reaches the server as if
                        // the browser had sent it.
                        adminServer = server;
                    }
                    ws.onMessage((message) => {
                        server.send(message);
                        if (duplicateFrames) {
                            server.send(message);
                        }
                    });
                }
            );
        };

        try {
            const adminSession = await createRoom(browser, 'Admin', undefined, {
                preparePage: proxyAndDuplicate(true),
            });
            adminContext = adminSession.adminContext;
            adminPage = adminSession.adminPage;
            const { roomCode } = adminSession;

            const voterSession = await joinRoom(browser, roomCode, 'Voter 1', {
                preparePage: proxyAndDuplicate(false),
            });
            voterContext = voterSession.voterContext;
            voterPage = voterSession.voterPage;

            duplicateFrames = true;

            await castVote(voterPage, 5);

            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            await expect(adminPage.locator('li').filter({ hasText: 'Voter 1' })).toHaveCount(1);
            const votersStat = adminPage
                .locator('.results-panel .ant-statistic')
                .filter({ hasText: 'Voters' });
            await expect(votersStat.getByText('1')).toBeVisible();

            // A stale action after the reveal is rejected, and the rejection has
            // to be visible inside the room instead of only on the lobby.
            expect(adminServer).not.toBeNull();
            adminServer!.send(JSON.stringify({ payload: { vote: 5 }, type: 'VOTE' }));

            const rejection = adminPage
                .getByRole('alert')
                .filter({ hasText: 'The votes are already revealed' });
            await expect(rejection).toBeVisible();
            await rejection.getByRole('button').click();
            await expect(rejection).toBeHidden();
            await expect(votersStat.getByText('1')).toBeVisible();
        } finally {
            await adminPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterContext?.close();
            await adminContext?.close();
        }
    });

    test('an 800 ms delay still converges', async ({ browser }) => {
        test.setTimeout(60_000);

        let adminContext: BrowserContext | undefined;
        let voterContext: BrowserContext | undefined;
        let adminPage: Page | undefined;
        let voterPage: Page | undefined;

        const createDelayedSender = (sendFn: (msg: string | Buffer) => void, delayMs = 800) => {
            // Each frame is delayed independently: chaining them would turn the
            // experiment into a throughput cap (N frames × delay) instead of the
            // fixed 800 ms latency it models.
            return (message: string | Buffer) => {
                setTimeout(() => {
                    try {
                        sendFn(message);
                    } catch {
                        // A route closed by a later step drops the frame, which is
                        // what the experiment expects; it must not reject.
                    }
                }, delayMs);
            };
        };

        const setupDelayedRoute = async (page: Page) => {
            await page.routeWebSocket(
                (url) => url.protocol === 'ws:' || url.protocol === 'wss:',
                (ws) => {
                    const server = ws.connectToServer();
                    const sendToServer = createDelayedSender((msg) => server.send(msg), 800);
                    const sendToClient = createDelayedSender((msg) => ws.send(msg), 800);
                    ws.onMessage(sendToServer);
                    server.onMessage(sendToClient);
                }
            );
        };

        try {
            const adminSession = await createRoom(browser, 'Admin', undefined, {
                preparePage: setupDelayedRoute,
            });
            adminContext = adminSession.adminContext;
            adminPage = adminSession.adminPage;
            const { roomCode } = adminSession;

            const voterSession = await joinRoom(browser, roomCode, 'Voter 1', {
                preparePage: setupDelayedRoute,
            });
            voterContext = voterSession.voterContext;
            voterPage = voterSession.voterPage;

            await castVote(voterPage, 5);

            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            const resultsPanel = adminPage.locator('.results-panel');
            await expect(resultsPanel).toBeVisible({ timeout: 15000 });
            const votersStat = resultsPanel.locator('.ant-statistic').filter({ hasText: 'Voters' });
            await expect(votersStat.getByText('1')).toBeVisible({ timeout: 15000 });
        } finally {
            await adminPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterContext?.close();
            await adminContext?.close();
        }
    });

    test('a dropped vote can be resent', async ({ browser }) => {
        let adminContext: BrowserContext | undefined;
        let voterContext: BrowserContext | undefined;
        let voterPage: Page | undefined;
        let droppedFirstVote = false;

        try {
            const adminSession = await createRoom(browser);
            adminContext = adminSession.adminContext;
            const { adminPage, roomCode } = adminSession;

            const voterSession = await joinRoom(browser, roomCode, 'Voter 1', {
                preparePage: async (page) => {
                    await page.routeWebSocket(
                        (url) => url.protocol === 'ws:' || url.protocol === 'wss:',
                        (ws) => {
                            const server = ws.connectToServer();
                            ws.onMessage((message) => {
                                try {
                                    const parsed =
                                        typeof message === 'string'
                                            ? JSON.parse(message)
                                            : JSON.parse(message.toString('utf-8'));
                                    if (parsed.type === 'VOTE' && !droppedFirstVote) {
                                        droppedFirstVote = true;
                                        return;
                                    }
                                } catch {
                                    // Ignore non-json frames
                                }
                                server.send(message);
                            });
                        }
                    );
                },
            });
            voterContext = voterSession.voterContext;
            voterPage = voterSession.voterPage;

            const voteCard = voterPage.getByRole('button', {
                name: 'Select estimate 5',
                exact: true,
            });
            await expect(voteCard).toBeVisible();
            await voteCard.click();
            // Wait for the interceptor before asserting the negative: both
            // assertions would otherwise pass before the server could answer.
            await expect.poll(() => droppedFirstVote).toBe(true);
            await expect(voteCard).toHaveAttribute('aria-pressed', 'false');

            const voterRow = adminPage.locator('li').filter({ hasText: 'Voter 1' });
            await expect(voterRow).toBeVisible();
            await expect(voterRow.getByText('Voted')).toBeHidden();

            await castVote(voterPage, 5);
            await expect(voterRow.getByText('Voted')).toBeVisible();

            await adminPage.getByRole('button', { name: /Reveal Votes/i }).click();

            await expect(adminPage.locator('.results-panel').getByText('5').first()).toBeVisible();
        } finally {
            await voterPage?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
            await voterContext?.close();
            await adminContext?.close();
        }
    });
});
