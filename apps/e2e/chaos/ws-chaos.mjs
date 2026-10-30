import { WebSocket } from 'ws';

/**
 * Parses CLI arguments for --http and --ws options with standard defaults.
 *
 * @returns {{ httpUrl: string, wsUrl: string }} The resolved target URLs.
 */
function parseArgs() {
    const args = process.argv.slice(2);
    let httpUrl = 'http://localhost:5000';
    let wsUrl = 'ws://localhost:5000/ws';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--http' && i + 1 < args.length) {
            httpUrl = args[++i];
        } else if (arg.startsWith('--http=')) {
            httpUrl = arg.slice('--http='.length);
        } else if (arg === '--ws' && i + 1 < args.length) {
            wsUrl = args[++i];
        } else if (arg.startsWith('--ws=')) {
            wsUrl = arg.slice('--ws='.length);
        }
    }
    return { httpUrl, wsUrl };
}

/**
 * Verifies that the HTTP server health check responds with HTTP 200.
 *
 * @param {string} httpUrl - Base HTTP URL of the server.
 */
async function checkHealth(httpUrl) {
    const baseUrl = httpUrl.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.status !== 200) {
        throw new Error(`Health check returned status ${res.status}`);
    }
}

/**
 * Case 1: Oversized frame.
 * Connects and sends a 40 KB frame. Expects socket close code 1009 and health 200.
 */
async function testOversizedFrame(wsUrl, httpUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let closedCode = null;

        ws.on('open', () => {
            const bigPayload = 'x'.repeat(40 * 1024);
            ws.send(bigPayload);
        });

        ws.on('close', async (code) => {
            closedCode = code;
            try {
                if (closedCode !== 1009) {
                    reject(new Error(`Expected close code 1009, got ${closedCode}`));
                    return;
                }
                await checkHealth(httpUrl);
                resolve();
            } catch (err) {
                reject(err);
            }
        });

        ws.on('error', () => {
            // Error event is expected when the server drops an oversized frame; handled on close
        });
    });
}

/**
 * Case 2: Frame flood.
 * Sends 31 small frames within 1 s. Expects exactly 1 RATE_LIMITED error, then close code 1008 and health 200.
 */
async function testFrameFlood(wsUrl, httpUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const rateLimitedErrors = [];
        let closeCode = null;

        ws.on('open', () => {
            for (let i = 0; i < 31; i++) {
                ws.send(JSON.stringify({ payload: { index: i }, type: 'PING' }));
            }
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'ERROR' && msg.payload?.code === 'RATE_LIMITED') {
                    rateLimitedErrors.push(msg);
                }
            } catch {
                // Ignore non-json or unrelated messages
            }
        });

        ws.on('close', async (code) => {
            closeCode = code;
            try {
                if (rateLimitedErrors.length !== 1) {
                    reject(
                        new Error(
                            `Expected exactly 1 RATE_LIMITED error, got ${rateLimitedErrors.length}`
                        )
                    );
                    return;
                }
                if (closeCode !== 1008) {
                    reject(new Error(`Expected close code 1008, got ${closeCode}`));
                    return;
                }
                await checkHealth(httpUrl);
                resolve();
            } catch (err) {
                reject(err);
            }
        });

        ws.on('error', () => {});
    });
}

/**
 * Case 3: Malformed input.
 * Tests invalid message formats and verifies recovering to CREATE_ROOM.
 */
