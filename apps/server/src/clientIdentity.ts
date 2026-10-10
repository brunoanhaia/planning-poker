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

/** Attributes of the identity cookie. */
export const CLIENT_ID_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
} as const;

/**
 * Serializes the cookie that carries a client identity.
 *
 * @param value - The identifier to store.
 * @returns The `Set-Cookie` value.
 */
export const buildClientIdCookie = (value: string): string =>
    [`${CLIENT_ID_COOKIE}=${value}`, 'Path=/', 'Max-Age=86400', 'HttpOnly', 'SameSite=Strict'].join(
        '; '
    );

/**
 * Reads the client identity out of a `Cookie` request header.
 *
 * @param cookieHeader - The raw header, e.g. `pip_client=<uuid>; other=1`.
 * @returns The identifier, or null when the header carries none.
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
            return value.length > 0 ? value : null;
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
