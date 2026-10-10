import { WS_MAX_PAYLOAD_BYTES } from '@planitpoker/shared';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import {
    buildClientIdCookie,
    CLIENT_ID_COOKIE,
    issueClientId,
    parseClientId,
} from '../src/clientIdentity.js';
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

    it('attaches the identity cookie to a cookieless handshake', async () => {
        const socket = new WebSocket(url(), { headers: { origin: 'http://localhost:5173' } });

        // The `upgrade` event carries the raw handshake response, which is the
        // only place a fresh browser can be given the cookie.
        const handshakeCookie = await new Promise<string | undefined>((resolve) => {
            socket.on('upgrade', (response) => {
                const header = response.headers['set-cookie'];
                resolve(Array.isArray(header) ? header[0] : header);
            });
            socket.on('error', () => resolve(undefined));
        });

        socket.close();
        expect(handshakeCookie).toContain('pip_client=');
        expect(handshakeCookie).toContain('HttpOnly');
    });

    it('does not reissue the cookie when the handshake already carries one', async () => {
        const socket = new WebSocket(url(), {
            headers: { cookie: 'pip_client=already-here', origin: 'http://localhost:5173' },
        });

        const handshakeCookie = await new Promise<string | undefined>((resolve) => {
            socket.on('upgrade', (response) => {
                const header = response.headers['set-cookie'];
                resolve(Array.isArray(header) ? header[0] : header);
            });
            socket.on('error', () => resolve(undefined));
        });

        socket.close();
        expect(handshakeCookie).toBeUndefined();
    });

    it('refuses a frame larger than the configured payload', async () => {
        const socket = new WebSocket(url(), { headers: { origin: 'http://localhost:5173' } });

        // 32 KiB plus a little, wrapped so the server sees one oversized frame.
        const oversized = JSON.stringify({
            payload: { name: 'x'.repeat(WS_MAX_PAYLOAD_BYTES) },
            type: 'CREATE_ROOM',
        });

        const closedWith = await new Promise<number | undefined>((resolve) => {
            socket.on('close', (code) => resolve(code));
            socket.on('error', () => resolve(undefined));
            socket.on('open', () => socket.send(oversized));
        });

        expect(closedWith).toBe(1009);
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

describe('Handshake identity hook', () => {
    it('attaches a Set-Cookie only when the request arrives with none', () => {
        const headers: string[] = [];
        const request = { headers: {} } as http.IncomingMessage;

        // Drives the same predicate the server registers on `wss.on('headers')`.
        const applyHook = (req: http.IncomingMessage, into: string[]): void => {
            if (!parseClientId(req.headers.cookie)) {
                into.push(`Set-Cookie: ${buildClientIdCookie(issueClientId())}`);
            }
        };

        applyHook(request, headers);
        expect(headers).toHaveLength(1);
        expect(headers[0]).toContain('pip_client=');

        applyHook(
            { headers: { cookie: `${CLIENT_ID_COOKIE}=already-here` } } as http.IncomingMessage,
            headers
        );
        expect(headers).toHaveLength(1);
    });
});
