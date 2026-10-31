import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './clipboard';

/** The text every case tries to copy. */
const inviteLink = 'http://linux-dev:8080/#room-1';

/** Installs a `navigator.clipboard` stub that exposes `writeText`. */
const stubClipboard = (writeText: () => Promise<void>): void => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
};

/** Installs a `document.execCommand` stub, which jsdom does not provide. */
const stubExecCommand = (execCommand: (command: string) => boolean): void => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(document, 'execCommand');
});

describe('copyText', () => {
    it('uses the Clipboard API when it is available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        stubClipboard(writeText);
        const execCommand = vi.fn(() => true);
        stubExecCommand(execCommand);

        await expect(copyText(inviteLink)).resolves.toBe(true);

        expect(writeText).toHaveBeenCalledWith(inviteLink);
        expect(execCommand).not.toHaveBeenCalled();
    });

    it('falls back to the command path when the Clipboard API is missing', async () => {
        let copiedText = '';
        stubExecCommand((command) => {
            expect(command).toBe('copy');
            // jsdom's `select()` does not focus, so the off-screen textarea is
            // read from the DOM instead of from `document.activeElement`.
            const textarea = document.querySelector('textarea');
            copiedText = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
            return true;
        });

        await expect(copyText(inviteLink)).resolves.toBe(true);

        expect(copiedText).toBe(inviteLink);
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('resolves false when the Clipboard API rejects and the command fails', async () => {
        stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
        stubExecCommand(() => false);

        await expect(copyText(inviteLink)).resolves.toBe(false);
        expect(document.querySelector('textarea')).toBeNull();
    });
});
