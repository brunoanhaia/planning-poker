import { describe, expect, it } from 'vitest';

import { buildBacklogCsvFilename, escapeCsvCell } from '../utils/csv';

describe('escapeCsvCell', () => {
    it('wraps plain values in quotes', () => {
        expect(escapeCsvCell('Story')).toBe('"Story"');
        expect(escapeCsvCell(5)).toBe('"5"');
    });

    it('doubles embedded quotes', () => {
        expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it('neutralizes formula injection triggers', () => {
        expect(escapeCsvCell('=cmd|calc')).toBe('"\'=cmd|calc"');
        expect(escapeCsvCell('+1+1')).toBe('"\'+1+1"');
        expect(escapeCsvCell('-2-2')).toBe('"\'-2-2"');
        expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    });

    it('handles null and undefined as empty cells', () => {
        expect(escapeCsvCell(null)).toBe('""');
        expect(escapeCsvCell(undefined)).toBe('""');
    });
});

describe('buildBacklogCsvFilename', () => {
    it('slugifies a normal title and appends a fixed extension', () => {
        expect(buildBacklogCsvFilename('Sprint 42')).toBe('Sprint_42_Backlog_Estimates.csv');
    });

    it('strips path separators and traversal sequences', () => {
        const filename = buildBacklogCsvFilename('../../etc/passwd');
        expect(filename).not.toContain('/');
        expect(filename).not.toContain('..');
        expect(filename.endsWith('.csv')).toBe(true);
    });

    it('falls back to a safe name for empty or symbol-only titles', () => {
        expect(buildBacklogCsvFilename('')).toBe('backlog_Backlog_Estimates.csv');
        expect(buildBacklogCsvFilename('///')).toBe('backlog_Backlog_Estimates.csv');
        expect(buildBacklogCsvFilename(null)).toBe('backlog_Backlog_Estimates.csv');
    });

    it('caps the slug length', () => {
        const filename = buildBacklogCsvFilename('a'.repeat(200));
        expect(filename.length).toBeLessThanOrEqual(60 + '_Backlog_Estimates.csv'.length);
    });
});
