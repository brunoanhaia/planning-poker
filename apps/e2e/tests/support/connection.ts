import { Page } from '@playwright/test';

/**
 * Delays the `open` event the application sees without delaying the real
 * server connection.
 *
 * The connectivity spec uses it to simulate a cold backend: the socket is
 * created and connects normally, but the app stays in `connecting` until the
 * configured delay elapses.
 *
 * @param page - Page to instrument before navigation.
 * @param delayMs - Milliseconds to hold the application-visible open event.
 */
export const delaySocketOpen = async (page: Page, delayMs: number): Promise<void> => {
    await page.addInitScript((delay) => {
        const NativeWebSocket = window.WebSocket;

        class DelayedWebSocket {
            static readonly CONNECTING = 0;
            static readonly OPEN = 1;
            static readonly CLOSING = 2;
            static readonly CLOSED = 3;

            readyState = DelayedWebSocket.CONNECTING;
            onopen: ((event: Event) => void) | null = null;
            onmessage: ((event: MessageEvent) => void) | null = null;
            onclose: ((event: CloseEvent) => void) | null = null;
            onerror: ((event: Event) => void) | null = null;

            private readonly native: WebSocket;
            private isClosed = false;
            private openTimer: ReturnType<typeof setTimeout> | null = null;

            constructor(url: string | URL, protocols?: string | string[]) {
                this.native = new NativeWebSocket(url, protocols);
                this.native.onopen = (event) => {
                    this.openTimer = setTimeout(() => {
                        if (this.isClosed) {
                            return;
                        }
                        this.readyState = DelayedWebSocket.OPEN;
                        this.onopen?.(event);
                    }, delay);
                };
                this.native.onmessage = (event) => this.onmessage?.(event);
                this.native.onclose = (event) => {
                    this.isClosed = true;
                    this.readyState = DelayedWebSocket.CLOSED;
                    this.onclose?.(event);
                };
                this.native.onerror = (event) => this.onerror?.(event);
            }

            send(data: string): void {
                this.native.send(data);
            }

            close(): void {
                this.isClosed = true;
                if (this.openTimer) {
                    clearTimeout(this.openTimer);
                    this.openTimer = null;
                }
                this.readyState = DelayedWebSocket.CLOSED;
                try {
                    this.native.close();
                } catch {
                    // The native socket may already be closing.
                }
            }
        }

        window.WebSocket = DelayedWebSocket as unknown as typeof WebSocket;
    }, delayMs);
};
