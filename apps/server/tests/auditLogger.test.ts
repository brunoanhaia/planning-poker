import { describe, expect, it, vi } from 'vitest';

import { auditLog, formatAuditRecord } from '../src/auditLogger.js';

describe('formatAuditRecord', () => {
    it('keeps the shape of a record identical whether or not identifiers arrive', () => {
        const withIds = formatAuditRecord({
            action: 'user.kicked',
            outcome: 'denied',
            roomId: 'ROOM01',
            userId: 'user_2',
        });
        const withoutIds = formatAuditRecord({ action: 'user.kicked', outcome: 'denied' });

        expect(Object.keys(withIds).sort()).toEqual(Object.keys(withoutIds).sort());
        expect(withIds.roomId).toBe('ROOM01');
        expect(withoutIds.roomId).toBeNull();
        expect(withoutIds.userId).toBeNull();
    });

    it('stamps the record with the server clock', () => {
        const record = formatAuditRecord({ action: 'room.created', outcome: 'allowed' });

        expect(record.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(Number.isNaN(Date.parse(record.at))).toBe(false);
    });

    it('carries the action and outcome through untouched', () => {
        const record = formatAuditRecord({
            action: 'message.throttled',
            outcome: 'denied',
            roomId: 'ROOM01',
        });

        expect(record.action).toBe('message.throttled');
        expect(record.outcome).toBe('denied');
    });

    it('holds no participant data beyond the identifiers', () => {
        const record = formatAuditRecord({
            action: 'user.kicked',
            outcome: 'allowed',
            roomId: 'ROOM01',
            userId: 'user_2',
        });

        // The record is flat, so anything beyond the four documented fields would
        // be visible here.
        expect(Object.keys(record).sort()).toEqual(['action', 'at', 'outcome', 'roomId', 'userId']);
    });
});

describe('auditLog', () => {
    it('writes exactly one line of JSON per record', () => {
        const written: string[] = [];
        const spy = vi.spyOn(console, 'info').mockImplementation((line: string) => {
            written.push(String(line));
        });

        try {
            auditLog({ action: 'room.created', outcome: 'allowed', roomId: 'ROOM01' });
            auditLog({
                action: 'user.kicked',
                outcome: 'allowed',
                roomId: 'ROOM01',
                userId: 'user_2',
            });
        } finally {
            spy.mockRestore();
        }

        expect(written).toHaveLength(2);
        written.forEach((line) => expect(line).not.toContain('\n'));
        expect(JSON.parse(written[0])).toMatchObject({
            action: 'room.created',
            outcome: 'allowed',
            roomId: 'ROOM01',
        });
    });
});
