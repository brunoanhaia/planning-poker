import { SessionSummary } from '../../utils/estimation-stats';
import { escapeCsvCell } from '../story-backlog/story-backlog.utils';

/** CSV columns of the session summary, in order. */
const SUMMARY_CSV_COLUMNS = [
    'Story',
    'Final Estimate',
    'Round',
    'Votes',
    'Average',
    'Median',
    'Std. Deviation',
    'Outliers',
] as const;

/** Formats a millisecond duration as `h:mm:ss` or `m:ss`. */
export const formatDuration = (durationMs: null | number): string => {
    if (durationMs === null) {
        return '—';
    }
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number): string => String(value).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

/** Formats a statistic for display, or a dash when the round had no number. */
export const formatStatistic = (value: null | number): string =>
    value === null ? '—' : value.toFixed(1);

/**
 * Builds the summary CSV, one row per revealed round.
 *
 * The file is data rather than interface, so its header stays in English: it is
 * the column name a spreadsheet formula and another tool expect, not copy.
 *
 * @param summary - The session summary to export.
 * @returns The CSV body.
 */
export const buildSummaryCsv = (summary: SessionSummary): string => {
    const header = SUMMARY_CSV_COLUMNS.map(escapeCsvCell).join(',');
    const rows = summary.stories.flatMap((story) =>
        story.rounds.length === 0
            ? [
                  [story.title, story.finalEstimate ?? '', '', '0', '', '', '', '']
                      .map(escapeCsvCell)
                      .join(','),
              ]
            : story.rounds.map((round) =>
                  [
                      story.title,
                      story.finalEstimate ?? '',
                      String(round.number),
                      String(round.stats.totalVotes),
                      formatStatistic(round.stats.average),
                      formatStatistic(round.stats.median),
                      formatStatistic(round.stats.standardDeviation),
                      round.stats.outliers.map((outlier) => outlier.name).join(' '),
                  ]
                      .map(escapeCsvCell)
                      .join(',')
              )
    );

    return [header, ...rows].join('\n');
};
