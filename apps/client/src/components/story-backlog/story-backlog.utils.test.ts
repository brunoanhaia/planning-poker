import { describe, expect, it } from 'vitest';

import { buildBacklogCsvFilename, escapeCsvCell, parseBulkStories } from './story-backlog.utils';

describe('escapeCsvCell', () => {
    it('quotes plain values and doubles embedded quotes', () => {
        expect(escapeCsvCell('story')).toBe('"story"');
        expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it('neutralizes spreadsheet formula injection', () => {
        expect(escapeCsvCell('=1+1')).toBe('"\'=1+1"');
        expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    });

    it('renders nullish values as an empty cell', () => {
        expect(escapeCsvCell(null)).toBe('""');
        expect(escapeCsvCell(undefined)).toBe('""');
    });
});

describe('buildBacklogCsvFilename', () => {
    it('slugifies the title and always ends in .csv', () => {
        expect(buildBacklogCsvFilename('Sprint 42 / Planning')).toBe(
            'Sprint_42_Planning_Backlog_Estimates.csv'
        );
    });

    it('falls back to a default when there is no usable title', () => {
        expect(buildBacklogCsvFilename('///')).toBe('backlog_Backlog_Estimates.csv');
        expect(buildBacklogCsvFilename(null)).toBe('backlog_Backlog_Estimates.csv');
    });
});

describe('parseBulkStories', () => {
    it('splits a title from its description and drops blank lines', () => {
        expect(parseBulkStories('Login API; Implement OAuth\n\nDashboard; Build widgets')).toEqual([
            { description: 'Implement OAuth', title: 'Login API' },
            { description: 'Build widgets', title: 'Dashboard' },
        ]);
    });

    it('treats a line without a separator as a title only', () => {
        expect(parseBulkStories('Just a title')).toEqual([{ title: 'Just a title' }]);
    });

    it('returns nothing for blank input', () => {
        expect(parseBulkStories('   \n  ')).toEqual([]);
    });
});
