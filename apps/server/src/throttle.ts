/**
 * Caps how many messages a single WebSocket may send inside a time window.
 *
 * A flood of messages from one socket costs the same as a flood from a hundred:
 * every one of them parses JSON, validates a payload and can trigger a
 * broadcast. The cap is enforced per connection, so a throttled client only
 * slows itself down.
 */
export class MessageThrottle {
    private readonly messagesInWindow = new Map<object, number>();
    private readonly windowStartedAt = new Map<object, number>();

    /**
     * @param maxMessages - Messages accepted per window.
     * @param windowMs - Window length, in milliseconds.
     */
    constructor(
        private readonly maxMessages: number,
        private readonly windowMs: number
    ) {}

    /**
     * Records a message for a key and reports whether it may be processed.
     *
     * The counter resets once the window elapses, so a client that stays silent
     * for one window starts again with a full budget.
     *
     * @param key - Identity of the sender, typically the socket itself.
     * @param now - Current timestamp, in milliseconds.
     * @returns True when the message is inside the allowance.
     */
    public allows(key: object, now: number): boolean {
        const windowStart = this.windowStartedAt.get(key);
        if (windowStart === undefined || now - windowStart >= this.windowMs) {
            this.windowStartedAt.set(key, now);
            this.messagesInWindow.set(key, 1);
            return true;
        }

        const used = (this.messagesInWindow.get(key) ?? 0) + 1;
        this.messagesInWindow.set(key, used);
        return used <= this.maxMessages;
    }

    /**
     * Forgets the state of a key, e.g. when its socket closes.
     *
     * @param key - Identity to forget.
     */
    public forget(key: object): void {
        this.messagesInWindow.delete(key);
        this.windowStartedAt.delete(key);
    }

    /**
     * Drops every entry whose window has elapsed.
     *
     * @param now - Current timestamp, in milliseconds.
     */
    public sweep(now: number): void {
        this.windowStartedAt.forEach((windowStart, key) => {
            if (now - windowStart >= this.windowMs) {
                this.forget(key);
            }
        });
    }
}
