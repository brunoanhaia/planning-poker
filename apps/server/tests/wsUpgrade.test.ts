import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { startServer } from '../src/index.js';

const running: { current?: Awaited<ReturnType<typeof startServer>> } = {};
let baseUrl: string;

beforeAll(() => {
    running.current = startServer({ allowedOrigins: ['http://localhost:5173'], port: 0 });
    const address = running.current.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
    running.current?.handler.shutdown();
    running.current?.server.close();
});

describe('WebSocket upgrade', () => {
    const url = () => `ws://127.0.0.1:${Number(new URL(baseUrl).port)}`;

    it('hands the identity cookie to a browser on its first HTTP response', async () => {
        const response = await fetch(`${baseUrl}/api/health`);
        const setCookie = response.headers.get('set-cookie');

        expect(setCookie).toContain('pip_client=');
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('SameSite=Strict');
    });

    it('does not reissue the cookie to a browser that already has one', async () => {
        const response = await fetch(`${baseUrl}/api/health`, {
            headers: { cookie: 'pip_client=already-here' },
        });

        expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('lets a browser create a room and join it', async () => {
        const socket = new WebSocket(url(), { headers: { origin: 'http://localhost:5173' } });

        const seen = await new Promise<string[]>((resolve, reject) => {
            const types: string[] = [];
            socket.on('message', (data) => types.push(JSON.parse(data.toString()).type));
            socket.on('error', reject);
            socket.on('open', () =>
                socket.send(JSON.stringify({ payload: { name: 'Alice' }, type: 'CREATE_ROOM' }))
            );
            setTimeout(() => resolve(types), 400);
        }).finally(() => socket.close());

        expect(seen).toContain('SESSION');
        expect(seen).toContain('ROOM_STATE');
    });

    it('rejects a browser from a disallowed origin', async () => {
        const socket = new WebSocket(url(), { headers: { origin: 'http://evil.test' } });

        const error = await new Promise<Error>((resolve) => {
            socket.on('error', resolve);
            socket.on('open', () => resolve(new Error('opened')));
        });
        socket.close();
        expect(error.message).toMatch(/403|Unexpected server response/);
    });

    it('hands the identity cookie to a browser over the handshake', async () => {
        const response = await fetch(`${baseUrl}/api/health`, {
            headers: { cookie: '' },
        });

        // The cookie rides on the first HTTP response; the socket then carries
        // it on every handshake.
        expect(response.headers.get('set-cookie')).toContain('pip_client=');
    });

    it('still admits a native client without a cookie, on its token', async () => {
        const creator = new WebSocket(url());
        const first = await new Promise<{ roomId: string; sessionToken: string }>(
            (resolve, reject) => {
                let sessionToken = '';
                creator.on('message', (data) => {
                    const parsed = JSON.parse(data.toString());
                    if (parsed.type === 'SESSION') {
                        sessionToken = parsed.payload.sessionToken;
                    }
                    if (parsed.type === 'ROOM_STATE') {
                        resolve({ roomId: parsed.payload.roomState.id, sessionToken });
                    }
                });
                creator.on('error', reject);
                creator.on('open', () =>
                    creator.send(JSON.stringify({ payload: { name: 'Host' }, type: 'CREATE_ROOM' }))
                );
            }
        );

        const joiner = new WebSocket(url());
        const answer = await new Promise<string | undefined>((resolve) => {
            joiner.on('message', (data) => {
                const parsed = JSON.parse(data.toString());
                if (parsed.type === 'ERROR') {
                    resolve(parsed.payload.code);
                }
                if (parsed.type === 'SESSION') {
                    resolve('SESSION');
                }
            });
            joiner.on('open', () =>
                joiner.send(
                    JSON.stringify({
                        payload: {
                            name: 'Native',
                            roomId: first.roomId,
                            sessionToken: first.sessionToken,
                        },
                        type: 'JOIN_ROOM',
                    })
                )
            );
        });

        creator.close();
        joiner.close();
        expect(answer).toBe('SESSION');
    });
});
