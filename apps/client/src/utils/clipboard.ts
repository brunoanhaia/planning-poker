import copy from 'copy-to-clipboard';

/**
 * Copies text to the clipboard.
 *
 * The library uses `navigator.clipboard` when the page runs in a secure context
 * and falls back to the legacy command path otherwise, which is why the client
 * can copy from a plain-HTTP LAN origin.
 *
 * @param text - The text to copy.
 * @returns `true` when the text reached the clipboard, `false` when it did not.
 */
export const copyText = (text: string): Promise<boolean> => copy(text);
