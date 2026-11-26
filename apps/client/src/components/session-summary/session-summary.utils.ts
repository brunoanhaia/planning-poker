import { buildCsvFilename } from '../../utils/csv-filename';
import { SessionSummary } from '../../utils/estimation-stats';
import { escapeCsvCell } from '../story-backlog/story-backlog.utils';

/** Fixed marker appended to a session summary filename. */
const SUMMARY_FILENAME_SUFFIX = 'Session_Summary';

/** Fallback slug used when the room title yields no usable characters. */
const SUMMARY_FILENAME_FALLBACK = 'session';

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

/**
 * Builds the download filename of a session summary export.
 *
 * A summary is not a backlog, so it must not reuse the backlog marker: the
 * filename is the first thing a user sees after the session ends.
 *
 * @param roomTitle - The (untrusted) room title.
 * @returns A filesystem-safe filename ending in `.csv`.
 */
export const buildSessionSummaryCsvFilename = (roomTitle: null | string | undefined): string =>
    buildCsvFilename(roomTitle, SUMMARY_FILENAME_SUFFIX, SUMMARY_FILENAME_FALLBACK);

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
