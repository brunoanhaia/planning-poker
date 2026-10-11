/**
 * Centralized server constants and default configurations.
 * Prevents magic values across backend modules.
 */

/** Characters used for random room code generation (excludes confusing chars like 0, O, 1, I). */
export const ROOM_ID_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Length of generated room codes.
 *
 * Eight characters from a 32-character alphabet is ~1.1×10¹² candidates: at the
 * ~1 400 guesses per second a single host could once reach, walking the keyspace
 * would take about nine days even without any other control, which makes the room
 * code a secret rather than a guessing game. Six characters was ~1.1×10⁹ and
 * could be walked in minutes.
 */
export const ROOM_ID_LENGTH = 8;

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

/** How often the idle-room sweep runs, in milliseconds (every hour). */
export const ROOM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * WebSocket connections one address may hold at the same time.
 *
 * Sized for a whole organisation behind one address: every participant of a
 * 100-person room is one socket, and a company spread over several rooms is
 * several hundred. A flood reaches this ceiling long before a crowd does — the
 * measured one was ~1 500 sockets in three seconds.
 */
export const WS_MAX_CONNECTIONS_PER_IP = 300;

/**
 * Connections one address may open inside {@link WS_CONNECTION_WINDOW_MS}.
 *
 * The backstop against short-lived sockets, which never accumulate concurrency
 * and so would otherwise walk past the ceiling above. A large team arriving at
 * once is a burst, not a flood; a flood is orders of magnitude faster.
 */
export const WS_MAX_CONNECTIONS_PER_WINDOW = 600;

/** Window the handshake allowance is spent in, in milliseconds. */
export const WS_CONNECTION_WINDOW_MS = 60 * 1000;

/** Addresses the connection limiter holds at once, so churn cannot grow its maps. */
export const WS_MAX_TRACKED_ADDRESSES = 5_000;

/** Sliding window the failed-join budget is spent in, in milliseconds. */
export const JOIN_FAILURE_WINDOW_MS = 60 * 1000;

/** How long an address that exhausted its failed-join budget is barred, in milliseconds. */
export const JOIN_FAILURE_COOLDOWN_MS = 60 * 1000;

/**
 * Addresses the failed-join limiter holds at once.
 *
 * A client cycling through distinct addresses leaves one record each, and the
 * hourly sweep only reclaims them, so the tracked state needs a bound of its own.
 */
export const JOIN_FAILURE_MAX_TRACKED_ADDRESSES = 5_000;

/** Distinct unknown room codes one address may probe inside {@link JOIN_FAILURE_WINDOW_MS}. */
export const JOIN_FAILURE_LIMIT = 30;
