import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reads the public site key baked into the bundle; empty means the challenge is off.
 *
 * Read per call rather than cached, so a bundle built without a key renders nothing
 * and a bundle built with one renders the widget, without a second build.
 */
const readSiteKey = (): string | undefined =>
    (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY as string | undefined;

/** Source of the Turnstile script, so it is only ever loaded once. */
const SCRIPT_SOURCE = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/** The single object the Turnstile script exposes. */
interface TurnstileApi {
    remove: (widgetId: string) => void;
    render: (
        element: string,
        options: {
            'error-callback'?: () => void;
            'expired-callback'?: () => void;
            callback: (token: string) => void;
            sitekey: string;
        }
    ) => string;
    reset: (widgetId?: string) => void;
}

/** Reads the Turnstile API off the window, once the script has exposed it. */
const readApi = (): TurnstileApi | null =>
    (window as unknown as { turnstile?: TurnstileApi }).turnstile ?? null;

/**
 * Loads the Turnstile script once and hands over its API.
 *
 * The listener is attached to whatever script element is already present, so a
 * second mount does not load the script twice and the cleanup cannot leak it.
 *
 * @returns The API, or null until the script has exposed it.
 */
const useTurnstileApi = (): TurnstileApi | null => {
    const [api, setApi] = useState<TurnstileApi | null>(null);
    const siteKey = readSiteKey();

    useEffect(() => {
        if (!siteKey) {
            return;
        }

        let isCancelled = false;
        const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${SCRIPT_SOURCE}"]`
        );
        const script = existing ?? document.createElement('script');
        if (!existing) {
            script.src = SCRIPT_SOURCE;
            script.async = true;
            script.defer = true;
            document.head.append(script);
        }

        // The script may already have run before this effect, in which case the
        // API is there now and the listener would never fire for it. Reading it
        // first and handing it over through the load event keeps the state update
        // out of the synchronous part of the effect.
        const onReady = (): void => {
            const apiNow = readApi();
            if (!isCancelled && apiNow) {
                setApi(apiNow);
            }
        };
        script.addEventListener('load', onReady);
        queueMicrotask(onReady);

        return () => {
            isCancelled = true;
            script.removeEventListener('load', onReady);
        };
    }, [siteKey]);

    return api;
};

/**
 * Renders the Cloudflare Turnstile challenge and reports the token it produced.
 *
 * The widget is only rendered when a site key was baked into the bundle, so a
 * development or self-hosted deployment without one renders nothing and sends
 * nothing — the server verifies the token against its own secret, and skips the
 * check entirely when it has none.
 *
 * A token is single-use, so an expired one is dropped and the widget is reset
 * rather than left holding a value the server would refuse.
 *
 * @param onToken - Called with the solved token, or null when it stopped being valid.
 * @returns The element the widget renders into, or null when the challenge is off.
 */
export const useTurnstile = (
    onToken: (token: string | null) => void
): { challenge: React.ReactElement | null; reset: () => void } => {
    const api = useTurnstileApi();
    const siteKey = readSiteKey();
    const holderRef = useRef<HTMLDivElement>(null);
    const callbackRef = useRef(onToken);
    const widgetIdRef = useRef<string | null>(null);

    // The callback is kept current without the caller having to memoize it, and
    // without touching a ref during render.
    useEffect(() => {
        callbackRef.current = onToken;
    }, [onToken]);

    useEffect(() => {
        const holder = holderRef.current;
        if (!api || !holder) {
            return;
        }

        const dropToken = (): void => {
            callbackRef.current(null);
            if (widgetIdRef.current) {
                api.reset(widgetIdRef.current);
            }
        };

        // Turnstile takes a CSS selector, so the bare id would never match the
        // element and no widget would appear.
        widgetIdRef.current = api.render(`#${WIDGET_ID}`, {
            'error-callback': dropToken,
            'expired-callback': dropToken,
            callback: (token: string) => callbackRef.current(token),
            sitekey: siteKey as string,
        });

        return () => {
            if (widgetIdRef.current) {
                api.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [api, siteKey]);

    // A token is single-use, so the widget is reset after every submission: a join
    // that failed must be retried with a fresh challenge rather than a spent one.
    const reset = useCallback((): void => {
        if (widgetIdRef.current) {
            api?.reset(widgetIdRef.current);
        }
        callbackRef.current(null);
    }, [api]);

    if (!siteKey) {
        return { challenge: null, reset };
    }

    return { challenge: <div id={WIDGET_ID} ref={holderRef} />, reset };
};

/** Turnstile renders itself into the element carrying this id. */
const WIDGET_ID = 'planit-turnstile';
