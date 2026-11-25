import { describe, expect, it } from 'vitest';

import { buildSessionSummaryCsvFilename } from './session-summary.utils';

describe('buildSessionSummaryCsvFilename', () => {
    it('marks the file as a session summary, not a backlog', () => {
        expect(buildSessionSummaryCsvFilename('Sprint 42 / Planning')).toBe(
            'Sprint_42_Planning_Session_Summary.csv'
        );
    });

    it('falls back to a generic session slug when the title has no usable characters', () => {
        expect(buildSessionSummaryCsvFilename('///')).toBe('session_Session_Summary.csv');
        expect(buildSessionSummaryCsvFilename(null)).toBe('session_Session_Summary.csv');
    });
});
