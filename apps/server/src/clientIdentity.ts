import { randomUUID } from 'node:crypto';

/**
 * Identity of a browser profile, carried by a first-party cookie.
 *
 * A session token proves *a participant*, and a kick revokes it — so it cannot
 * answer "is this the browser I just removed?". The client id can: it is minted
 * per browser, travels on every WebSocket handshake, and the application never
 * reads it, so it cannot be replaced from the page.
 *
 * It is handed over on two paths, and both matter:
 *
 * - the Express middleware answers an HTTP request that arrives without the
 *   cookie with a `Set-Cookie`, so the browser carries one from then on;
 * - a WebSocket upgrade never passes through Express, so the `headers` hook on
 *   the `WebSocketServer` attaches the `Set-Cookie` to the handshake response,
 *   which is the only response a browser that opens the socket first sees.
 *
 * It only reaches the browser where both share an origin — the bundled Nginx
 * deployment, or production with a direct `VITE_WS_URL`. In development the
 * Vite dev server serves the page on its own port and only proxies `ws`, so no
 * cookie is ever sent to the API and the browser-profile bar lapses there. That
 * is why the bar is advisory: the token and the participant id still hold, and
 * the cookie is an additional layer where the deployment allows it.
 */
export const CLIENT_ID_COOKIE = 'pip_client';

/** True when the identity may only travel over TLS; off keeps plain HTTP working. */
const SECURE_COOKIE = process.env.CLIENT_ID_COOKIE_SECURE === 'true';

/**
 * Attributes of the identity cookie.
 *
 * `Secure` is opt-in because the bundled compose stack is served over plain
 * HTTP on its own network, where a browser would silently drop a `Secure`
 * cookie and the browser-profile bar would lapse. A TLS deployment should set
 * `CLIENT_ID_COOKIE_SECURE=true`.
 */
export const CLIENT_ID_COOKIE_OPTIONS = {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
    sameSite: 'strict',
    secure: SECURE_COOKIE,
} as const;

/** Shape of an identity the server minted, so anything else reads as none. */
const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serializes the cookie that carries a client identity.
 *
 * @param value - The identifier to store.
 * @returns The `Set-Cookie` value.
 */
export const buildClientIdCookie = (value: string, secure = SECURE_COOKIE): string => {
    const attributes = [
        `${CLIENT_ID_COOKIE}=${value}`,
        'Path=/',
        'Max-Age=86400',
        'HttpOnly',
        'SameSite=Strict',
    ];
    if (secure) {
        attributes.push('Secure');
    }
    return attributes.join('; ');
};

/**
 * Reads the client identity out of a `Cookie` request header.
 *
 * Only a value shaped like the ones the server mints counts: a scripted client
 * can send any header it likes, and accepting arbitrary text would let it plant
 * whatever it wanted — including an unbounded string — as a key in the ban map.
 *
 * @param cookieHeader - The raw header, e.g. `pip_client=<uuid>; other=1`.
 * @returns The identifier, or null when the header carries none the server issued.
 */
export const parseClientId = (cookieHeader: string | undefined | null): string | null => {
    if (!cookieHeader) {
        return null;
    }
    for (const part of cookieHeader.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) {
            continue;
        }
        if (part.slice(0, separator).trim() === CLIENT_ID_COOKIE) {
            const value = part.slice(separator + 1).trim();
            return CLIENT_ID_PATTERN.test(value) ? value : null;
        }
    }
    return null;
};

/**
 * Mints a fresh client identifier.
 *
 * @returns An opaque identifier for one browser profile.
 */
export const issueClientId = (): string => randomUUID();
