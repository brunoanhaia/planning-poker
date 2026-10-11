import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTurnstile } from './turnstile';

/** A harness that renders the hook and exposes what it produced. */
const renderHook = (onToken: (token: string | null) => void) => {
    let element: React.ReactElement | null = null;
    let resetChallenge = (): void => {};
    const Probe: React.FC = () => {
        const hook = useTurnstile(onToken);
        element = hook.challenge;
        resetChallenge = hook.reset;
        return hook.challenge ?? null;
    };
    const view = render(<Probe />);
    return { element, resetChallenge: () => resetChallenge(), unmount: view.unmount };
};

/** Installs a Turnstile API double that records what the hook asked of it. */
const installApi = () => {
    const calls = { removed: [] as string[], rendered: [] as unknown[], reset: [] as unknown[] };
    (window as unknown as { turnstile?: unknown }).turnstile = {
        remove: (widgetId: string) => calls.removed.push(widgetId),
        render: (element: string, options: unknown) => {
            calls.rendered.push({ element, options });
            return 'widget-1';
        },
        reset: (widgetId?: string) => calls.reset.push(widgetId),
    };
    return calls;
};

const dispatchLoad = (): void => {
    const script = document.querySelector<HTMLScriptElement>(
        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    script?.dispatchEvent(new Event('load'));
};

afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
    document.head.querySelectorAll('script').forEach((script) => script.remove());
});

describe('useTurnstile', () => {
    it('renders nothing when no site key is configured', () => {
        delete (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY;

        const { element } = renderHook(vi.fn());

        expect(element).toBeNull();
        expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
    });

    it('loads the script and renders the widget with the site key', async () => {
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installApi();

        const { element } = renderHook(vi.fn());

        expect(element).not.toBeNull();
        expect(
            document.querySelector(
                'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
            )
        ).not.toBeNull();

        await act(async () => {
            dispatchLoad();
        });

        expect(calls.rendered).toHaveLength(1);
        expect(calls.rendered[0]).toMatchObject({ element: '#planit-turnstile' });
        expect(calls.rendered[0]).toMatchObject({ options: { sitekey: 'site-key' } });
    });

    it('reports the solved token to its caller', async () => {
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installApi();
        const onToken = vi.fn();

        renderHook(onToken);
        await act(async () => {
            dispatchLoad();
        });

        const options = calls.rendered[0]?.options as { callback: (token: string) => void };
        act(() => {
            options.callback('a-token');
        });

        expect(onToken).toHaveBeenCalledWith('a-token');
    });

    it('drops an expired token and resets the widget', async () => {
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installApi();
        const onToken = vi.fn();

        renderHook(onToken);
        await act(async () => {
            dispatchLoad();
        });

        const options = calls.rendered[0]?.options as {
            'expired-callback': () => void;
            callback: (token: string) => void;
        };
        act(() => {
            options.callback('a-token');
            options['expired-callback']();
        });

        expect(onToken).toHaveBeenLastCalledWith(null);
        expect(calls.reset).toEqual(['widget-1']);
    });

    it('removes the widget when the caller goes away', async () => {
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installApi();

        const view = renderHook(vi.fn());
        await act(async () => {
            dispatchLoad();
        });

        view.unmount();

        expect(calls.removed).toEqual(['widget-1']);
    });

    it('resets the widget and clears the token its caller holds', async () => {
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installApi();
        const onToken = vi.fn();

        const hook = renderHook(onToken);
        await act(async () => {
            dispatchLoad();
        });

        const options = calls.rendered[0]?.options as { callback: (token: string) => void };
        act(() => {
            options.callback('a-token');
        });
        act(() => {
            hook.resetChallenge();
        });

        expect(calls.reset).toEqual(['widget-1']);
        expect(onToken).toHaveBeenLastCalledWith(null);
    });
});
