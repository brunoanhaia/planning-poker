/** Security-relevant lifecycle of a single server-side action. */
export type AuditAction =
    | 'join.rejected.banned'
    | 'join.rejected.room-full'
    | 'join.rejected.token-missing'
    | 'message.throttled'
    | 'room.created'
    | 'room.dropped.idle'
    | 'room.creation.rejected.limit'
    | 'story.rejected.limit'
    | 'story.index.rejected'
    | 'user.kicked'
    | 'user.promoted'
    | 'user.role-changed'
    | 'user.transferred-host';

/** Outcome of an audited action. */
export type AuditOutcome = 'allowed' | 'denied';

/** One structured audit entry. */
export interface AuditEntry {
    action: AuditAction;
    outcome: AuditOutcome;
    roomId?: string;
    userId?: string;
}

/** The JSON line written to the log, including the server clock. */
export interface AuditRecord {
    action: AuditAction;
    at: string;
    outcome: AuditOutcome;
    roomId: string | null;
    userId: string | null;
}

/**
 * Formats an audit entry as a single-line JSON record.
 *
 * Only room and user identifiers are recorded — never a display name, an avatar,
 * a session token or a vote — so the log can be kept without retaining player
 * data. A missing identifier is emitted as `null` rather than dropped, so the
 * shape of a record never changes.
 *
 * @param entry - The audited action.
 * @returns The record, ready to be written to the log.
 */
export const formatAuditRecord = (entry: AuditEntry): AuditRecord => ({
    action: entry.action,
    at: new Date().toISOString(),
    outcome: entry.outcome,
    roomId: entry.roomId ?? null,
    userId: entry.userId ?? null,
});

/**
 * Writes a structured audit record to stdout, one JSON object per line.
 *
 * A line-oriented format keeps the log greppable and shippable to a collector
 * without a logging dependency.
 *
 * @param entry - The audited action.
 */
export const auditLog = (entry: AuditEntry): void => {
    console.info(JSON.stringify(formatAuditRecord(entry)));
};
