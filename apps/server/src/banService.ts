/** Identifier of a barred re-entry: a room and the kicked participant. */
export const banKey = (roomId: string, userId: string): string => `${roomId}:${userId}`;

/**
 * Bars a kicked participant from re-entering the room straight away.
 *
 * Removing a participant from the roster does not keep them out: an open room
 * accepts a fresh `JOIN_ROOM` from the same client, which turns a moderation
 * action into a rename. The bar is keyed by participant identifier and expires
 * on its own, so a removal is a timeout rather than a permanent lockout.
 */
export class BanService {
    private readonly bannedUntil = new Map<string, number>();

    /**
     * Bars a participant from joining a room.
     *
     * @param roomId - The room the participant was removed from.
     * @param userId - The removed participant identifier.
     * @param now - Current timestamp, in milliseconds.
     * @param durationMs - How long the bar lasts, in milliseconds.
     */
    public ban(roomId: string, userId: string, now: number, durationMs: number): void {
        this.bannedUntil.set(banKey(roomId, userId), now + durationMs);
    }

    /**
     * Reports whether a participant is currently barred from a room.
     *
     * Expired bars are dropped on read, so the map cannot outlive its windows.
     *
     * @param roomId - The room being joined.
     * @param userId - The participant attempting to join.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the bar is in force.
     */
    public isBanned(roomId: string, userId: string, now: number): boolean {
        const until = this.bannedUntil.get(banKey(roomId, userId));
        if (until === undefined) {
            return false;
        }
        if (until <= now) {
            this.bannedUntil.delete(banKey(roomId, userId));
            return false;
        }
        return true;
    }

    /**
     * Drops every expired bar.
     *
     * @param now - Current timestamp, in milliseconds.
     */
    public sweep(now: number): void {
        this.bannedUntil.forEach((until, key) => {
            if (until <= now) {
                this.bannedUntil.delete(key);
            }
        });
    }
}
