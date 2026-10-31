/**
 * Copies text using the legacy `document.execCommand('copy')` path.
 *
 * The textarea is hidden off-screen and read-only so the temporary selection
 * neither scrolls the page nor lets the user type into it. It is always removed.
 *
 * @param text - The text to copy.
 * @returns Whether the command reported a successful copy.
 */
const copyWithCommand = (text: string): boolean => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    try {
        textarea.select();
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        textarea.remove();
    }
};

/**
 * Copies text to the clipboard, falling back when the Clipboard API is missing.
 *
 * `navigator.clipboard` only exists in secure contexts, so a client served over
 * plain HTTP on a LAN origin (for example `http://linux-dev:8080`) has no
 * `writeText` at all. A denied permission fails the same way, which is why the
 * command fallback is attempted both when the API is absent and when it rejects.
 *
 * @param text - The text to copy.
 * @returns `true` when either path copied the text, `false` when both failed.
 */
export const copyText = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to the command path: the API is present but unusable.
        }
    }
    return copyWithCommand(text);
};
