import copy from 'copy-to-clipboard';
import { describe, expect, it, vi } from 'vitest';

import { copyText } from './clipboard';

vi.mock('copy-to-clipboard', () => ({ default: vi.fn() }));

/** The text every case tries to copy. */
const inviteLink = 'http://linux-dev:8080/#room-1';

describe('copyText', () => {
    it('forwards the text to the clipboard library and resolves its result', async () => {
        vi.mocked(copy).mockResolvedValue(true);

        await expect(copyText(inviteLink)).resolves.toBe(true);

        expect(copy).toHaveBeenCalledWith(inviteLink);
    });

    it('resolves false when the library reports a failed copy', async () => {
        vi.mocked(copy).mockResolvedValue(false);

        await expect(copyText(inviteLink)).resolves.toBe(false);

        expect(copy).toHaveBeenCalledWith(inviteLink);
    });
});
