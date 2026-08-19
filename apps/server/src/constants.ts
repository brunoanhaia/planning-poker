/**
 * Centralized server constants and default configurations.
 * Prevents magic values across backend modules.
 */

/** Characters used for random room code generation (excludes confusing chars like 0, O, 1, I). */
export const ROOM_ID_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Length of generated room codes. */
export const ROOM_ID_LENGTH = 6;

/** Heartbeat ping/pong interval in milliseconds (30 seconds). */
export const HEARTBEAT_INTERVAL_MS = 30000;

/** Timer tick interval in milliseconds (1 second). */
export const TIMER_TICK_INTERVAL_MS = 1000;

/** Default countdown timer duration in seconds. */
export const DEFAULT_TIMER_DURATION_SECONDS = 60;

/** Default avatar emoji fallback when none provided. */
export const DEFAULT_AVATAR = '👤';

/** Default primary room host color fallback. */
export const DEFAULT_HOST_COLOR = '#6366f1';

/** Default participant color fallback. */
export const DEFAULT_PARTICIPANT_COLOR = '#3b82f6';
