import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { WebSocketHandler } from './webSocketHandler.js';

const app = express();
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

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
        // Non-browser clients send no Origin and cannot be checked; allow them.
        // An empty allowlist also allows all (same policy as the CORS setup above).
        if (!info.origin || ALLOWED_ORIGINS.length === 0) {
            done(true);
            return;
        }
        if (ALLOWED_ORIGINS.includes(info.origin)) {
            done(true);
            return;
        }
        console.warn(`Rejected WebSocket connection from disallowed origin: ${info.origin}`);
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
