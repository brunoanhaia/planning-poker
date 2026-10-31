/** Path the bundled Nginx proxies to the Node server, and the server's own route. */
const SAME_ORIGIN_WS_PATH = '/ws';

/** Where the dev server listens, which is not behind the Vite proxy. */
const DEV_SERVER_URL = 'ws://localhost:5000';

export interface SocketUrlSources {
    /** `import.meta.env.DEV` — true under `vite dev`. */
    isDev: boolean;
    /** `import.meta.env.VITE_WS_URL`, baked at build time; empty means same-origin. */
    configuredUrl: string | undefined;
    /** Current page location (protocol and host are the only parts used). */
    location: { host: string; protocol: string };
}

/**
 * Resolves the WebSocket endpoint the client should dial.
 *
 * The same-origin fallback keeps the `/ws` path: the bundled Nginx serves the
 * SPA on `/` and only proxies `/ws` to the server, so dialling the bare host
 * would receive the HTML page as a `200` and the handshake would fail. The dev
 * server is reached directly and does not need the path.
 *
 * @param sources - Build mode, configured URL and page location.
 * @returns The absolute WebSocket URL.
 */
export const resolveSocketUrl = ({ isDev, configuredUrl, location }: SocketUrlSources): string => {
    if (configuredUrl) {
        return configuredUrl;
    }
    if (isDev) {
        return DEV_SERVER_URL;
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${SAME_ORIGIN_WS_PATH}`;
};
