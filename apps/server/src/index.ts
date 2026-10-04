import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

import { WebSocketHandler } from './webSocketHandler.js';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173'];

/**
 * Schema for the `ALLOWED_ORIGINS` env var: a comma-separated list that is
 * trimmed and stripped of empty entries, so a set-but-empty value yields an
 * empty allowlist (which fails closed) instead of a bogus `['']` entry.
 */
const allowedOriginsSchema = z.string().transform((raw) =>
    raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
);

/**
 * Parses the `ALLOWED_ORIGINS` env var into a clean allowlist.
 *
 * @param raw - The raw comma-separated env value, if any.
 * @returns The normalized list of allowed origins.
 */
export const parseAllowedOrigins = (raw: string | undefined): string[] => {
    if (raw === undefined) {
        return [...DEFAULT_ALLOWED_ORIGINS];
    }
    return allowedOriginsSchema.parse(raw);
};

/**
 * Decides whether a WebSocket handshake may proceed.
 *
 * Browsers always send an `Origin`, so it must be allowlisted. Native/script
 * clients send no `Origin`; they are allowed through the handshake but must
 * still prove identity with a session token on `JOIN_ROOM` (see
 * `WebSocketHandler`), so token-less native clients cannot act.
 *
 * Fails closed for browsers: an empty allowlist denies every origin.
 *
 * @param origin - The `Origin` header from the handshake, if present.
 * @param allowedOrigins - The normalized allowlist.
 * @returns True when the handshake may proceed.
 */
export const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]): boolean => {
    if (!origin) {
        // Non-browser client: no Origin to check; identity is enforced later.
        return true;
    }
    return allowedOrigins.includes(origin);
};

const app = express();
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

app.use(
    cors({
        origin: ALLOWED_ORIGINS,
        credentials: true,
    })
);
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({
    server,
    verifyClient: (info, done) => {
        if (isOriginAllowed(info.origin, ALLOWED_ORIGINS)) {
            done(true);
            return;
        }
        console.warn(
            `Rejected WebSocket connection from disallowed origin: ${info.origin ?? '<none>'}`
        );
        done(false, 403, 'Forbidden');
    },
});

const webSocketHandler = new WebSocketHandler(wss);

const shutdown = (): void => {
    webSocketHandler.shutdown();
    server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
    console.log(`🚀 Planit Poker WebSocket & HTTP server listening on port ${PORT}`);
});
