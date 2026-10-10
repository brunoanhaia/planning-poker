import {
    HTTP_MAX_BODY_BYTES,
    HTTP_RATE_LIMIT_MAX_REQUESTS,
    HTTP_RATE_LIMIT_WINDOW_MS,
    WS_MAX_PAYLOAD_BYTES,
} from '@planitpoker/shared';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

import { WebSocketHandler } from './webSocketHandler.js';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173'];

/** Default port of the combined HTTP + WebSocket server. */
const DEFAULT_PORT = 5000;

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

/** Options of {@link startServer}. */
export interface StartServerOptions {
    allowedOrigins: string[];
    /** Port to listen on; `0` picks a free ephemeral port. */
    port: number;
    /** Requests accepted per client inside the rate-limit window. */
    rateLimitMaxRequests?: number;
    /**
     * How many reverse-proxy hops in front of this server may be trusted when
     * reading `X-Forwarded-For`. Defaults to the single bundled Nginx hop.
     */
    trustProxyHops?: number;
}

/** A started server, its HTTP listener and the socket handler it created. */
export interface RunningServer {
    handler: WebSocketHandler;
    server: http.Server;
}

/**
 * Builds and starts the combined HTTP + WebSocket server.
 *
 * The HTTP side carries the baseline hardening the API had been missing: the
 * `X-Powered-By` fingerprint is disabled, `helmet` supplies the security
 * headers on every response, the JSON body is capped explicitly instead of
 * leaning on the framework default, and a per-client rate limit answers a
 * spreadsheet of requests with a `429` instead of doing the work.
 *
 * The WebSocket side refuses frames larger than {@link WS_MAX_PAYLOAD_BYTES}
 * (the client is disconnected with code 1009) and stays behind the origin
 * allowlist checked in the handshake.
 *
 * @param options - Allowed origins, port and rate-limit allowance.
 * @returns The listening HTTP server together with its socket handler.
 */
export const startServer = (options: StartServerOptions): RunningServer => {
    const { allowedOrigins, port } = options;

    const app = express();
    app.disable('x-powered-by');
    // Only the hops that are really there: Nginx appends the client address to
    // `X-Forwarded-For` instead of replacing it, so trusting every hop would
    // let a client pick its own address — and with it its own rate-limit
    // bucket. Trusting exactly one hop makes Express read the address the
    // proxy appended, which a client cannot forge.
    app.set('trust proxy', options.trustProxyHops ?? 1);
    app.use(
        // The SPA is never framed, so the framing header can be stricter than
        // helmet's `SAMEORIGIN` default — it matches the header Nginx sends.
        // Referrers are trimmed to the origin on cross-origin navigation, which
        // is the same policy Nginx applies.
        helmet({
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xFrameOptions: { action: 'deny' },
        })
    );
    app.use(
        cors({
            origin: allowedOrigins,
            credentials: true,
        })
    );
    app.use(express.json({ limit: HTTP_MAX_BODY_BYTES }));
    app.use(
        rateLimit({
            limit: options.rateLimitMaxRequests ?? HTTP_RATE_LIMIT_MAX_REQUESTS,
            windowMs: HTTP_RATE_LIMIT_WINDOW_MS,
            standardHeaders: 'draft-7',
            message: { error: 'Too many requests. Try again later.' },
        })
    );

    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const server = http.createServer(app);
    const wss = new WebSocketServer({
        maxPayload: WS_MAX_PAYLOAD_BYTES,
        server,
        verifyClient: (info, done) => {
            if (isOriginAllowed(info.origin, allowedOrigins)) {
                done(true);
                return;
            }
            console.warn(
                `Rejected WebSocket connection from disallowed origin: ${info.origin ?? '<none>'}`
            );
            done(false, 403, 'Forbidden');
        },
    });

    const handler = new WebSocketHandler(wss);

    return { handler, server: server.listen(port) };
};

/**
 * True when this module is the entry point, so importing it in a test does not
 * open a listening socket.
 *
 * @returns True when the module was executed directly.
 */
export const isEntryPoint = (): boolean => {
    const entry = process.argv[1];
    return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
};

if (isEntryPoint()) {
    const port = Number(process.env.PORT || DEFAULT_PORT);
    const { handler, server } = startServer({
        allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
        port,
    });

    const shutdown = (): void => {
        handler.shutdown();
        server.close(() => process.exit(0));
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    console.log(`🚀 Planit Poker WebSocket & HTTP server listening on port ${port}`);
}
