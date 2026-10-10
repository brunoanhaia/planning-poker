import { randomUUID } from 'node:crypto';

/**
 * Identity of a browser profile, carried by a first-party cookie.
 *
 * A session token proves *a participant*, and a kick revokes it — so it cannot
 * answer "is this the browser I just removed?". The client id can: it is minted
 * once per browser, travels on every WebSocket handshake, and the application
 * never reads it, so it cannot be replaced from the page.
 *
 * The two request paths that need it behave differently, and both are handled:
 *
 * - an HTTP request passes through Express, where a missing cookie is answered
 *   with a `Set-Cookie`, so the browser carries one from its very next call;
 * - a WebSocket upgrade is answered by `ws` itself and never reaches that
 *   middleware. The server therefore writes the `Set-Cookie` header while
 *   performing the upgrade (see `startServer`), which is the only response the
 *   browser of a fresh tab ever sees on that path.
 *
 * A client that arrives without a cookie and then refuses it is simply a client
 * without a history: no kick ban can name it, the same trade-off every
 * anonymous client has. What the identity removes is the *free* bypass of
 * rejoining from a fresh tab, which is what the issue asked for.
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