async function testMalformedInput(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);

        ws.on('error', (err) => reject(err));

        const waitForNextMessage = () => {
            return new Promise((res) => {
                const onMsg = (data) => {
                    ws.off('message', onMsg);
                    try {
                        res(JSON.parse(data.toString()));
                    } catch {
                        res(data.toString());
                    }
                };
                ws.on('message', onMsg);
            });
        };

        ws.on('open', async () => {
            try {
                // 1. send 'not-json' -> ERROR INVALID_MESSAGE
                const p1 = waitForNextMessage();
                ws.send('not-json');
                const m1 = await p1;
                if (m1?.type !== 'ERROR' || m1?.payload?.code !== 'INVALID_MESSAGE') {
                    throw new Error(
                        `Step 1 failed: expected ERROR INVALID_MESSAGE, received ${JSON.stringify(m1)}`
                    );
                }

                // 2. send '42' -> ERROR INVALID_MESSAGE
                const p2 = waitForNextMessage();
                ws.send('42');
                const m2 = await p2;
                if (m2?.type !== 'ERROR' || m2?.payload?.code !== 'INVALID_MESSAGE') {
                    throw new Error(
                        `Step 2 failed: expected ERROR INVALID_MESSAGE, received ${JSON.stringify(m2)}`
                    );
                }

                // 3. send '{"type":"constructor","payload":{}}' -> ERROR UNKNOWN_ACTION
                const p3 = waitForNextMessage();
                ws.send('{"type":"constructor","payload":{}}');
                const m3 = await p3;
                if (m3?.type !== 'ERROR' || m3?.payload?.code !== 'UNKNOWN_ACTION') {
                    throw new Error(
                        `Step 3 failed: expected ERROR UNKNOWN_ACTION, received ${JSON.stringify(m3)}`
                    );
                }

                // 4. send CREATE_ROOM {name:'Chaos'} -> SESSION and ROOM_STATE arrive
                let receivedSession = false;
                let receivedRoomState = false;

                const completionPromise = new Promise((res) => {
                    const collector = (data) => {
                        try {
                            const parsed = JSON.parse(data.toString());
                            if (parsed?.type === 'SESSION') receivedSession = true;
                            if (parsed?.type === 'ROOM_STATE') receivedRoomState = true;
                            if (receivedSession && receivedRoomState) {
                                ws.off('message', collector);
                                res();
                            }
                        } catch {
                            // Ignore unexpected non-json frames
                        }
                    };
                    ws.on('message', collector);
                });

                ws.send(JSON.stringify({ payload: { name: 'Chaos' }, type: 'CREATE_ROOM' }));
                await completionPromise;

                ws.close();
                resolve();
            } catch (err) {
                ws.close();
                reject(err);
            }
        });
    });
}

/**
 * Case 4: Repeated create.
 * Sends CREATE_ROOM twice on one socket. Expects socket to stay open and health 200.
 */
async function testRepeatedCreate(wsUrl, httpUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.on('error', (err) => reject(err));

        ws.on('open', async () => {
            try {
                ws.send(JSON.stringify({ payload: { name: 'Chaos 1' }, type: 'CREATE_ROOM' }));
                ws.send(JSON.stringify({ payload: { name: 'Chaos 2' }, type: 'CREATE_ROOM' }));

                await new Promise((r) => setTimeout(r, 600));

                if (ws.readyState !== WebSocket.OPEN) {
                    throw new Error(`Socket closed unexpectedly with readyState: ${ws.readyState}`);
                }

                await checkHealth(httpUrl);
                ws.close();
                resolve();
            } catch (err) {
                ws.close();
                reject(err);
            }
        });
    });
}

/**
 * Case 5: Connection storm.
 * Opens 50 sockets and closes them immediately. Expects health 200.
 */
async function testConnectionStorm(wsUrl, httpUrl) {
    const STORM_COUNT = 50;
    const socketPromises = [];

    for (let i = 0; i < STORM_COUNT; i++) {
        socketPromises.push(
            new Promise((resolve) => {
                const ws = new WebSocket(wsUrl);
                ws.on('open', () => {
                    ws.close();
                });
                ws.on('close', () => resolve());
                ws.on('error', () => {
                    resolve();
                });
            })
        );
    }

    await Promise.all(socketPromises);
    await checkHealth(httpUrl);
}

/**
 * Runs a test case with a timeout.
 *
 * @param {() => Promise<void>} fn - The test function to run.
 * @param {number} timeoutMs - Timeout in milliseconds.
 */
async function runWithTimeout(fn, timeoutMs = 5000) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        await Promise.race([fn(), timeoutPromise]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * CLI Entry point.
 */
async function main() {
    const { httpUrl, wsUrl } = parseArgs();

    const cases = [
        { fn: () => testOversizedFrame(wsUrl, httpUrl), name: 'Oversized frame' },
        { fn: () => testFrameFlood(wsUrl, httpUrl), name: 'Frame flood' },
        { fn: () => testMalformedInput(wsUrl), name: 'Malformed input' },
        { fn: () => testRepeatedCreate(wsUrl, httpUrl), name: 'Repeated create' },
        { fn: () => testConnectionStorm(wsUrl, httpUrl), name: 'Connection storm' },
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const testCase of cases) {
        try {
            await runWithTimeout(testCase.fn, 5000);
            console.log(`PASS ${testCase.name}`);
            passedCount++;
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.log(`FAIL ${testCase.name}: ${detail}`);
            failedCount++;
        }
    }

    console.log(
        `\nChaos summary: ${passedCount} passed, ${failedCount} failed (${cases.length} total)`
    );

    // Exit explicitly: a case that timed out may still hold a socket open, and
    // an open socket would keep the event loop alive after the FAIL is printed.
    process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Unexpected chaos runner error:', err);
    process.exitCode = 1;
});
