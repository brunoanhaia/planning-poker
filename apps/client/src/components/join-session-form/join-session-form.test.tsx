import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { JoinSessionForm } from './join-session-form';

/** The Turnstile API double the widget hook looks for. */
const installTurnstile = () => {
    const calls = { rendered: [] as unknown[], reset: [] as unknown[] };
    (window as unknown as { turnstile?: unknown }).turnstile = {
        remove: () => {},
        render: (element: string, options: unknown) => {
            calls.rendered.push({ element, options });
            return 'widget-1';
        },
        reset: (widgetId?: string) => calls.reset.push(widgetId),
    };
    return calls;
};

/** Submits the join form the way a human does: type a code, press the button. */
const submitJoin = (roomCode: string) => {
    fireEvent.change(screen.getByLabelText(/Room Code/i), { target: { value: roomCode } });
    fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));
};

describe('JoinSessionForm', () => {
    it('submits the code and no challenge token when none is configured', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        submitJoin('ABCD1234');

        expect(onSubmit).toHaveBeenCalledWith('ABCD1234', null);
    });

    it('uppercases the code before handing it over', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        submitJoin('abcd1234');

        expect(onSubmit).toHaveBeenCalledWith('ABCD1234', null);
    });

    it('does not submit an incomplete code', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText(/Room Code/i), { target: { value: 'ABC' } });
        fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('resets the challenge after a submission, so a retry is not a spent token', async () => {
        // The widget is only rendered with a site key, and the hook resets it on
        // submit — without that a refused join would resubmit the used token.
        const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
        (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = 'site-key';
        const calls = installTurnstile();
        const onSubmit = vi.fn();

        try {
            render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

            // Fire the script's load event, which is what hands the API over.
            const load = (): void => {
                document
                    .querySelector<HTMLScriptElement>(
                        'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
                    )
                    ?.dispatchEvent(new Event('load'));
            };
            await vi.waitFor(() => expect(calls.rendered.length).toBeGreaterThan(0));
            load();

            // The widget asked for a token, and the form submits with it.
            const options = (calls.rendered[0] as { options: { callback: (t: string) => void } })
                .options;
            options.callback('a-token');

            submitJoin('ABCD1234');

            expect(onSubmit).toHaveBeenCalledWith('ABCD1234', 'a-token');
            expect(calls.reset).toEqual(['widget-1']);
        } finally {
            (import.meta.env as Record<string, unknown>).VITE_TURNSTILE_SITE_KEY = siteKey;
        }
    });
});
