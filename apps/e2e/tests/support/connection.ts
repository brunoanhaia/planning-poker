import { Page } from '@playwright/test';

/** Handle the test uses to release the application-visible socket open. */
export interface HeldSocket {
    /** Releases held sockets, optionally keeping the original dial blocked. */
    release: (scope?: 'all' | 'replacements') => Promise<void>;
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
        let releaseFrom = Infinity;
        let nextSocketIndex = 0;
        const pendingOpens = new Map<number, () => void>();

        const release = (from: number) => {
            releaseFrom = from;
            for (const [index, open] of pendingOpens) {
                if (index >= releaseFrom) {
                    pendingOpens.delete(index);
                    open();
                }
            }
        };

        const host = window as typeof window & { __releaseDelayedSockets: typeof release };
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
                const index = nextSocketIndex++;
                this.native.onopen = (event) => {
                    const open = () => {
                        if (this.isClosed) {
                            return;
                        }
                        this.readyState = HeldWebSocket.OPEN;
                        this.onopen?.(event);
                    };
                    if (index >= releaseFrom) {
                        open();
                        return;
                    }
                    pendingOpens.set(index, open);
                };
                this.native.onmessage = (event) => this.onmessage?.(event);
                this.native.onclose = (event) => {
                    pendingOpens.delete(index);
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

        window.WebSocket = new Proxy(NativeWebSocket, {
            construct(target, [url, protocols]: [string | URL, (string | string[])?]) {
                // Leave Vite's hot reload connection untouched.
                if (protocols === 'vite-hmr') {
                    return new target(url, protocols);
                }
                return new HeldWebSocket(url, protocols);
            },
        });
    });

    return {
        release: async (scope = 'all') => {
            await page.evaluate(
                (from) => {
                    const host = window as typeof window & {
                        __releaseDelayedSockets: (from: number) => void;
                    };
                    host.__releaseDelayedSockets(from);
                },
                scope === 'all' ? 0 : 1
            );
        },
    };
};
