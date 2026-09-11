import cors from 'cors';
import express from 'express';
import http from 'http';
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
const wss = new WebSocketServer({ server });

new WebSocketHandler(wss);

server.listen(PORT, () => {
    console.log(`🚀 Planit Poker WebSocket & HTTP server listening on port ${PORT}`);
});
