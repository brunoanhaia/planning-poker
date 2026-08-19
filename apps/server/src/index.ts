import cors from 'cors';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

import { WebSocketHandler } from './webSocketHandler.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

new WebSocketHandler(wss);

server.listen(PORT, () => {
    console.log(`🚀 Planit Poker WebSocket & HTTP server running on http://localhost:${PORT}`);
});
