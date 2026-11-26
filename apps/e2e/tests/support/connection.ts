import { Page } from '@playwright/test';

/** Handle the test uses to release the application-visible socket open. */
export interface HeldSocket {
    /** Opens every socket currently held, and lets future sockets open at once. */
    release: () => Promise<void>;
}

/**
 * Holds the `open` event the application sees until the test releases it.
 *
 * The native socket still connects to the server; only the callback the app
 * observes is deferred. This makes the queued-create and cold-start tests
 * deterministic: the test asserts the connecting/waking state first, then
 * releases the socket and waits for the resulting state.
 *
 * @param page - Page to instrument before navigation.
 * @returns A handle that releases the held sockets.
 */
export const holdSocketOpen = async (page: Page): Promise<HeldSocket> => {
    await page.addInitScript(() => {
        const NativeWebSocket = window.WebSocket;
        let released = false;
        const pendingOpens: (() => void)[] = [];

        const release = () => {
            released = true;
            pendingOpens.splice(0).forEach((open) => open());
        };

        const host = window as typeof window & { __releaseDelayedSockets?: () => void };
        host.__releaseDelayedSockets = release;

        class HeldWebSocket {
            static readonly CONNECTING = 0;
            static readonly OPEN = 1;
            static readonly CLOSING = 2;
            static readonly CLOSED = 3;

            readyState = HeldWebSocket.CONNECTING;
            onopen: ((event: Event) => void) | null = null;
            onmessage: ((event: MessageEvent) => void) | null = null;
            onclose: ((event: CloseEvent) => void) | null = null;
            onerror: ((event: Event) => void) | null = null;

            private readonly native: WebSocket;
            private isClosed = false;

            constructor(url: string | URL, protocols?: string | string[]) {
                this.native = new NativeWebSocket(url, protocols);
                this.native.onopen = (event) => {
                    const open = () => {
                        if (this.isClosed) {
                            return;
                        }
                        this.readyState = HeldWebSocket.OPEN;
                        this.onopen?.(event);
                    };
                    if (released) {
                        open();
                        return;
                    }
                    pendingOpens.push(open);
                };
                this.native.onmessage = (event) => this.onmessage?.(event);
                this.native.onclose = (event) => {
                    this.isClosed = true;
                    this.readyState = HeldWebSocket.CLOSED;
                    this.onclose?.(event);
                };
                this.native.onerror = (event) => this.onerror?.(event);
            }

            send(data: string): void {
                this.native.send(data);
            }

            close(): void {
                this.isClosed = true;
                this.readyState = HeldWebSocket.CLOSED;
                try {
                    this.native.close();
                } catch {
                    // The native socket may already be closing.
                }
            }
        }

        window.WebSocket = HeldWebSocket as unknown as typeof WebSocket;
    });

    return {
        release: async () => {
            await page.evaluate(() => {
                const host = window as typeof window & {
                    __releaseDelayedSockets?: () => void;
                };
                host.__releaseDelayedSockets?.();
            });
        },
    };
};
