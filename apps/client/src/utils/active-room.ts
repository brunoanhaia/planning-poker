/** Local storage key holding the room this browser is currently in. */
export const ACTIVE_ROOM_STORAGE_KEY = 'planit_active_room';

/** Reads the room the browser is in, or an empty string when none is recorded. */
export const readActiveRoom = (): string => localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY) ?? '';

/** Records the room this browser is in, so another tab can warn before switching. */
export const rememberActiveRoom = (roomId: string): void => {
    localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
};

/** Clears the record only while it still points at the room being left. */
export const forgetActiveRoom = (roomId: string): void => {
    if (readActiveRoom() === roomId) {
        localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    }
};
