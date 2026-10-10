import { randomUUID } from 'node:crypto';

/**
 * Name of the first-party cookie that carries a browser's stable identity.
 *
 * A session token proves *a participant*, and a kick revokes it — so it cannot
 * answer "is this the browser I just removed?". A server-issued client id can:
 * the browser sends it on every WebSocket handshake, and the client application
 * never sees it, let alone replaces it.
 *
 * It is deliberately **not** a lock. A determined user can clear cookies, which
 * is why the bar it feeds is documented as advice rather than enforcement; what
 * it does remove is the free bypass of rejoining with a fresh tab.
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
